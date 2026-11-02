interface ParsedAppointment {
  protocol: string;
  startTime: string;
  endTime: string;
  supplier: string;
  items: number | null;
  volumes: number | null;
  pallets: number | null;
  cargaBatida: string | null;
  type: string;
  nfe: string[];
  orders: string[];
  status: string;
}
interface AgendaTextResult {
  storeCode: string | null;
  storeName: string | null;
  date: string | null;
  appointments: ParsedAppointment[];
  warnings: string[];
  blockingErrors: string[];
}
interface StructuredRecord {
  protocol: string;
  dateParts: string[];
  supplierParts: string[];
  cargaBatidaParts: string[];
  typeParts: string[];
  nfeParts: string[];
  orderParts: string[];
  itemsRaw?: string;
  volumesRaw?: string;
  palletsRaw?: string;
}
const KNOWN_TYPES: Record<string, string> = {
  "nota fiscal": "Nota fiscal",
  pedido: "Pedido",
  cnpj: "CNPJ",
  "agenda fixa": "Agenda fixa"
};
function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}
function parseIsoDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayText = "", monthText = "", yearText = ""] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
}
function validTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
function parseTimeRange(value: string): { startTime: string; endTime: string } | null {
  const match = value.match(/(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})/i);
  if (!match) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!validTime(startText) || !validTime(endText)) return null;
  const toMinutes = (time: string): number => {
    const [hour, minute] = time.split(":").map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
  };
  if (toMinutes(startText) >= toMinutes(endText)) return null;
  return { startTime: startText, endTime: endText };
}
function canonicalType(value: string): string | null {
  return KNOWN_TYPES[normalizeKey(value)] ?? null;
}
function resolveStructuredType(record: StructuredRecord): { type: string | null; nfeParts: string[]; orderParts: string[] } {
  let typeText = record.typeParts.join(" ").trim();
  let nfeParts = [...record.nfeParts];
  let orderParts = [...record.orderParts];
  const directType = canonicalType(typeText);
  if (directType) {
    return { type: directType, nfeParts, orderParts };
  }
  if (normalizeKey(typeText) === "nota" && nfeParts.length > 0) {
    const [firstNfePart, ...remainingNfeParts] = nfeParts;
    const fiscalMatch = firstNfePart?.match(/^fiscal\b\s*(.*)$/i);
    if (fiscalMatch) {
      typeText = `Nota fiscal${fiscalMatch[1] ? ` ${fiscalMatch[1]}` : ""}`;
      nfeParts = remainingNfeParts;
    }
  }
  const noteFiscalMatch = typeText.match(/^Nota\s+fiscal\b\s*(.*)$/i);
  if (!noteFiscalMatch) {
    return { type: null, nfeParts, orderParts };
  }
  const overflowNumbers = (noteFiscalMatch[1] ?? "").match(/\d+/g) ?? [];
  const explicitNfe = parseNumberList(nfeParts);
  const explicitOrders = parseNumberList(orderParts);
  if (overflowNumbers.length > 0) {
    if (explicitNfe.length === 0 && explicitOrders.length === 0 && overflowNumbers.length > 1 && overflowNumbers.length % 2 === 0) {
      const half = overflowNumbers.length / 2;
      nfeParts = overflowNumbers.slice(0, half);
      orderParts = overflowNumbers.slice(half);
    } else {
      nfeParts = [...overflowNumbers, ...nfeParts];
    }
  }
  return {
    type: "Nota fiscal",
    nfeParts,
    orderParts
  };
}
function parseCount(value: string | undefined): { valid: boolean; value: number | null } {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized === "-") {
    return { valid: true, value: null };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, value: null };
  }
  return { valid: true, value: Number(normalized) };
}
function parseNumberList(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const matches = value.match(/\d+/g) ?? [];
    for (const item of matches) {
      if (!result.includes(item)) result.push(item);
    }
  }
  return result;
}
function isHeaderLine(line: string): boolean {
  const normalized = normalizeKey(line.replace(/\t/g, " "));
  return normalized.includes("prado supermercados") || normalized.includes("agendas de recebimento") || normalized.includes("filtros:") || normalized.includes("protocolo data agenda fornecedor") || normalized.includes("protocolo") && normalized.includes("fornecedor") && normalized.includes("pedidos") || normalized === "todas | busca:" || normalized === "todas busca:";
}
function metadataFromText(text: string) {
  const normalized = text.replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]+/g, " ");
  const storeMatch = normalized.match(
    /Filiais:\s*(F\d+)\s*-\s*([^|\n]+?)(?=\s*\||$)/i
  );
  const cdDockMatch = normalized.match(
    /Filiais:\s*CD\s*\|[^\n]*?Docas?:\s*(DOCA\s*\d+)\s*-\s*CD\b/i
  );
  const cdDockCode = cdDockMatch ? `CD ${(cdDockMatch[1] ?? "").toUpperCase().replace(/\s+/g, " ")}` : null;
  const dateMatch = normalized.match(/Dia:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const totalMatch = normalized.match(
    /Agendas\s+de\s+recebimento\s+Total:\s*(\d+)/i
  );
  return {
    storeCode: storeMatch?.[1]?.toUpperCase() ?? cdDockCode,
    storeName: storeMatch?.[2]?.trim() ?? cdDockCode,
    date: dateMatch ? parseIsoDate(dateMatch[1] ?? "") : null,
    declaredTotal: totalMatch ? Number(totalMatch[1]) : null
  };
}
function appendPart(target: string[], value: string | undefined): void {
  const normalized = value?.trim();
  if (normalized) target.push(normalized);
}
function normalizeCells(line: string): string[] {
  const cells = line.split("	");
  while (cells.length < 10) cells.push("");
  if (cells.length > 10) {
    cells.splice(9, cells.length - 9, cells.slice(9).join(" "));
  }
  return cells.map((cell) => cell.trim());
}
function finalizeStructuredRecord(record: StructuredRecord): ParsedAppointment | null {
  const dateText = record.dateParts.join(" ");
  const date = dateText.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? null;
  const timeRange = parseTimeRange(dateText);
  const supplier = record.supplierParts.join(" ").replace(/\s+/g, " ").trim();
  const { type, nfeParts, orderParts } = resolveStructuredType(record);
  const items = parseCount(record.itemsRaw);
  const volumes = parseCount(record.volumesRaw);
  const pallets = parseCount(record.palletsRaw);
  if (!date || !parseIsoDate(date) || !timeRange || !supplier || !type || !items.valid || !volumes.valid || !pallets.valid) {
    return null;
  }
  const cargaText = record.cargaBatidaParts.join(" ").replace(/\s+/g, " ").trim();
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
    nfe: parseNumberList(nfeParts),
    orders: parseNumberList(orderParts),
    status: "aguardando"
  };
}
function appendStructuredCells(record: StructuredRecord, cells: string[]): void {
  appendPart(record.dateParts, cells[1]);
  appendPart(record.supplierParts, cells[2]);
  if (record.itemsRaw === void 0 && cells[3]) record.itemsRaw = cells[3];
  if (record.volumesRaw === void 0 && cells[4]) {
    record.volumesRaw = cells[4];
  }
  if (record.palletsRaw === void 0 && cells[5]) {
    record.palletsRaw = cells[5];
  }
  appendPart(record.cargaBatidaParts, cells[6]);
  appendPart(record.typeParts, cells[7]);
  appendPart(record.nfeParts, cells[8]);
  appendPart(record.orderParts, cells[9]);
}
function parseStructuredText(text: string): { appointments: ParsedAppointment[]; invalidCount: number } {
  const appointments: ParsedAppointment[] = [];
  let current: StructuredRecord | null = null;
  let pendingPrefixLines: string[][] = [];
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
    const first = cells[0] ?? "";
    const protocol = /^\d{6,20}$/.test(first) ? first : null;
    const startsRowBeforeProtocol = !protocol && parseIsoDate(cells[1] ?? "") !== null;
    if (startsRowBeforeProtocol) {
      finishCurrent();
      if (pendingPrefixLines.length > 0) {
        invalidCount += 1;
      }
      pendingPrefixLines = [cells];
      continue;
    }
    if (!protocol && pendingPrefixLines.length > 0) {
      pendingPrefixLines.push(cells);
      continue;
    }
    if (protocol) {
      finishCurrent();
      current = {
        protocol,
        dateParts: [],
        supplierParts: [],
        cargaBatidaParts: [],
        typeParts: [],
        nfeParts: [],
        orderParts: []
      };
      for (const prefixCells of pendingPrefixLines) {
        appendStructuredCells(current, prefixCells);
      }
      pendingPrefixLines = [];
      appendStructuredCells(current, cells);
      continue;
    }
    if (!current) continue;
    appendStructuredCells(current, cells);
  }
  finishCurrent();
  if (pendingPrefixLines.length > 0) {
    invalidCount += 1;
  }
  return { appointments, invalidCount };
}
function parseFallbackLists(type: string, rawTail: string, protocol: string, warnings: string[]): { valid: boolean; nfe: string[]; orders: string[] } {
  const tokens: string[] = rawTail.match(/-|\d+/g) ?? [];
  if (type === "Pedido") {
    return {
      valid: true,
      nfe: [],
      orders: tokens.filter((token) => token !== "-")
    };
  }
  if (type === "CNPJ" || type === "Agenda fixa") {
    return { valid: true, nfe: [], orders: [] };
  }
  if (tokens.length === 0 || tokens.every((token) => token === "-")) {
    return { valid: true, nfe: [], orders: [] };
  }
  const separator = tokens.indexOf("-");
  if (separator >= 0) {
    return {
      valid: true,
      nfe: tokens.slice(0, separator).filter((token) => token !== "-"),
      orders: tokens.slice(separator + 1).filter((token) => token !== "-")
    };
  }
  if (tokens.length === 1) {
    return { valid: true, nfe: [tokens[0] ?? ""], orders: [] };
  }
  if (tokens.length === 2) {
    return { valid: true, nfe: [tokens[0] ?? ""], orders: [tokens[1] ?? ""] };
  }
  if (tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    pushUnique(warnings, `LISTAS_INFERIDAS:${protocol}`);
    return {
      valid: true,
      nfe: tokens.slice(0, half),
      orders: tokens.slice(half)
    };
  }
  return { valid: false, nfe: [], orders: [] };
}
function parseFallbackText(text: string, warnings: string[]): { appointments: ParsedAppointment[]; invalidCount: number } {
  const source = text.replace(/\r/g, "");
  const starts: number[] = [];
  const startRegex = /(?:^|\n)\s*(\d{6,20})\s+(\d{2}\/\d{2}\/\d{4})/g;
  let match: RegExpExecArray | null;
  while (match = startRegex.exec(source)) {
    starts.push((match.index ?? 0) + (match[0] ?? "").indexOf(match[1] ?? ""));
  }
  const appointments: ParsedAppointment[] = [];
  let invalidCount = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const chunk = source.slice(starts[index], starts[index + 1] ?? source.length).split("\n").filter((line) => !isHeaderLine(line)).join(" ").replace(/[ \u00a0]+/g, " ").trim();
    const row = chunk.match(
      /^(\d{6,20})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})\s+(.+?)\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)\s+(\S+)\s+(Nota\s+fiscal|Pedido|CNPJ|Agenda\s+fixa)\s*(.*)$/i
    );
    if (!row) {
      invalidCount += 1;
      continue;
    }
    const [
      ,
      protocol = "",
      rowDate = "",
      startTime = "",
      endTime = "",
      supplier = "",
      itemsRaw = "",
      volumesRaw = "",
      palletsRaw = "",
      cargaBatidaRaw = "",
      typeRaw = "",
      tail = ""
    ] = row;
    const type = canonicalType(typeRaw);
    const timeRange = parseTimeRange(`${startTime} \xE0s ${endTime}`);
    const items = parseCount(itemsRaw);
    const volumes = parseCount(volumesRaw);
    const pallets = parseCount(palletsRaw);
    if (!type || !parseIsoDate(rowDate) || !timeRange || !supplier.trim() || !items.valid || !volumes.valid || !pallets.valid) {
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
      status: "aguardando"
    });
  }
  return { appointments, invalidCount };
}
function hasStructuredRows(text: string): boolean {
  return text.replace(/\r/g, "").split("\n").some((line) => /^\s*\d{6,20}\t/.test(line) && line.split("	").length >= 10);
}
function parseAgendaText(text: string): AgendaTextResult {
  const metadata = metadataFromText(text);
  const warnings: string[] = [];
  const blockingErrors: string[] = [];
  if (!metadata.storeCode) blockingErrors.push("FILIAL_NAO_IDENTIFICADA");
  if (!metadata.date) blockingErrors.push("DATA_NAO_IDENTIFICADA");
  const parsed = hasStructuredRows(text) ? parseStructuredText(text) : parseFallbackText(text, warnings);
  const seen = /* @__PURE__ */ new Set();
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
  if (metadata.declaredTotal !== null && metadata.declaredTotal !== appointments.length) {
    blockingErrors.push(
      `TOTAL_DIVERGENTE:${metadata.declaredTotal}:${appointments.length}`
    );
  }
  return {
    storeCode: metadata.storeCode,
    storeName: metadata.storeName,
    date: metadata.date,
    appointments,
    warnings,
    blockingErrors
  };
}
export type {
  AgendaTextResult,
  ParsedAppointment
};
export {
  parseAgendaText
};