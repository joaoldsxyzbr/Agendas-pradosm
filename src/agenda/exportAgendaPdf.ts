import type { StoreAgenda, StoreAppointment } from "./types";

type AgendaMeta = NonNullable<StoreAgenda["agenda"]>;

type PdfRow = {
  agendaDate: string[];
  supplier: string[];
  status: string[];
  type: string[];
  nfe: string[];
  orders: string[];
  exchanges: string[];
  statusColor: string;
  height: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 26;
const TABLE_TOP = 774;
const TABLE_HEADER_HEIGHT = 28;
const TABLE_BOTTOM = 34;
const ROW_FONT_SIZE = 7;
const STATUS_FONT_SIZE = 6.5;
const HEADER_FONT_SIZE = 6.4;
const ROW_LINE_HEIGHT = 8.6;

const STATUS_LABELS: Record<StoreAppointment["status"], string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não recebido",
  recusado: "Recusado",
};

const STATUS_COLORS: Record<StoreAppointment["status"], string> = {
  aguardando: "0.40 0.45 0.52",
  recebido: "0.09 0.48 0.31",
  nao_chegou: "0.55 0.38 0.00",
  recusado: "0.71 0.14 0.09",
};

const COLUMNS = [
  { key: "agendaDate", label: "Data agenda", width: 76 },
  { key: "supplier", label: "Fornecedor", width: 225 },
  { key: "status", label: "Status", width: 58 },
  { key: "type", label: "Tipo", width: 48 },
  { key: "nfe", label: "N° NFe", width: 55 },
  { key: "orders", label: "Pedidos", width: 44 },
  { key: "exchanges", label: "Trocas", width: 37 },
] as const;

const TABLE_WIDTH = COLUMNS.reduce((total, column) => total + column.width, 0);

