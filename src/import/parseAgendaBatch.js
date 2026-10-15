import { parseAgendaText } from "./parseAgendaText";
const KNOWN_TYPES = {
  "nota fiscal": "Nota fiscal",
  pedido: "Pedido",
  cnpj: "CNPJ",
  "agenda fixa": "Agenda fixa"
};
function normalizeKey(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[°º]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function parseIsoDate(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
}
function parseDateTimeRange(value) {
  const match = value.replace(/\s+/g, " ").trim().match(
    /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(?:às|as)\s+(\d{2}:\d{2})$/i
  );
  if (!match) return null;
  const date = parseIsoDate(match[1]);
  if (!date) return null;
  const minutes = (time) => {
    const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) return null;
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  };
  const startMinutes = minutes(match[2]);
  const endMinutes = minutes(match[3]);
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return null;
  }
  return {
    date,
    startTime: match[2],
    endTime: match[3]
  };
}
function parseCount(value) {
  const normalized = value.trim();
  if (!normalized || normalized === "-") return { valid: true, value: null };
  if (!/^\d+$/.test(normalized)) return { valid: false, value: null };
  return { valid: true, value: Number(normalized) };
}
function parseNumberList(value) {
  if (!value.trim() || value.trim() === "-") return [];
  return [...new Set(value.match(/\d+/g) ?? [])];
}
function canonicalType(value) {
  return KNOWN_TYPES[normalizeKey(value)] ?? null;
}
function parseStore(value, dockValue) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/^CD$/i.test(normalized)) {
    const dock = dockValue?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
    const dockMatch = dock.match(/^DOCA\s+(\d{1,3})$/i);
    if (dockMatch) {
      const dockNumber = dockMatch[1].padStart(2, "0");
      const code = `CD DOCA ${dockNumber}`;
      return { storeCode: code, storeName: code };
    }
    return { storeCode: "CD", storeName: "CD" };
  }
  const match = normalized.match(
    /^(F\d{1,3}|CD\s+DOCA\s+\d{1,3})\s*-\s*(.+)$/i
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
    storeName: match[2].trim()
  };
}
function csvRows(text) {
  const rows = [];
  let row = [];
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
    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(field.trim());
      if (row.some((cell2) => cell2.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field.trim());
  if (row.some((cell2) => cell2.length > 0)) rows.push(row);
  return rows;
}
function pdfRows(text) {
  return text.replace(/\r/g, "").split("\n").map((line) => line.split("	").map((cell2) => cell2.trim())).filter((row) => row.some((cell2) => cell2.length > 0));
}
function findHeader(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map(normalizeKey);
    const locate = (...names) => normalized.findIndex((cell2) => names.includes(cell2));
    const map = {
      protocol: locate("protocolo"),
      dateAgenda: locate("data agenda"),
      supplier: locate("fornecedor"),
      store: locate("filial"),
      dock: locate("doca"),
      items: locate("itens"),
      volumes: locate("vol", "volumes"),
      pallets: locate("paletes"),
      cargaBatida: locate("carga batida"),
      type: locate("tipo"),
      nfe: locate("n nfe", "nfe"),
      orders: locate("pedidos")
    };
    const requiredPositions = Object.entries(map).filter(([key]) => key !== "dock").map(([, position]) => position);
    if (requiredPositions.every((position) => position >= 0)) {
      return { index, map };
    }
  }
  return null;
}
function metadataDate(text) {
  const match = text.match(/Dia:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseIsoDate(match[1]) : null;
}
function metadataTotal(text) {
  const match = text.match(
    /Agendas\s+de\s+recebimento\s+Total:\s*(\d+)/i
  );
  return match ? Number(match[1]) : null;
}
function cell(row, index) {
  return row[index]?.trim() ?? "";
}
function parseTableRows(rows, sourceText, source) {
  const header = findHeader(rows);
  if (!header) return null;
  const blockingErrors = [];
  const warnings = [];
  const appointmentsByAgenda = /* @__PURE__ */ new Map();
  const seenProtocols = /* @__PURE__ */ new Set();
  let invalidCount = 0;
  let validRows = 0;
  for (let index = header.index + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const first = cell(row, header.map.protocol);
    const maxColumn = Math.max(
      ...Object.values(header.map).filter((position) => position >= 0)
    );
    const looksLikeDataRow = row.length > maxColumn && Boolean(cell(row, header.map.dateAgenda)) && Boolean(cell(row, header.map.supplier)) && Boolean(cell(row, header.map.store));
    if (!first) {
      if (looksLikeDataRow) invalidCount += 1;
      continue;
    }
    if (normalizeKey(first) === "protocolo") continue;
    if (!/^\d{6,20}$/.test(first)) {
      if (looksLikeDataRow) invalidCount += 1;
      continue;
    }
    const dateTime = parseDateTimeRange(cell(row, header.map.dateAgenda));
    const store = parseStore(
      cell(row, header.map.store),
      header.map.dock >= 0 ? cell(row, header.map.dock) : void 0
    );
    const supplier = cell(row, header.map.supplier).replace(/\s+/g, " ").trim();
    const items = parseCount(cell(row, header.map.items));
    const volumes = parseCount(cell(row, header.map.volumes));
    const pallets = parseCount(cell(row, header.map.pallets));
    const type = canonicalType(cell(row, header.map.type));
    if (!dateTime || !store || !supplier || !items.valid || !volumes.valid || !pallets.valid || !type) {
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
    const appointment = {
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
      status: "aguardando"
    };
    const group = appointmentsByAgenda.get(agendaKey);
    if (group) {
      group.appointments.push(appointment);
    } else {
      appointmentsByAgenda.set(agendaKey, {
        storeCode: store.storeCode,
        storeName: store.storeName,
        date: dateTime.date,
        appointments: [appointment]
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
  const declaredTotal = metadataTotal(sourceText);
  if (declaredTotal !== null && declaredTotal !== validRows) {
    blockingErrors.push(`TOTAL_DIVERGENTE:${declaredTotal}:${validRows}`);
  }
  const agendas = [...appointmentsByAgenda.values()].sort((left, right) => left.storeCode.localeCompare(right.storeCode, "pt-BR")).map((group) => ({
    storeCode: group.storeCode,
    storeName: group.storeName,
    date: group.date,
    appointments: group.appointments.sort(
      (left, right) => left.startTime.localeCompare(right.startTime) || left.protocol.localeCompare(right.protocol)
    ),
    warnings: [],
    blockingErrors: []
  }));
  return {
    agendas,
    date: dates.length === 1 ? dates[0] : declaredDate,
    totalAppointments: validRows,
    warnings,
    blockingErrors: [...new Set(blockingErrors)],
    source
  };
}
function wrapSinglePdf(result) {
  return {
    agendas: result.storeCode && result.date && result.appointments.length > 0 ? [result] : [],
    date: result.date,
    totalAppointments: result.appointments.length,
    warnings: result.warnings,
    blockingErrors: result.blockingErrors,
    source: "pdf"
  };
}
function parseAgendaCsv(text) {
  const parsed = parseTableRows(csvRows(text), text, "csv");
  if (parsed) return parsed;
  return {
    agendas: [],
    date: metadataDate(text),
    totalAppointments: 0,
    warnings: [],
    blockingErrors: ["FORMATO_CSV_NAO_RECONHECIDO"],
    source: "csv"
  };
}
function parseAgendaPdfText(text) {
  const batch = parseTableRows(pdfRows(text), text, "pdf");
  return batch ?? wrapSinglePdf(parseAgendaText(text));
}
export {
  parseAgendaCsv,
  parseAgendaPdfText
};
