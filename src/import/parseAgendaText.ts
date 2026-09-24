import type {
  AgendaDocumentType,
  ParseAgendaResult,
  ParsedAgendaAppointment,
} from "../../shared/agenda";

const KNOWN_TYPES: Record<string, AgendaDocumentType> = {
  "nota fiscal": "Nota fiscal",
  pedido: "Pedido",
  cnpj: "CNPJ",
  "agenda fixa": "Agenda fixa",
};

type StructuredRecord = {
  protocol: string;
  dateParts: string[];
  supplierParts: string[];
  itemsRaw?: string;
  volumesRaw?: string;
  palletsRaw?: string;
  cargaBatidaParts: string[];
  typeParts: string[];
  nfeParts: string[];
  orderParts: string[];
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

function parseIsoDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function validTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseTimeRange(value: string) {
  const match = value.match(/(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})/i);
  if (!match || !validTime(match[1]) || !validTime(match[2])) return null;

  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };

  if (toMinutes(match[1]) >= toMinutes(match[2])) return null;
  return { startTime: match[1], endTime: match[2] };
}

function canonicalType(value: string): AgendaDocumentType | null {
  return KNOWN_TYPES[normalizeKey(value)] ?? null;
}

function parseCount(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized === "-") {
    return { valid: true, value: null as number | null };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, value: null as number | null };
  }
  return { valid: true, value: Number(normalized) };
}

function parseNumberList(values: string[]) {
  const result: string[] = [];
  for (const value of values) {
    const matches = value.match(/\d+/g) ?? [];
    for (const item of matches) {
      if (!result.includes(item)) result.push(item);
    }
  }
  return result;
}

function isHeaderLine(line: string) {
  const normalized = normalizeKey(line.replace(/\t/g, " "));
  return (
    normalized.includes("prado supermercados") ||
    normalized.includes("agendas de recebimento") ||
    normalized.includes("filtros:") ||
    normalized.includes("protocolo data agenda fornecedor") ||
    (normalized.includes("protocolo") &&
      normalized.includes("fornecedor") &&
      normalized.includes("pedidos")) ||
    normalized === "todas | busca:" ||
    normalized === "todas busca:"
  );
}

function metadataFromText(text: string) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ");

  const storeMatch = normalized.match(
    /Filiais:\s*(F\d+)\s*-\s*([^|\n]+?)(?=\s*\||$)/i,
  );
  const dateMatch = normalized.match(/Dia:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const totalMatch = normalized.match(
    /Agendas\s+de\s+recebimento\s+Total:\s*(\d+)/i,
  );

  return {
    storeCode: storeMatch?.[1]?.toUpperCase() ?? null,
    storeName: storeMatch?.[2]?.trim() ?? null,
    date: dateMatch ? parseIsoDate(dateMatch[1]) : null,
    declaredTotal: totalMatch ? Number(totalMatch[1]) : null,
  };
}

function appendPart(target: string[], value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) target.push(normalized);
}

function normalizeCells(line: string) {
  const cells = line.split("\t");
  while (cells.length < 10) cells.push("");
  if (cells.length > 10) {
    cells.splice(9, cells.length - 9, cells.slice(9).join(" "));
  }
  return cells.map((cell) => cell.trim());
}

function finalizeStructuredRecord(
  record: StructuredRecord,
): ParsedAgendaAppointment | null {
  const dateText = record.dateParts.join(" ");
  const date = dateText.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? null;
  const timeRange = parseTimeRange(dateText);
  const supplier = record.supplierParts.join(" ").replace(/\s+/g, " ").trim();
  const type = canonicalType(record.typeParts.join(" "));
  const items = parseCount(record.itemsRaw);
  const volumes = parseCount(record.volumesRaw);
  const pallets = parseCount(record.palletsRaw);

  if (
    !date ||
    !parseIsoDate(date) ||
    !timeRange ||
    !supplier ||
    !type ||
    !items.valid ||
    !volumes.valid ||
    !pallets.valid
  ) {
    return null;
  }

  const cargaText = record.cargaBatidaParts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    protocol: record.protocol,
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    supplier,
    items: items.value,
    volumes: volumes.value,
    pallets: pallets.value,
    cargaBatida: !cargaText || cargaText === "-" ? null : cargaText,
    type,
    nfe: parseNumberList(record.nfeParts),
    orders: parseNumberList(record.orderParts),
    status: "aguardando",
  };
}

