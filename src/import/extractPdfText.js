import initLiteParse, { LiteParse } from "@llamaindex/liteparse-wasm";
let initPromise = null;
class PdfExtractionError extends Error {
  code = "PDF_INVALIDO";
  constructor() {
    super("PDF_INVALIDO");
    this.name = "PdfExtractionError";
  }
}
function ensureLiteParse() {
  initPromise ??= Promise.resolve(initLiteParse());
  return initPromise;
}
function cleanMarkdownCell(value) {
  return value.replace(/<br\s*\/?\s*>/gi, " ").replace(/\\\|/g, "|").replace(/\s+/g, " ").trim();
}
function splitMarkdownRow(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map(cleanMarkdownCell);
}
function isMarkdownSeparator(line) {
  const cells = splitMarkdownRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}
function looksLikeAgendaTableRow(line) {
  return line.includes("|") && splitMarkdownRow(line).length >= 10;
}
function normalizeLiteParseText(markdown) {
  const output = [];
  for (const rawLine of markdown.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (looksLikeAgendaTableRow(line)) {
      if (isMarkdownSeparator(line)) continue;
      output.push(splitMarkdownRow(line).join("	"));
      continue;
    }
    output.push(
      line.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").replace(/\*\*/g, "").replace(/__/g, "").trim()
    );
  }
  return output.join("\n").trim();
}
async function extractPdfText(file) {
  try {
    await ensureLiteParse();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parser = new LiteParse({
      ocrEnabled: false,
      outputFormat: "markdown",
      extractLinks: false,
      extractScreenshots: false,
      quiet: true
    });
    const result = await parser.parse(bytes);
    const text = result && typeof result === "object" && "text" in result ? String(result.text ?? "") : "";
    const normalized = normalizeLiteParseText(text);
    if (!normalized) throw new Error("PDF sem texto interpret\xE1vel");
    return normalized;
  } catch {
    throw new PdfExtractionError();
  }
}
export {
  PdfExtractionError,
  extractPdfText,
  normalizeLiteParseText
};