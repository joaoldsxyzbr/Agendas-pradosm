// Gerador de PDF da agenda de recebimento, portado do frontend operacional
// (frontend/agenda/exportAgendaPdf.js). Sem dependencias externas.

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 26;
const TABLE_TOP = 768;
const TABLE_HEADER_HEIGHT = 28;
const TABLE_BOTTOM = 58;
const ROW_FONT_SIZE = 7;
const STATUS_FONT_SIZE = 6.5;
const HEADER_FONT_SIZE = 6.4;
const HEADER_BRAND_FONT_SIZE = 11.2;
const HEADER_META_FONT_SIZE = 9.2;
const HEADER_META_X = 150;
const HEADER_TITLE_FONT_SIZE = 16.5;
const HEADER_SECONDARY_FONT_SIZE = 8.4;
const HEADER_STATUS_X = 240;
const TOTAL_FONT_SIZE = 8.2;
const ROW_LINE_HEIGHT = 8.6;

export type PdfAgenda = {
  storeCode: string;
  storeName: string;
  date: string;
  dayStatus: string;
  completedBy?: { name: string } | null;
};
export type PdfAppointment = {
  supplier: string;
  protocol: string;
  status: string;
  type?: string | null;
  startTime: string;
  endTime: string;
  origin?: string;
  hasExchanges: boolean;
  nfe?: string[];
  orders?: string[];
};

type Status = "aguardando" | "recebido" | "nao_chegou" | "recusado";
const STATUS_LABELS: Record<Status, string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "N\u00E3o recebido",
  recusado: "Recusado"
};
const STATUS_COLORS: Record<Status, string> = {
  aguardando: "0.40 0.45 0.52",
  recebido: "0.09 0.48 0.31",
  nao_chegou: "0.55 0.38 0.00",
  recusado: "0.71 0.14 0.09"
};
type ColumnKey = "agendaDate" | "supplier" | "status" | "type" | "nfe" | "orders" | "exchanges";
const COLUMNS: { key: ColumnKey; label: string; width: number }[] = [
  { key: "agendaDate", label: "Data agenda", width: 76 },
  { key: "supplier", label: "Fornecedor", width: 225 },
  { key: "status", label: "Status", width: 58 },
  { key: "type", label: "Tipo", width: 48 },
  { key: "nfe", label: "N\u00B0 NFe", width: 55 },
  { key: "orders", label: "Pedidos", width: 44 },
  { key: "exchanges", label: "Trocas", width: 37 }
];
const TABLE_WIDTH = COLUMNS.reduce((total, column) => total + column.width, 0);

