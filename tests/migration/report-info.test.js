import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPORT_HELP, reportInfo } from "../../migration/frontend/report-info.js";

describe("Ajuda contextual do Relatório Gerencial", () => {
  it("oferece explicações específicas nos 7 indicadores e nos 6 painéis", () => {
    assert.equal(Object.keys(REPORT_HELP).length, 13);
    for (const title of ["Comparativo por loja", "Taxa de recebimento", "Fornecedores com ocorrências", "Ocorrências e observações"]) {
      assert.ok(REPORT_HELP[title].length > 50, title);
    }
    assert.match(REPORT_HELP["Comparativo por loja"], /recebidos.*total/);
    assert.match(REPORT_HELP["Sem conferência"], /concluída/);
    assert.match(REPORT_HELP["Fornecedores com ocorrências"], /quantidade/);
  });
  it("gera botão acessível vinculado ao tooltip correto", () => {
    const output = reportInfo("Comparativo por loja");
    assert.match(output, /aria-label="Sobre: Comparativo por loja"/);
    assert.match(output, /aria-expanded="false"/);
    assert.match(output, /aria-controls="report-help-9"/);
    assert.match(output, /role="tooltip" id="report-help-8"/);
    assert.equal(reportInfo("Título inexistente"), "");
  });
  it("CSS de ajuda está incluído no build e no HTML", () => {
    const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(read("../../index.html"), /\/src\/report-info\.css/);
    assert.match(read("../../scripts/build-native.mjs"), /"report-info\.css"/);
    assert.match(read("../../src/report-info.css"), /report-info-button:focus-visible/);
    assert.match(read("../../migration/frontend/reports.js"), /setupReportInfo\(root\)/);
  });
});