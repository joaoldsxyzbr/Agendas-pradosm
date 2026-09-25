import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const COLUMN_START_RATIOS = [
  0,
  0.105,
  0.225,
  0.405,
  0.465,
  0.52,
  0.595,
  0.715,
  0.785,
  0.855,
] as const;

const LINE_TOLERANCE = 2.5;
const SINGLE_ROW_HALF_HEIGHT = 14;

type PositionedText = {
  str: string;
  x: number;
  y: number;
};

type TextLine = {
  y: number;
  items: PositionedText[];
};

export class PdfExtractionError extends Error {
  readonly code = "PDF_INVALIDO";

  constructor() {
    super("PDF_INVALIDO");
    this.name = "PdfExtractionError";
  }
}

function isTextItem(
  item: unknown,
): item is { str: string; transform: ArrayLike<number> } {
  if (!item || typeof item !== "object") return false;
  const candidate = item as { str?: unknown; transform?: unknown };
  return (
    typeof candidate.str === "string" &&
    candidate.transform !== null &&
    typeof candidate.transform === "object"
  );
}

function toPositionedItems(items: unknown[]): PositionedText[] {
  const positioned: PositionedText[] = [];

  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;

    const x = Number(item.transform[4]);
    const y = Number(item.transform[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    positioned.push({ str: item.str.trim(), x, y });
  }

  return positioned;
}

function groupPositionedLines(items: PositionedText[]): TextLine[] {
  const lines: TextLine[] = [];

  for (const item of items) {
    let line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE,
    );

    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }

    line.items.push(item);
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => ({
      ...line,
      items: line.items.sort((a, b) => a.x - b.x),
    }));
}

function fallbackBoundaries(pageWidth: number) {
  return COLUMN_START_RATIOS.slice(1).map((ratio) => ratio * pageWidth);
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectColumnBoundaries(lines: TextLine[], pageWidth: number) {
  const header = lines.find((line) => {
    const text = normalizeHeader(line.items.map((item) => item.str).join(" "));
    return (
      text.includes("protocolo") &&
      text.includes("data") &&
      text.includes("fornecedor") &&
      text.includes("itens") &&
      text.includes("paletes") &&
      text.includes("tipo") &&
      text.includes("pedidos")
    );
  });

  if (!header) return fallbackBoundaries(pageWidth);

  const starts = [
    header.items.find((item) => normalizeHeader(item.str) === "protocolo")?.x,
    header.items.find((item) => normalizeHeader(item.str) === "data")?.x,
    header.items.find((item) => normalizeHeader(item.str) === "fornecedor")?.x,
    header.items.find((item) => normalizeHeader(item.str) === "itens")?.x,
    header.items.find((item) => normalizeHeader(item.str).startsWith("vol"))?.x,
    header.items.find((item) => normalizeHeader(item.str) === "paletes")?.x,
    header.items.find((item) => normalizeHeader(item.str) === "carga")?.x,
    header.items.find((item) => normalizeHeader(item.str) === "tipo")?.x,
    header.items.find((item) => {
      const value = normalizeHeader(item.str);
      return (
        value === "nfe" ||
        value.startsWith("n°") ||
        value.startsWith("nº")
      );
    })?.x,
    header.items.find((item) => normalizeHeader(item.str) === "pedidos")?.x,
  ];

  if (starts.some((value) => value === undefined)) {
    return fallbackBoundaries(pageWidth);
  }

  const numericStarts = starts as number[];
  return numericStarts.slice(1).map((start) => Math.max(0, start - 4));
}

function columnForX(x: number, pageWidth: number, boundaries?: number[]) {
  const resolvedBoundaries = boundaries ?? fallbackBoundaries(pageWidth);
  let column = 0;

  for (const boundary of resolvedBoundaries) {
    if (x >= boundary) column += 1;
    else break;
  }

  return Math.min(column, 9);
}

function lineToTsv(
  line: TextLine,
  pageWidth: number,
  boundaries?: number[],
) {
  const cells = Array.from({ length: 10 }, () => [] as string[]);

  for (const item of line.items) {
    cells[columnForX(item.x, pageWidth, boundaries)].push(item.str);
  }

  return cells
    .map((parts) => parts.join(" ").replace(/\s+/g, " ").trim())
    .join("\t");
}

function rowToTsv(
  items: PositionedText[],
  pageWidth: number,
  boundaries?: number[],
) {
  const cells = Array.from({ length: 10 }, () => [] as PositionedText[]);

  for (const item of items) {
    cells[columnForX(item.x, pageWidth, boundaries)].push(item);
  }

  return cells
    .map((cell) =>
      cell
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join("\t");
}

function structuredPageText(items: unknown[], pageWidth: number) {
  const positioned = toPositionedItems(items);
  const lines = groupPositionedLines(positioned);
  const boundaries = detectColumnBoundaries(lines, pageWidth);
  const anchors = positioned
    .filter(
      (item) =>
        /^\d{6,20}$/.test(item.str) &&
        columnForX(item.x, pageWidth, boundaries) === 0,
    )
    .sort((a, b) => b.y - a.y);

  if (anchors.length === 0) {
    return lines
      .map((line) => lineToTsv(line, pageWidth, boundaries))
      .filter((line) => line.replace(/\t/g, "").trim())
      .join("\n");
  }

  const bands = anchors.map((anchor, index) => {
    const previous = anchors[index - 1];
    const next = anchors[index + 1];

    if (!previous && !next) {
      return {
        anchor,
        upper: anchor.y + SINGLE_ROW_HALF_HEIGHT,
        lower: anchor.y - SINGLE_ROW_HALF_HEIGHT,
      };
    }

    const upper = previous
      ? (previous.y + anchor.y) / 2
      : anchor.y + (anchor.y - next.y) / 2;
    const lower = next
      ? (anchor.y + next.y) / 2
      : anchor.y - (previous.y - anchor.y) / 2;

    return { anchor, upper, lower };
  });

  const belongsToRow = (item: PositionedText) =>
    bands.some((band) => item.y <= band.upper && item.y >= band.lower);

  const entries: Array<{ y: number; text: string }> = groupPositionedLines(
    positioned.filter((item) => !belongsToRow(item)),
  ).map((line) => ({
    y: line.y,
    text: lineToTsv(line, pageWidth, boundaries),
  }));

  for (const band of bands) {
    const rowItems = positioned.filter(
      (item) => item.y <= band.upper && item.y >= band.lower,
    );
    entries.push({
      y: band.anchor.y,
      text: rowToTsv(rowItems, pageWidth, boundaries),
    });
  }

  return entries
    .sort((a, b) => b.y - a.y)
    .map((entry) => entry.text)
    .filter((line) => line.replace(/\t/g, "").trim())
    .join("\n");
}

export async function extractPdfText(file: File): Promise<string> {
  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    loadingTask = getDocument({ data });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      pages.push(
        structuredPageText(textContent.items as unknown[], viewport.width),
      );

      page.cleanup();
    }

    return pages.join("\n").replace(/\r/g, "").trim();
  } catch {
    throw new PdfExtractionError();
  } finally {
    await loadingTask?.destroy();
  }
}
