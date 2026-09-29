import type {
  AgendaDocumentType,
  ParseAgendaResult,
  ParsedAgendaAppointment,
} from "../../shared/agenda";
import { parseAgendaText } from "./parseAgendaText";

export type ParseAgendaBatchResult = {
  agendas: ParseAgendaResult[];
  date: string | null;
  totalAppointments: number;
  warnings: string[];
  blockingErrors: string[];
  source: "csv" | "pdf";
};

const KNOWN_TYPES: Record<string, AgendaDocumentType> = {
  "nota fiscal": "Nota fiscal",
  pedido: "Pedido",
  cnpj: "CNPJ",
  "agenda fixa": "Agenda fixa",
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[°º]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function parseDateTimeRange(value: string) {
  const match = value
    .replace(/\s+/g, " ")
    .trim()
    .match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})$/i,
    );

  if (!match) return null;

  const date = parseIsoDate(match[1]);
  if (!date) return null;

  const minutes = (time: string) => {
    const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) return null;
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  };

  const startMinutes = minutes(match[2]);
  const endMinutes = minutes(match[3]);
  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    return null;
  }

  return {
    date,
    startTime: match[2],
    endTime: match[3],
  };
}

function parseCount(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "-") return { valid: true, value: null };
  if (!/^\d+$/.test(normalized)) return { valid: false, value: null };
  return { valid: true, value: Number(normalized) };
}

function parseNumberList(value: string) {
  if (!value.trim() || value.trim() === "-") return [];
  return [...new Set(value.match(/\d+/g) ?? [])];
}

function canonicalType(value: string): AgendaDocumentType | null {
  return KNOWN_TYPES[normalizeKey(value)] ?? null;
}

function parseStore(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  if (/^CD$/i.test(normalized)) {
    return { storeCode: "CD", storeName: "CD" };
  }

  const match = normalized.match(
    /^(F\d{1,3}|CD\s+DOCA\s+\d{1,3})\s*-\s*(.+)$/i,
  );

  if (!match) {
    if (/^CD\s+DOCA\s+\d{1,3}$/i.test(normalized)) {
      const code = normalized.toUpperCase().replace(/\s+/g, " ");
      return { storeCode: code, storeName: code };
    }
    return null;
  }

  return {
    storeCode: match[1].toUpperCase().replace(/\s+/g, " "),
    storeName: match[2].trim(),
  };
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ";") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char !== "\r") field += char;
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function pdfRows(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

type HeaderMap = {
  protocol: number;
  dateAgenda: number;
  supplier: number;
  store: number;
  items: number;
  volumes: number;
  pallets: number;
  cargaBatida: number;
  type: number;
  nfe: number;
  orders: number;
};

function findHeader(rows: string[][]): { index: number; map: HeaderMap } | null {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map(normalizeKey);
    const locate = (...names: string[]) =>
      normalized.findIndex((cell) => names.includes(cell));

    const map: HeaderMap = {
      protocol: locate("protocolo"),
      dateAgenda: locate("data agenda"),
      supplier: locate("fornecedor"),
      store: locate("filial"),
      items: locate("itens"),
      volumes: locate("vol", "volumes"),
      pallets: locate("paletes"),
      cargaBatida: locate("carga batida"),
      type: locate("tipo"),
      nfe: locate("n nfe", "nfe"),
      orders: locate("pedidos"),
    };

    if (Object.values(map).every((position) => position >= 0)) {
      return { index, map };
    }
  }

  return null;
}