function parseStructuredText(text: string) {
  const appointments: ParsedAgendaAppointment[] = [];
  let current: StructuredRecord | null = null;
  let invalidCount = 0;

  const finishCurrent = () => {
    if (!current) return;
    const parsed = finalizeStructuredRecord(current);
    if (parsed) appointments.push(parsed);
    else invalidCount += 1;
    current = null;
  };

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    if (!rawLine.trim() || isHeaderLine(rawLine)) continue;

    const cells = normalizeCells(rawLine);
    const protocol = /^\d{6,20}$/.test(cells[0]) ? cells[0] : null;

    if (protocol) {
      finishCurrent();
      current = {
        protocol,
        dateParts: [],
        supplierParts: [],
        cargaBatidaParts: [],
        typeParts: [],
        nfeParts: [],
        orderParts: [],
      };
    }

    if (!current) continue;

    appendPart(current.dateParts, cells[1]);
    appendPart(current.supplierParts, cells[2]);
    if (current.itemsRaw === undefined && cells[3]) current.itemsRaw = cells[3];
    if (current.volumesRaw === undefined && cells[4]) {
      current.volumesRaw = cells[4];
    }
    if (current.palletsRaw === undefined && cells[5]) {
      current.palletsRaw = cells[5];
    }
    appendPart(current.cargaBatidaParts, cells[6]);
    appendPart(current.typeParts, cells[7]);
    appendPart(current.nfeParts, cells[8]);
    appendPart(current.orderParts, cells[9]);
  }

  finishCurrent();
  return { appointments, invalidCount };
}

function parseFallbackLists(
  type: AgendaDocumentType,
  rawTail: string,
  protocol: string,
  warnings: string[],
) {
  const tokens: string[] = rawTail.match(/-|\d+/g) ?? [];

  if (type === "Pedido") {
    return {
      valid: true,
      nfe: [] as string[],
      orders: tokens.filter((token) => token !== "-"),
    };
  }

  if (type === "CNPJ" || type === "Agenda fixa") {
    return { valid: true, nfe: [] as string[], orders: [] as string[] };
  }

  if (tokens.length === 0 || tokens.every((token) => token === "-")) {
    return { valid: true, nfe: [] as string[], orders: [] as string[] };
  }

  const separator = tokens.indexOf("-");
  if (separator >= 0) {
    return {
      valid: true,
      nfe: tokens.slice(0, separator).filter((token) => token !== "-"),
      orders: tokens.slice(separator + 1).filter((token) => token !== "-"),
    };
  }

  if (tokens.length === 1) {
    return { valid: true, nfe: [tokens[0]], orders: [] as string[] };
  }

  if (tokens.length === 2) {
    return { valid: true, nfe: [tokens[0]], orders: [tokens[1]] };
  }

  if (tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    pushUnique(warnings, `LISTAS_INFERIDAS:${protocol}`);
    return {
      valid: true,
      nfe: tokens.slice(0, half),
      orders: tokens.slice(half),
    };
  }

  return { valid: false, nfe: [] as string[], orders: [] as string[] };
}

