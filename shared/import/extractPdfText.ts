export interface PdfEngine {
  extractPdfTextFromBytes(bytes: Uint8Array): Promise<string>;
}
class PdfExtractionError extends Error {
  code = "PDF_INVALIDO";
  constructor() {
    super("PDF_INVALIDO");
    this.name = "PdfExtractionError";
  }
}

let defaultEnginePromise: Promise<PdfEngine> | null = null;

function loadDefaultEngine(): Promise<PdfEngine> {
  defaultEnginePromise ??= import("./pdf-engine-liteparse.ts");
  return defaultEnginePromise;
}

async function extractPdfText(file: File, engine: PdfEngine | null = null): Promise<string> {
  try {
    const activeEngine = engine ?? await loadDefaultEngine();
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await activeEngine.extractPdfTextFromBytes(bytes);
  } catch {
    throw new PdfExtractionError();
  }
}

export {
  PdfExtractionError,
  extractPdfText
};
