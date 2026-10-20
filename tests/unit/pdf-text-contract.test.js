import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractPdfText, PdfExtractionError } from "../../frontend/import/extractPdfText.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

describe("Contrato de extração de texto PDF", () => {
  it("delega a extração de bytes ao motor PDF injetado", async () => {
    const file = new Blob(["conteudo-do-pdf"]);
    let received = null;
    const engine = {
      async extractPdfTextFromBytes(bytes) {
        received = bytes;
        return "TEXTO\tNORMALIZADO";
      }
    };
    const text = await extractPdfText(file, engine);
    assert.equal(text, "TEXTO\tNORMALIZADO");
    assert.ok(received instanceof Uint8Array);
    assert.equal(Buffer.from(received).toString("utf8"), "conteudo-do-pdf");
  });

  it("mapeia qualquer falha do motor para PdfExtractionError com código PDF_INVALIDO", async () => {
    const file = new Blob(["x"]);
    const engine = {
      async extractPdfTextFromBytes() {
        throw new Error("wasm quebrou");
      }
    };
    await assert.rejects(
      () => extractPdfText(file, engine),
      (error) => {
        assert.ok(error instanceof PdfExtractionError);
        assert.equal(error.code, "PDF_INVALIDO");
        assert.equal(error.name, "PdfExtractionError");
        return true;
      }
    );
  });

  it("isola a dependência WASM no módulo de motor", () => {
    const facade = read("../../frontend/import/extractPdfText.js");
    const engine = read("../../frontend/import/pdf-engine-liteparse.js");
    assert.doesNotMatch(facade, /@llamaindex/);
    assert.match(facade, /import\("\.\/pdf-engine-liteparse\.js"\)/);
    assert.ok(engine.includes('from "@llamaindex/liteparse-wasm"'));
    assert.ok(engine.includes("extractPdfTextFromBytes"));
  });
});