const CP1252_SPECIAL: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function formatDateBr(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatDateTimeBr(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function fileDate(date: string) {
  return formatDateBr(date).replaceAll("/", "-");
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function agendaPdfFileName(agenda: AgendaMeta) {
  return `agenda-${safeFilePart(agenda.storeCode)}-${fileDate(agenda.date)}.pdf`;
}

function characterWidthFactor(char: string) {
  if ("W".includes(char)) return 0.95;
  if ("M".includes(char)) return 0.84;
  if ("@".includes(char)) return 1.02;
  if ("%".includes(char)) return 0.9;
  if ("mw".includes(char)) return 0.8;
  if ("ABCDEFGHJKLMNOPQRSTUVWXYZ".includes(char)) return 0.68;
  if ("ilI.,:;|!' \"()[]{}".includes(char)) return 0.3;
  if ("frt".includes(char)) return 0.4;
  return 0.56;
}

function textWidthApprox(text: string, fontSize: number) {
  return Array.from(text).reduce(
    (width, char) => width + fontSize * characterWidthFactor(char),
    0,
  );
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

function layoutRow(
  appointment: StoreAppointment,
  agendaDate: string,
): PdfRow {
  const date = [
    agendaDate,
    appointment.origin === "manual"
      ? appointment.startTime
      : `${appointment.startTime} às ${appointment.endTime}`,
  ];
  const supplier = wrapText(appointment.supplier, COLUMNS[1].width - 6);
  const status = [STATUS_LABELS[appointment.status]];
  const type = wrapText(appointment.type ?? "-", COLUMNS[3].width - 6);
  const nfe = wrapText(
    appointment.nfe.length ? appointment.nfe.join(", ") : "-",
    COLUMNS[4].width - 6,
  );
  const orders = wrapText(
    appointment.orders.length ? appointment.orders.join(", ") : "-",
    COLUMNS[5].width - 6,
  );
  const exchanges = [appointment.hasExchanges ? "Sim" : "Não"];

  const lineCount = Math.max(
    date.length,
    supplier.length,
    status.length,
    type.length,
    nfe.length,
    orders.length,
    exchanges.length,
  );

  return {
    agendaDate: date,
    supplier,
    status,
    type,
    nfe,
    orders,
    exchanges,
    statusColor: STATUS_COLORS[appointment.status],
    height: Math.max(23, lineCount * ROW_LINE_HEIGHT + 8),
  };
}

function paginateRows(rows: PdfRow[]) {
  const pages: PdfRow[][] = [];
  let page: PdfRow[] = [];
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
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      result += `\\${String.fromCharCode(byte)}`;
    } else if (byte >= 32 || byte === 9) {
      result += String.fromCharCode(byte);
    } else {
      result += " ";
    }
  }

  return result;
}

function textCommand(
  x: number,
  y: number,
  value: string,
  size = 7,
  font: "F1" | "F2" = "F1",
  color = "0.08 0.08 0.10",
) {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${number(x)} ${number(y)} Tm (${pdfText(value)}) Tj ET\n`;
}

function fillRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  return `q ${color} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f Q\n`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "0.55 0.55 0.58",
  width = 0.45,
) {
  return `q ${color} RG ${number(width)} w ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S Q\n`;
}

function pageHeader(
  agenda: AgendaMeta,
  total: number,
) {
  const date = formatDateBr(agenda.date);
  let content = "";

  content += textCommand(MARGIN, 814, "Prado Supermercados", 10, "F2");
  content += textCommand(MARGIN, 795, "Agendas de recebimento", 13, "F2");

  content += textCommand(
    190,
    814,
    `Filtros: Dia: ${date} | Filiais: ${agenda.storeCode} - ${agenda.storeName} | Doca: Todas`,
    6.5,
    "F2",
  );
  const dayStatus =
    agenda.dayStatus === "concluido" ? "Concluído" : "Em aberto";
  content += textCommand(
    190,
    801,
    `Status do dia: ${dayStatus}`,
    6.5,
    "F2",
    agenda.dayStatus === "concluido" ? "0.09 0.48 0.31" : "0.55 0.38 0.00",
  );
  if (agenda.dayStatus === "concluido" && agenda.completedBy?.name) {
    content += textCommand(
      305,
      801,
      `Concluído por: ${agenda.completedBy.name}`,
      6.2,
      "F1",
    );
  }
  content += textCommand(503, 795, `Total: ${total}`, 10.5, "F2");

  content += line(MARGIN, 786, PAGE_WIDTH - MARGIN, 786, "0.16 0.16 0.18", 1.2);
  return content;
}

function tableHeader() {
  let content = "";
  let x = MARGIN;

  content += line(MARGIN, TABLE_TOP, MARGIN + TABLE_WIDTH, TABLE_TOP, "0.18 0.18 0.20", 0.9);
  content += line(
    MARGIN,
    TABLE_TOP - TABLE_HEADER_HEIGHT,
    MARGIN + TABLE_WIDTH,
    TABLE_TOP - TABLE_HEADER_HEIGHT,
    "0.18 0.18 0.20",
    0.9,
  );

  for (const column of COLUMNS) {
    const labelLines = wrapText(column.label, column.width - 6, HEADER_FONT_SIZE);
    labelLines.forEach((label, index) => {
      content += textCommand(
        x + 3,
        TABLE_TOP - 11 - index * 7,
        label,
        HEADER_FONT_SIZE,
        "F2",
        "0.18 0.18 0.20",
      );
    });

    content += line(
      x,
      TABLE_TOP - TABLE_HEADER_HEIGHT,
      x,
      TABLE_TOP,
      "0.52 0.52 0.55",
      0.4,
    );
    x += column.width;
  }

  content += line(
    MARGIN + TABLE_WIDTH,
    TABLE_TOP - TABLE_HEADER_HEIGHT,
    MARGIN + TABLE_WIDTH,
    TABLE_TOP,
    "0.52 0.52 0.55",
    0.4,
  );

  return content;
}

function textBlockBaseline(
  rowTop: number,
  rowHeight: number,
  lineCount: number,
  fontSize: number,
  lineIndex: number,
) {
  const blockHeight = fontSize + Math.max(0, lineCount - 1) * ROW_LINE_HEIGHT;
  const topPadding = Math.max(0, (rowHeight - blockHeight) / 2);
  return rowTop - topPadding - fontSize * 0.8 - lineIndex * ROW_LINE_HEIGHT;
}

function tableRows(rows: PdfRow[]) {
  let content = "";
  let rowTop = TABLE_TOP - TABLE_HEADER_HEIGHT;

  rows.forEach((row, rowIndex) => {
    const rowBottom = rowTop - row.height;
    let x = MARGIN;

    if (rowIndex % 2 === 1) {
      content += fillRect(
        MARGIN,
        rowBottom,
        TABLE_WIDTH,
        row.height,
        "0.975 0.98 0.99",
      );
    }

    COLUMNS.forEach((column) => {
      const cellLines = row[column.key];
      const fontSize =
        column.key === "status" ? STATUS_FONT_SIZE : ROW_FONT_SIZE;

      cellLines.forEach((cellLine, index) => {
        content += textCommand(
          x + 3,
          textBlockBaseline(
            rowTop,
            row.height,
            cellLines.length,
            fontSize,
            index,
          ),
          cellLine,
          fontSize,
          column.key === "status" ? "F2" : "F1",
          column.key === "status" ? row.statusColor : "0.12 0.12 0.14",
        );
      });

      content += line(
        x,
        rowBottom,
        x,
        rowTop,
        "0.72 0.72 0.74",
        0.32,
      );
      x += column.width;
    });

    content += line(
      MARGIN + TABLE_WIDTH,
      rowBottom,
      MARGIN + TABLE_WIDTH,
      rowTop,
      "0.72 0.72 0.74",
      0.32,
    );
    content += line(
      MARGIN,
      rowBottom,
      MARGIN + TABLE_WIDTH,
      rowBottom,
      "0.72 0.72 0.74",
      0.32,
    );

    rowTop = rowBottom;
  });

  return content;
}

function pageContent(
  agenda: AgendaMeta,
  rows: PdfRow[],
  total: number,
  pageIndex: number,
  pageCount: number,
  generatedAt: string,
) {
  let content = "";
  content += pageHeader(agenda, total);
  content += tableHeader();
  content += tableRows(rows);

  content += textCommand(
    MARGIN,
    18,
    `Gerado em: ${generatedAt}`,
    6.2,
    "F1",
    "0.42 0.42 0.46",
  );
  content += textCommand(
    PAGE_WIDTH - MARGIN - 72,
    18,
    `Página ${pageIndex + 1} de ${pageCount}`,
    6.5,
    "F1",
    "0.42 0.42 0.46",
  );

  return content;
}

function binaryStringToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function buildAgendaPdf(
  agenda: AgendaMeta,
  appointments: StoreAppointment[],
) {
  const sorted = [...appointments].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.protocol.localeCompare(b.protocol),
  );
  const agendaDate = formatDateBr(agenda.date);
  const generatedAt = formatDateTimeBr(new Date());
  const pages = paginateRows(
    sorted.map((appointment) => layoutRow(appointment, agendaDate)),
  );
  const objects: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageObjectIds: number[] = [];

  pages.forEach((rows, pageIndex) => {
    const pageObjectId = 5 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const page = pageContent(
      agenda,
      rows,
      sorted.length,
      pageIndex,
      pages.length,
      generatedAt,
    );

    pageObjectIds.push(pageObjectId);
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] =
      `<< /Length ${page.length} >>\nstream\n${page}endstream`;
  });

  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageObjectIds.length} >>`;

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

  output +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n` +
    `${xrefOffset}\n%%EOF\n`;

  return binaryStringToBytes(output);
}

export function downloadAgendaPdf(
  agenda: AgendaMeta,
  appointments: StoreAppointment[],
) {
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
