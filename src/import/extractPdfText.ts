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
  0.795,
  0.88,
] as const;

const LINE_TOLERANCE = 2.5;

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

function groupLines(items: unknown[]): TextLine[] {
  const lines: TextLine[] = [];

  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;

    const x = Number(item.transform[4]);
    const y = Number(item.transform[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    let line = lines.find(
      (candidate) => Math.abs(candidate.y - y) <= LINE_TOLERANCE,
    );

    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }

    line.items.push({ str: item.str.trim(), x, y });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => ({
      ...line,
      items: line.items.sort((a, b) => a.x - b.x),
    }));
}

function columnForX(x: number, pageWidth: number) {
  const ratio = pageWidth > 0 ? x / pageWidth : 0;
  let column = 0;

  for (let index = 1; index < COLUMN_START_RATIOS.length; index += 1) {
    if (ratio >= COLUMN_START_RATIOS[index]) column = index;
    else break;
  }

  return column;
}

function lineToTsv(line: TextLine, pageWidth: number) {
  const cells = Array.from({ length: 10 }, () => [] as string[]);

  for (const item of line.items) {
    cells[columnForX(item.x, pageWidth)].push(item.str);
  }

  return cells
    .map((parts) => parts.join(" ").replace(/\s+/g, " ").trim())
    .join("\t");
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
      const lines = groupLines(textContent.items as unknown[]);

      pages.push(
        lines
          .map((line) => lineToTsv(line, viewport.width))
          .filter((line) => line.replace(/\t/g, "").trim())
          .join("\n"),
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
