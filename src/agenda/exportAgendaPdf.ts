import type { StoreAgenda, StoreAppointment } from "./types";

type AgendaMeta = NonNullable<StoreAgenda["agenda"]>;

type PdfRow = {
  time: string[];
  supplier: string[];
  protocol: string[];
  type: string[];
  status: string[];
  height: number;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 34;
const TABLE_TOP = 456;
const TABLE_HEADER_HEIGHT = 22;
const TABLE_BOTTOM = 42;
const ROW_FONT_SIZE = 8;
const ROW_LINE_HEIGHT = 9.5;

const STATUS_LABELS: Record<StoreAppointment["status"], string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não chegou",
  recusado: "Recusado",
};

const COLUMNS = [
  { key: "time", label: "Horário", width: 82 },
  { key: "supplier", label: "Fornecedor", width: 335 },
  { key: "protocol", label: "Protocolo", width: 92 },
  { key: "type", label: "Tipo", width: 125 },
  { key: "status", label: "Status", width: 105 },
] as const;

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

function fileDate(date: string) {
  return formatDateBr(date).replaceAll("/", "-");
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function agendaPdfFileName(agenda: AgendaMeta) {
  return `agenda-${safeFilePart(agenda.storeCode)}-${fileDate(agenda.date)}.pdf`;
}

function textWidthApprox(text: string, fontSize: number) {
  return Array.from(text).reduce((width, char) => {
    if ("MW@#%".includes(char)) return width + fontSize * 0.72;
    if ("ilI.,:;|!' ".includes(char)) return width + fontSize * 0.3;
    return width + fontSize * 0.52;
  }, 0);
}

function wrapText(value: string, maxWidth: number, fontSize = ROW_FONT_SIZE) {
  const text = value.trim() || "-";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || textWidthApprox(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function layoutRow(appointment: StoreAppointment): PdfRow {
  const time = [`${appointment.startTime} - ${appointment.endTime}`];
  const supplier = wrapText(appointment.supplier, COLUMNS[1].width - 10);
  const protocol = [appointment.protocol];
  const type = wrapText(appointment.type ?? "-", COLUMNS[3].width - 10);
  const status = [STATUS_LABELS[appointment.status]];
  const lineCount = Math.max(
    time.length,
    supplier.length,
    protocol.length,
    type.length,
    status.length,
  );

  return {
    time,
    supplier,
    protocol,
    type,
    status,
    height: Math.max(20, lineCount * ROW_LINE_HEIGHT + 7),
  };
}

function countStatus(
  appointments: StoreAppointment[],
  status: StoreAppointment["status"],
) {
  return appointments.filter((appointment) => appointment.status === status).length;
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
  size = 9,
  font: "F1" | "F2" = "F1",
  color = "0.09 0.13 0.20",
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

function strokeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color = "0.82 0.86 0.91",
) {
  return `q ${color} RG 0.6 w ${number(x)} ${number(y)} ${number(width)} ${number(height)} re S Q\n`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "0.88 0.91 0.95",
) {
  return `q ${color} RG 0.5 w ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S Q\n`;
}

function summaryCommand(
  label: string,
  value: number,
  x: number,
  width: number,
) {
  const y = 493;
  const height = 40;
  return (
    fillRect(x, y, width, height, "0.96 0.97 0.99") +
    strokeRect(x, y, width, height) +
    textCommand(x + 8, y + 24, String(value), 12, "F2") +
    textCommand(x + 8, y + 9, label, 7.5, "F1", "0.38 0.44 0.53")
  );
}

function pageContent(
  agenda: AgendaMeta,
  appointments: StoreAppointment[],
  rows: PdfRow[],
  pageIndex: number,
  pageCount: number,
) {
  let content = "";

  content += fillRect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8, "0.96 0.77 0.19");
  content += textCommand(MARGIN, 557, "Agenda de Recebimento", 16, "F2", "0.05 0.24 0.47");
  content += textCommand(
    MARGIN,
    537,
    `${agenda.storeCode} - ${agenda.storeName}  |  ${formatDateBr(agenda.date)}`,
    10,
    "F1",
    "0.28 0.34 0.43",
  );

  const summaryGap = 8;
  const summaryWidth =
    (PAGE_WIDTH - MARGIN * 2 - summaryGap * 4) / 5;
  const summary = [
    ["Total", appointments.length],
    ["Aguardando", countStatus(appointments, "aguardando")],
    ["Recebidos", countStatus(appointments, "recebido")],
    ["Não chegaram", countStatus(appointments, "nao_chegou")],
    ["Recusados", countStatus(appointments, "recusado")],
  ] as const;

  summary.forEach(([label, value], index) => {
    content += summaryCommand(
      label,
      value,
      MARGIN + index * (summaryWidth + summaryGap),
      summaryWidth,
    );
  });

  let x = MARGIN;
  content += fillRect(
    MARGIN,
    TABLE_TOP - TABLE_HEADER_HEIGHT,
    COLUMNS.reduce((total, column) => total + column.width, 0),
    TABLE_HEADER_HEIGHT,
    "0.05 0.24 0.47",
  );

  for (const column of COLUMNS) {
    content += textCommand(
      x + 5,
      TABLE_TOP - 15,
      column.label,
      7.5,
      "F2",
      "1 1 1",
    );
    x += column.width;
  }

  let rowTop = TABLE_TOP - TABLE_HEADER_HEIGHT;
  rows.forEach((row, rowIndex) => {
    const rowBottom = rowTop - row.height;

    if (rowIndex % 2 === 1) {
      content += fillRect(
        MARGIN,
        rowBottom,
        COLUMNS.reduce((total, column) => total + column.width, 0),
        row.height,
        "0.985 0.989 0.995",
      );
    }

    content += strokeRect(
      MARGIN,
      rowBottom,
      COLUMNS.reduce((total, column) => total + column.width, 0),
      row.height,
      "0.88 0.91 0.95",
    );

    let cellX = MARGIN;
    COLUMNS.forEach((column, columnIndex) => {
      const cellLines = row[column.key];
      cellLines.forEach((cellLine, lineIndex) => {
        content += textCommand(
          cellX + 5,
          rowTop - 13 - lineIndex * ROW_LINE_HEIGHT,
          cellLine,
          ROW_FONT_SIZE,
          column.key === "status" ? "F2" : "F1",
        );
      });

      if (columnIndex < COLUMNS.length - 1) {
        content += line(
          cellX + column.width,
          rowBottom,
          cellX + column.width,
          rowTop,
        );
      }

      cellX += column.width;
    });

    rowTop = rowBottom;
  });

  content += textCommand(
    PAGE_WIDTH - MARGIN - 72,
    20,
    `Página ${pageIndex + 1} de ${pageCount}`,
    7.5,
    "F1",
    "0.45 0.50 0.58",
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
  const pages = paginateRows(sorted.map(layoutRow));
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
    const content = pageContent(
      agenda,
      sorted,
      rows,
      pageIndex,
      pages.length,
    );

    pageObjectIds.push(pageObjectId);
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] =
      `<< /Length ${content.length} >>\nstream\n${content}endstream`;
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
