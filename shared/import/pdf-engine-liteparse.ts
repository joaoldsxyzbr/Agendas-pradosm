import initLiteParse, { LiteParse } from "@llamaindex/liteparse-wasm";

let initPromise: Promise<unknown> | null = null;

function ensureLiteParse(): Promise<unknown> {
  initPromise ??= Promise.resolve(initLiteParse());
  return initPromise;
}

function cleanMarkdownCell(value: string): string {
  return value.replace(/<br\s*\/?\s*>/gi, " ").replace(/\\\|/g, "|").replace(/\s+/g, " ").trim();
}

function splitMarkdownRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map(cleanMarkdownCell);
}

function isMarkdownSeparator(line: string): boolean {
  const cells = splitMarkdownRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function looksLikeAgendaTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownRow(line).length >= 10;
}

function normalizeLiteParseText(markdown: string): string {
  const output = [];
  for (const rawLine of markdown.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (looksLikeAgendaTableRow(line)) {
      if (isMarkdownSeparator(line)) continue;
      output.push(splitMarkdownRow(line).join("\t"));
      continue;
    }
    output.push(
      line.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").replace(/\*\*/g, "").replace(/__/g, "").trim()
    );
  }
  return output.join("\n").trim();
}

async function extractPdfTextFromBytes(bytes: Uint8Array): Promise<string> {
  await ensureLiteParse();
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
  if (!normalized) throw new Error("PDF sem texto interpretável");
  return normalized;
}

export {
  extractPdfTextFromBytes,
  normalizeLiteParseText
};
