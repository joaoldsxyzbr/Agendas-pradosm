import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

describe("Build de migração sem React e Vite no output", () => {
  it("mantém CSS original e produz entrypoint JavaScript", () => {
    const source = read("../../scripts/build-native.mjs");
    for (const name of ["styles.css","store-desktop.css","corporate.css","cadastros-compactos.css"])
      assert.ok(read("../../frontend/styles/" + name).length > 0, name);
    assert.ok(source.includes('await copy("frontend", "frontend")'));
    assert.ok(source.includes("frontend/entry.js"));
    assert.ok(source.includes("pdfImportMap"));
  });
  it("preserva o index atual até homologar a versão nativa", () => {
    assert.match(read("../../index.html"), /frontend\/entry\.js/);
    const entry = read("../../frontend/entry.js");
    assert.match(entry, /createMigratedApplication/);
    assert.match(entry, /app\.start\(\)\.catch/);
  });
});