function metadataDate(text: string) {
  const match = text.match(/Dia:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseIsoDate(match[1]) : null;
}

function cell(row: string[], index: number) {
  return row[index]?.trim() ?? "";
}

function parseTableRows(
  rows: string[][],
  sourceText: string,
  source: "csv" | "pdf",
): ParseAgendaBatchResult | null {
  const header = findHeader(rows);
  if (!header) return null;

  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const appointmentsByAgenda = new Map<
    string,
    {
      storeCode: string;
      storeName: string;
      date: string;
      appointments: ParsedAgendaAppointment[];
    }
  >();
  const seenProtocols = new Set<string>();
  let invalidCount = 0;
  let validRows = 0;

  for (let index = header.index + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const first = cell(row, header.map.protocol);

    if (!first) continue;
    if (normalizeKey(first) === "protocolo") continue;
    if (!/^\d{6,20}$/.test(first)) {
      invalidCount += 1;
      continue;
    }

    const dateTime = parseDateTimeRange(cell(row, header.map.dateAgenda));
    const store = parseStore(cell(row, header.map.store));
    const supplier = cell(row, header.map.supplier)
      .replace(/\s+/g, " ")
      .trim();
    const items = parseCount(cell(row, header.map.items));
    const volumes = parseCount(cell(row, header.map.volumes));
    const pallets = parseCount(cell(row, header.map.pallets));
    const type = canonicalType(cell(row, header.map.type));

    if (
      !dateTime ||
      !store ||
      !supplier ||
      !items.valid ||
      !volumes.valid ||
      !pallets.valid ||
      !type
    ) {
      invalidCount += 1;
      continue;
    }

    const agendaKey = `${store.storeCode}|${dateTime.date}`;
    const protocolKey = `${agendaKey}|${first}`;
    if (seenProtocols.has(protocolKey)) {
      blockingErrors.push(`PROTOCOLO_DUPLICADO:${store.storeCode}:${first}`);
      continue;
    }
    seenProtocols.add(protocolKey);

    const cargaRaw = cell(row, header.map.cargaBatida);
    const appointment: ParsedAgendaAppointment = {
      protocol: first,
      startTime: dateTime.startTime,
      endTime: dateTime.endTime,
      supplier,
      items: items.value,
      volumes: volumes.value,
      pallets: pallets.value,
      cargaBatida: !cargaRaw || cargaRaw === "-" ? null : cargaRaw,
      type,
      nfe: parseNumberList(cell(row, header.map.nfe)),
      orders: parseNumberList(cell(row, header.map.orders)),
      status: "aguardando",
    };

    const group = appointmentsByAgenda.get(agendaKey);
    if (group) {
      group.appointments.push(appointment);
    } else {
      appointmentsByAgenda.set(agendaKey, {
        storeCode: store.storeCode,
        storeName: store.storeName,
        date: dateTime.date,
        appointments: [appointment],
      });
    }
    validRows += 1;
  }

  if (invalidCount > 0) {
    blockingErrors.push(`REGISTROS_NAO_INTERPRETADOS:${invalidCount}`);
  }

  if (validRows === 0) {
    blockingErrors.push("SEM_AGENDAMENTOS_VALIDOS");
  }

  const dates = [...new Set([...appointmentsByAgenda.values()].map((item) => item.date))];
  if (dates.length > 1) {
    blockingErrors.push(`DATAS_DIVERGENTES:${dates.join(",")}`);
  }

  const declaredDate = metadataDate(sourceText);
  if (declaredDate && dates.length === 1 && dates[0] !== declaredDate) {
    blockingErrors.push(`DATA_DIVERGENTE:${declaredDate}:${dates[0]}`);
  }

  const agendas: ParseAgendaResult[] = [...appointmentsByAgenda.values()]
    .sort((left, right) => left.storeCode.localeCompare(right.storeCode, "pt-BR"))
    .map((group) => ({
      storeCode: group.storeCode,
      storeName: group.storeName,
      date: group.date,
      appointments: group.appointments.sort(
        (left, right) =>
          left.startTime.localeCompare(right.startTime) ||
          left.protocol.localeCompare(right.protocol),
      ),
      warnings: [],
      blockingErrors: [],
    }));

  return {
    agendas,
    date: dates.length === 1 ? dates[0] : declaredDate,
    totalAppointments: validRows,
    warnings,
    blockingErrors: [...new Set(blockingErrors)],
    source,
  };
}

function wrapSinglePdf(result: ParseAgendaResult): ParseAgendaBatchResult {
  return {
    agendas:
      result.storeCode && result.date && result.appointments.length > 0
        ? [result]
        : [],
    date: result.date,
    totalAppointments: result.appointments.length,
    warnings: result.warnings,
    blockingErrors: result.blockingErrors,
    source: "pdf",
  };
}

export function parseAgendaCsv(text: string): ParseAgendaBatchResult {
  const parsed = parseTableRows(csvRows(text), text, "csv");

  if (parsed) return parsed;

  return {
    agendas: [],
    date: metadataDate(text),
    totalAppointments: 0,
    warnings: [],
    blockingErrors: ["FORMATO_CSV_NAO_RECONHECIDO"],
    source: "csv",
  };
}

export function parseAgendaPdfText(text: string): ParseAgendaBatchResult {
  const batch = parseTableRows(pdfRows(text), text, "pdf");
  return batch ?? wrapSinglePdf(parseAgendaText(text));
}
