import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPORT_HELP, reportInfo } from "../../frontend/report-info.js";

describe("Ajuda contextual do Relatório Gerencial", () => {
  it("oferece explicações para indicadores, análises e sete cards resumidos", () => {
    assert.equal(Object.keys(REPORT_HELP).length, 19);
    for(const title of ["Taxa de recebimento","Evolução dos recebimentos",
      "Distribuição das situações","Desempenho por loja","Agendamentos por situação (por dia)",
      "Ocorrências recentes","Agendamentos recentes por data de entrega"]){
      assert.ok(REPORT_HELP[title]?.length>50,title);
    }
    assert.match(REPORT_HELP["Agendamentos recentes por data de entrega"],/Não são necessariamente os últimos cadastrados/);
    for (const title of ["Comparativo por loja", "Taxa de recebimento", "Fornecedores com ocorrências", "Ocorrências e observações"]) {
      assert.ok(REPORT_HELP[title].length > 50, title);
    }
    assert.match(REPORT_HELP["Comparativo por loja"], /recebidos.*total/);
    assert.match(REPORT_HELP["Não compareceu"], /concluir o dia/);
    assert.match(REPORT_HELP["Fornecedores com ocorrências"], /quantidade/);
  });
  it("gera botão acessível vinculado ao tooltip correto", () => {
    const output = reportInfo("Comparativo por loja");
    assert.match(output, /aria-label="Sobre: Comparativo por loja"/);
    assert.match(output, /aria-expanded="false"/);
    assert.match(output, /aria-controls="report-help-9"/);
    assert.match(output, /role="tooltip" id="report-help-9"/);
    assert.equal(reportInfo("Título inexistente"), "");
  });
  it("CSS de ajuda está incluído no build e no HTML", () => {
    const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(read("../../index.html"), /\/frontend\/styles\/report-info\.css/);
    assert.match(read("../../scripts/build-native.mjs"), /await copy\("frontend", "frontend"\)/);
    assert.match(read("../../frontend/styles/report-info.css"), /report-info-button:focus-visible/);
    assert.match(read("../../frontend/reports.js"), /setupReportInfo\(root\)/);
  });
});