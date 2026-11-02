class PdfExtractionError extends Error {
  code = "PDF_INVALIDO";
  constructor() {
    super("PDF_INVALIDO");
    this.name = "PdfExtractionError";
  }
}

let defaultEnginePromise = null;

function loadDefaultEngine() {
  defaultEnginePromise ??= import("./pdf-engine-liteparse.js");
  return defaultEnginePromise;
}

async function extractPdfText(file, engine = null) {
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