function parseFallbackText(text: string, warnings: string[]) {
  const source = text.replace(/\r/g, "");
  const starts: number[] = [];
  const startRegex = /(?:^|\n)\s*(\d{6,20})\s+(\d{2}\/\d{2}\/\d{4})/g;
  let match: RegExpExecArray | null;

  while ((match = startRegex.exec(source))) {
    starts.push(match.index + match[0].indexOf(match[1]));
  }

  const appointments: ParsedAgendaAppointment[] = [];
  let invalidCount = 0;

  for (let index = 0; index < starts.length; index += 1) {
    const chunk = source
      .slice(starts[index], starts[index + 1] ?? source.length)
      .split("\n")
      .filter((line) => !isHeaderLine(line))
      .join(" ")
      .replace(/[ \u00a0]+/g, " ")
      .trim();

    const row = chunk.match(
      /^(\d{6,20})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})\s+(.+?)\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)\s+(\S+)\s+(Nota\s+fiscal|Pedido|CNPJ|Agenda\s+fixa)\s*(.*)$/i,
    );

    if (!row) {
      invalidCount += 1;
      continue;
    }

    const [
      ,
      protocol,
      rowDate,
      startTime,
      endTime,
      supplier,
      itemsRaw,
      volumesRaw,
      palletsRaw,
      cargaBatidaRaw,
      typeRaw,
      tail,
    ] = row;

    const type = canonicalType(typeRaw);
    const timeRange = parseTimeRange(`${startTime} às ${endTime}`);
    const items = parseCount(itemsRaw);
    const volumes = parseCount(volumesRaw);
    const pallets = parseCount(palletsRaw);

    if (
      !type ||
      !parseIsoDate(rowDate) ||
      !timeRange ||
      !supplier.trim() ||
      !items.valid ||
      !volumes.valid ||
      !pallets.valid
    ) {
      invalidCount += 1;
      continue;
    }

    const lists = parseFallbackLists(type, tail, protocol, warnings);
    if (!lists.valid) {
      invalidCount += 1;
      continue;
    }

    appointments.push({
      protocol,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      supplier: supplier.replace(/\s+/g, " ").trim(),
      items: items.value,
      volumes: volumes.value,
      pallets: pallets.value,
      cargaBatida: cargaBatidaRaw === "-" ? null : cargaBatidaRaw,
      type,
      nfe: lists.nfe,
      orders: lists.orders,
      status: "aguardando",
    });
  }

  return { appointments, invalidCount };
}

function hasStructuredRows(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .some((line) => /^\s*\d{6,20}\t/.test(line) && line.split("\t").length >= 10);
}

export function parseAgendaText(text: string): ParseAgendaResult {
  const metadata = metadataFromText(text);
  const warnings: string[] = [];
  const blockingErrors: string[] = [];

  if (!metadata.storeCode) blockingErrors.push("FILIAL_NAO_IDENTIFICADA");
  if (!metadata.date) blockingErrors.push("DATA_NAO_IDENTIFICADA");

  const parsed = hasStructuredRows(text)
    ? parseStructuredText(text)
    : parseFallbackText(text, warnings);

  const seen = new Set<string>();
  const appointments = parsed.appointments.filter((appointment) => {
    if (seen.has(appointment.protocol)) {
      pushUnique(blockingErrors, `PROTOCOLO_DUPLICADO:${appointment.protocol}`);
      return false;
    }
    seen.add(appointment.protocol);
    return true;
  });

  if (parsed.invalidCount > 0) {
    blockingErrors.push(`REGISTROS_NAO_INTERPRETADOS:${parsed.invalidCount}`);
  }

  if (appointments.length === 0) {
    blockingErrors.push("SEM_AGENDAMENTOS_VALIDOS");
  }

  if (
    metadata.declaredTotal !== null &&
    metadata.declaredTotal !== appointments.length
  ) {
    blockingErrors.push(
      `TOTAL_DIVERGENTE:${metadata.declaredTotal}:${appointments.length}`,
    );
  }

  return {
    storeCode: metadata.storeCode,
    storeName: metadata.storeName,
    date: metadata.date,
    appointments,
    warnings,
    blockingErrors,
  };
}
