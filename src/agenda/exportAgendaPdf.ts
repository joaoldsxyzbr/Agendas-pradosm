import type { StoreAgenda, StoreAppointment } from "./types";

type AgendaMeta = NonNullable<StoreAgenda["agenda"]>;

type PdfRow = {
  protocol: string[];
  agendaDate: string[];
  supplier: string[];
  type: string[];
  nfe: string[];
  orders: string[];
  status: string;
  statusColor: string;
  height: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 26;
const TABLE_TOP = 774;
const TABLE_HEADER_HEIGHT = 28;
const TABLE_BOTTOM = 34;
const ROW_FONT_SIZE = 6;
const ROW_LINE_HEIGHT = 7.4;

const STATUS_LABELS: Record<StoreAppointment["status"], string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não chegou",
  recusado: "Recusado",
};

const STATUS_COLORS: Record<StoreAppointment["status"], string> = {
  aguardando: "0.40 0.45 0.52",
  recebido: "0.09 0.48 0.31",
  nao_chegou: "0.55 0.38 0.00",
  recusado: "0.71 0.14 0.09",
};

const COLUMNS = [
  { key: "protocol", label: "Protocolo", width: 58 },
  { key: "agendaDate", label: "Data agenda", width: 78 },
  { key: "supplier", label: "Fornecedor", width: 238 },
  { key: "type", label: "Tipo", width: 55 },
  { key: "nfe", label: "N° NFe", width: 64 },
  { key: "orders", label: "Pedidos", width: 50 },
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

function layoutRow(
  appointment: StoreAppointment,
  agendaDate: string,
): PdfRow {
  const protocol = [appointment.protocol];
  const date = [
    agendaDate,
    appointment.origin === "manual"
      ? appointment.startTime
      : `${appointment.startTime} às ${appointment.endTime}`,
  ];
  const supplier = wrapText(appointment.supplier, COLUMNS[2].width - 6);
  const type = wrapText(appointment.type ?? "-", COLUMNS[3].width - 6);
  const nfe = wrapText(
    appointment.nfe.length ? appointment.nfe.join(", ") : "-",
    COLUMNS[4].width - 6,
  );
  const orders = wrapText(
    appointment.orders.length ? appointment.orders.join(", ") : "-",
    COLUMNS[5].width - 6,
  );

  const lineCount = Math.max(
    protocol.length,
    date.length,
    supplier.length + 1,
    type.length,
    nfe.length,
    orders.length,
  );

  return {
    protocol,
    agendaDate: date,
    supplier,
    type,
    nfe,
    orders,
    status: STATUS_LABELS[appointment.status],
    statusColor: STATUS_COLORS[appointment.status],
    height: Math.max(19, lineCount * ROW_LINE_HEIGHT + 6),
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
  content += textCommand(190, 801, "Busca:", 6.5, "F1");
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
    const labelLines = wrapText(column.label, column.width - 5, 5.8);
    labelLines.forEach((label, index) => {
      content += textCommand(
        x + 3,
        TABLE_TOP - 11 - index * 7,
        label,
        5.8,
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

function tableRows(rows: PdfRow[]) {
  let content = "";
  let rowTop = TABLE_TOP - TABLE_HEADER_HEIGHT;

  for (const row of rows) {
    const rowBottom = rowTop - row.height;
    let x = MARGIN;

    COLUMNS.forEach((column) => {
      const cellLines = row[column.key];

      cellLines.forEach((cellLine, index) => {
        content += textCommand(
          x + 3,
          rowTop - 9 - index * ROW_LINE_HEIGHT,
          cellLine,
          ROW_FONT_SIZE,
          "F1",
          "0.12 0.12 0.14",
        );
      });

      if (column.key === "supplier") {
        content += textCommand(
          x + 3,
          rowTop - 9 - row.supplier.length * ROW_LINE_HEIGHT,
          row.status,
          5.8,
          "F2",
          row.statusColor,
        );
      }

      content += line(
        x,
        rowBottom,
        x,
        rowTop,
        "0.62 0.62 0.64",
        0.35,
      );
      x += column.width;
    });

    content += line(
      MARGIN + TABLE_WIDTH,
      rowBottom,
      MARGIN + TABLE_WIDTH,
      rowTop,
      "0.62 0.62 0.64",
      0.35,
    );
    content += line(
      MARGIN,
      rowBottom,
      MARGIN + TABLE_WIDTH,
      rowBottom,
      "0.62 0.62 0.64",
      0.35,
    );

    rowTop = rowBottom;
  }

  return content;
}

function pageContent(
  agenda: AgendaMeta,
  rows: PdfRow[],
  total: number,
  pageIndex: number,
  pageCount: number,
) {
  let content = "";
  content += pageHeader(agenda, total);
  content += tableHeader();
  content += tableRows(rows);

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