const CP1252_SPECIAL: Record<string, number> = {
  "\u20AC": 128, "\u201A": 130, "\u0192": 131, "\u201E": 132, "\u2026": 133,
  "\u2020": 134, "\u2021": 135, "\u02C6": 136, "\u2030": 137, "\u0160": 138,
  "\u2039": 139, "\u0152": 140, "\u017D": 142, "\u2018": 145, "\u2019": 146,
  "\u201C": 147, "\u201D": 148, "\u2022": 149, "\u2013": 150, "\u2014": 151,
  "\u02DC": 152, "\u2122": 153, "\u0161": 154, "\u203A": 155, "\u0153": 156,
  "\u017E": 158, "\u0178": 159
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status as Status] ?? status;
}
function statusColor(status: string): string {
  return STATUS_COLORS[status as Status] ?? "0.12 0.12 0.14";
}
function formatDateBr(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}
function formatDateTimeBr(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function fileDate(date: string) {
  return formatDateBr(date).replaceAll("/", "-");
}
function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}
export function agendaPdfFileName(agenda: PdfAgenda) {
  return `agenda-${safeFilePart(agenda.storeCode)}-${fileDate(agenda.date)}.pdf`;
}
function characterWidthFactor(char: string) {
  if ("W".includes(char)) return 0.95;
  if ("M".includes(char)) return 0.84;
  if ("@".includes(char)) return 1.02;
  if ("%".includes(char)) return 0.9;
  if ("mw".includes(char)) return 0.8;
  if ("ABCDEFGHJKLMNOPQRSTUVWXYZ".includes(char)) return 0.68;
  if ("ilI.,:;|!' \"()[]{}`".includes(char)) return 0.3;
  if ("frt".includes(char)) return 0.4;
  return 0.56;
}
function textWidthApprox(text: string, fontSize: number) {
  return Array.from(text).reduce((width, char) => width + fontSize * characterWidthFactor(char), 0);
}
function fitTextFontSize(text: string, maxWidth: number, preferredSize: number, minimumSize: number) {
  const width = textWidthApprox(text, preferredSize);
  if (width <= maxWidth) return preferredSize;
  return Math.max(minimumSize, preferredSize * (maxWidth / width));
}
function splitWordToWidth(word: string, maxWidth: number, fontSize: number) {
  const chunks: string[] = [];
  let current = "";
  for (const char of Array.from(word)) {
    const candidate = `${current}${char}`;
    if (current && textWidthApprox(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [word];
}
function wrapText(value: string, maxWidth: number, fontSize = ROW_FONT_SIZE) {
  const text = value.trim() || "-";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (textWidthApprox(word, fontSize) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      const chunks = splitWordToWidth(word, maxWidth, fontSize);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? "";
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidthApprox(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}
type LayoutRow = Record<ColumnKey, string[]> & { statusColor: string; height: number };
function layoutRow(appointment: PdfAppointment, agendaDate: string): LayoutRow {
  const date = [
    agendaDate,
    appointment.origin === "manual" ? appointment.startTime : `${appointment.startTime} \u00E0s ${appointment.endTime}`
  ];
  const supplier = wrapText(appointment.supplier, (COLUMNS.find(c => c.key === "supplier")?.width ?? 225) - 6);
  const status = [statusLabel(appointment.status)];
  const type = wrapText(appointment.type ?? "-", (COLUMNS.find(c => c.key === "type")?.width ?? 48) - 6);
  const nfe = wrapText(
    appointment.nfe?.length ? appointment.nfe.join(", ") : "-",
    (COLUMNS.find(c => c.key === "nfe")?.width ?? 55) - 6
  );
  const orders = wrapText(
    appointment.orders?.length ? appointment.orders.join(", ") : "-",
    (COLUMNS.find(c => c.key === "orders")?.width ?? 44) - 6
  );
  const exchanges = [appointment.hasExchanges ? "Sim" : "N\u00E3o"];
  const lineCount = Math.max(
    date.length, supplier.length, status.length, type.length, nfe.length, orders.length, exchanges.length
  );
  return {
    agendaDate: date, supplier, status, type, nfe, orders, exchanges,
    statusColor: statusColor(appointment.status),
    height: Math.max(23, lineCount * ROW_LINE_HEIGHT + 8)
  };
}
function paginateRows(rows: LayoutRow[]) {
  const pages: LayoutRow[][] = [];
  let page: LayoutRow[] = [];
  let remaining = TABLE_TOP - TABLE_HEADER_HEIGHT - TABLE_BOTTOM;
  for (const row of rows) {
    if (page.length > 0 && row.height > remaining) {
      pages.push(page);
      page = [];
      remaining = TABLE_TOP - TABLE_HEADER_HEIGHT - TABLE_BOTTOM;
    }
    page.push(row);
    remaining -= row.height;
  }
  if (page.length > 0 || pages.length === 0) pages.push(page);
  return pages;
}
function number(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
function winAnsiByte(char: string) {
  const special = CP1252_SPECIAL[char];
  if (special !== undefined) return special;
  const code = char.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 255) return code;
  return 63;
}
function pdfText(value: string) {
  const bytes = Array.from(value.normalize("NFC"), winAnsiByte);
  let result = "";
  for (const byte of bytes) {
    if (byte === 40 || byte === 41 || byte === 92) {
      result += `\\${String.fromCharCode(byte)}`;
    } else if (byte >= 32 || byte === 9) {
      result += String.fromCharCode(byte);
    } else {
      result += " ";
    }
  }
  return result;
}
function textCommand(x: number, y: number, value: string, size = 7, font = "F1", color = "0.08 0.08 0.10") {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${number(x)} ${number(y)} Tm (${pdfText(value)}) Tj ET\n`;
}
function fillRect(x: number, y: number, width: number, height: number, color: string) {
  return `q ${color} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f Q\n`;
}
function line(x1: number, y1: number, x2: number, y2: number, color = "0.55 0.55 0.58", width = 0.45) {
  return `q ${color} RG ${number(width)} w ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S Q\n`;
}
function pageHeader(agenda: PdfAgenda) {
  const date = formatDateBr(agenda.date);
  let content = "";
  content += textCommand(MARGIN, 814, "Prado Supermercados", HEADER_BRAND_FONT_SIZE, "F2");
  const filterText = `Filtros: Dia: ${date} | Filiais: ${agenda.storeCode} - ${agenda.storeName} | Doca: Todas`;
  const filterFontSize = fitTextFontSize(filterText, PAGE_WIDTH - MARGIN - HEADER_META_X, HEADER_META_FONT_SIZE, 7.4);
  content += textCommand(HEADER_META_X, 814, filterText, filterFontSize, "F2");
  content += textCommand(MARGIN, 791, "Agendas de recebimento", HEADER_TITLE_FONT_SIZE, "F2");
  content += line(228, 783, 228, 801, "0.68 0.68 0.72", 0.55);
  const dayStatus = agenda.dayStatus === "concluido" ? "Conclu\u00EDdo" : "Em aberto";
  content += textCommand(
    HEADER_STATUS_X, 793, `Status do dia: ${dayStatus}`, HEADER_SECONDARY_FONT_SIZE, "F2",
    agenda.dayStatus === "concluido" ? "0.09 0.48 0.31" : "0.55 0.38 0.00"
  );
  if (agenda.dayStatus === "concluido" && agenda.completedBy?.name) {
    content += textCommand(365, 793, `Conclu\u00EDdo por: ${agenda.completedBy.name}`, 7, "F1");
  }
  content += line(MARGIN, 777, PAGE_WIDTH - MARGIN, 777, "0.16 0.16 0.18", 1.2);
  return content;
}
function tableHeader() {
  let content = "";
  let x = MARGIN;
  content += line(MARGIN, TABLE_TOP, MARGIN + TABLE_WIDTH, TABLE_TOP, "0.18 0.18 0.20", 0.9);
  content += line(
    MARGIN, TABLE_TOP - TABLE_HEADER_HEIGHT, MARGIN + TABLE_WIDTH, TABLE_TOP - TABLE_HEADER_HEIGHT,
    "0.18 0.18 0.20", 0.9
  );
  for (const column of COLUMNS) {
    const labelLines = wrapText(column.label, column.width - 6, HEADER_FONT_SIZE);
    labelLines.forEach((label, index) => {
      content += textCommand(
        x + 3, TABLE_TOP - 11 - index * 7, label, HEADER_FONT_SIZE, "F2", "0.18 0.18 0.20"
      );
    });
    content += line(x, TABLE_TOP - TABLE_HEADER_HEIGHT, x, TABLE_TOP, "0.44 0.44 0.48", 0.5);
    x += column.width;
  }
  content += line(
    MARGIN + TABLE_WIDTH, TABLE_TOP - TABLE_HEADER_HEIGHT, MARGIN + TABLE_WIDTH, TABLE_TOP,
    "0.44 0.44 0.48", 0.5
  );
  return content;
}
function textBlockBaseline(rowTop: number, rowHeight: number, lineCount: number, fontSize: number, lineIndex: number) {
  const blockHeight = fontSize + Math.max(0, lineCount - 1) * ROW_LINE_HEIGHT;
  const topPadding = Math.max(0, (rowHeight - blockHeight) / 2);
  return rowTop - topPadding - fontSize * 0.8 - lineIndex * ROW_LINE_HEIGHT;
}
function tableRows(rows: LayoutRow[]) {
  let content = "";
  let rowTop = TABLE_TOP - TABLE_HEADER_HEIGHT;
  rows.forEach((row, rowIndex) => {
    const rowBottom = rowTop - row.height;
    let x = MARGIN;
    if (rowIndex % 2 === 1) {
      content += fillRect(MARGIN, rowBottom, TABLE_WIDTH, row.height, "0.975 0.98 0.99");
    }
    for (const column of COLUMNS) {
      const cellLines = row[column.key];
      const fontSize = column.key === "status" ? STATUS_FONT_SIZE : ROW_FONT_SIZE;
      cellLines.forEach((cellLine, index) => {
        content += textCommand(
          x + 3,
          textBlockBaseline(rowTop, row.height, cellLines.length, fontSize, index),
          cellLine,
          fontSize,
          column.key === "status" ? "F2" : "F1",
          column.key === "status" ? row.statusColor : "0.12 0.12 0.14"
        );
      });
      content += line(x, rowBottom, x, rowTop, "0.58 0.58 0.62", 0.45);
      x += column.width;
    }
    content += line(MARGIN + TABLE_WIDTH, rowBottom, MARGIN + TABLE_WIDTH, rowTop, "0.58 0.58 0.62", 0.45);
    content += line(MARGIN, rowBottom, MARGIN + TABLE_WIDTH, rowBottom, "0.58 0.58 0.62", 0.45);
    rowTop = rowBottom;
  });
  return { content, bottomY: rowTop };
}
function totalSummary(total: number, rowBottom: number) {
  const label = `Total: ${total}`;
  const summaryLineY = rowBottom - 8;
  const baselineY = rowBottom - 22;
  const textX = MARGIN + TABLE_WIDTH - textWidthApprox(label, TOTAL_FONT_SIZE);
  let content = "";
  content += line(MARGIN, summaryLineY, MARGIN + TABLE_WIDTH, summaryLineY, "0.32 0.32 0.36", 0.65);
  content += textCommand(textX, baselineY, label, TOTAL_FONT_SIZE, "F2", "0.12 0.12 0.14");
  return content;
}
function pageContent(agenda: PdfAgenda, rows: LayoutRow[], total: number, pageIndex: number, pageCount: number, generatedAt: string) {
  let content = "";
  content += pageHeader(agenda);
  content += tableHeader();
  const table = tableRows(rows);
  content += table.content;
  if (pageIndex === pageCount - 1) {
    content += totalSummary(total, table.bottomY);
  }
  content += textCommand(MARGIN, 18, `Gerado em: ${generatedAt}`, 6.2, "F1", "0.42 0.42 0.46");
  content += textCommand(PAGE_WIDTH - MARGIN - 72, 18, `P\u00E1gina ${pageIndex + 1} de ${pageCount}`, 6.5, "F1", "0.42 0.42 0.46");
  return content;
}
function binaryStringToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 255;
  }
  return bytes;
}
export function buildAgendaPdf(agenda: PdfAgenda, appointments: PdfAppointment[]): Uint8Array {
  const sorted = [...appointments].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.protocol.localeCompare(b.protocol)
  );
  const agendaDate = formatDateBr(agenda.date);
  const generatedAt = formatDateTimeBr(new Date());
  const pages = paginateRows(sorted.map(appointment => layoutRow(appointment, agendaDate)));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const pageObjectIds: number[] = [];
  pages.forEach((rows, pageIndex) => {
    const pageObjectId = 5 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const page = pageContent(agenda, rows, sorted.length, pageIndex, pages.length, generatedAt);
    pageObjectIds.push(pageObjectId);
    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${page.length} >>\nstream\n${page}endstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = new Array(objects.length).fill(0);
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    offsets[objectId] = output.length;
    output += `${objectId} 0 obj\n${objects[objectId]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n`;
  output += "0000000000 65535 f \n";
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    output += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return binaryStringToBytes(output);
}
export function downloadAgendaPdf(agenda: PdfAgenda, appointments: PdfAppointment[]) {
  const bytes = buildAgendaPdf(agenda, appointments);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = agendaPdfFileName(agenda);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
