import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCrossReport, parseCrossQuantity } from "../../frontend/import/parseCrossReport.js";
import { validIsoDate, crossInputTotals } from "../../worker/routes/cross.js";

// Dados sintéticos: nunca versionar relatórios reais de fornecedores.
const document = `TODAS AS EMPRESAS                                                        26/10/2026
Scm405
Código Descrição GTIN Pedido Cod. expedição Embe Qnt. expedição Separar
EMPRESA DO PEDIDO : 1 - SUPERMERCADO LOJA 01 LTDA
DEPARTAMENTO : 1 - MERCEARIA
12345 MOLHO SINTETICO 150ML                7896007811298   80776  27896007811292  24 1,000 24,000
Processado por: EXEMPLO                                                    1/2
TODAS AS EMPRESAS                                                        26/10/2026
Scm405
Código Descrição GTIN Pedido Cod. expedição Embe Qnt. expedição Separar
12346 MOLHO SINTETICO 250ML                7896007811403   80776  27896007811407  24 1,000 24,000
TOTAL DO DEPARTAMENTO (2) 2,000 48,000
TOTAL DA EMPRESA DO PEDIDO (2) 2,000 48,000
EMPRESA DO PEDIDO : 9 - SUPERMERCADO LOJA 09 LTDA
DEPARTAMENTO : 1 - MERCEARIA
63808 MOLHO SINTETICO 1000ML PET         7896007801312 13930 0 1 12,000 12,000
TOTAL DO DEPARTAMENTO (1) 12,000 12,000
TOTAL DA EMPRESA DO PEDIDO (1) 12,000 12,000
TOTAL GERAL (3) 14,000 60,000
Processado por: EXEMPLO                                                    2/2`;

describe("Cross-Docking Scm405", () => {
  it("interpreta quantidades pt-BR como unidades e não milhares", () => {
    assert.equal(parseCrossQuantity("1,000"), 1);
    assert.equal(parseCrossQuantity("1.140,000"), 1140);
    assert.equal(parseCrossQuantity("12,000"), 12);
    assert.equal(parseCrossQuantity("1,500"), null);
    assert.equal(parseCrossQuantity("1,200,000"), null);
  });
  it("mantém a loja atravessando a quebra de página e aceita loja ausente", () => {
    const result = parseCrossReport(document);
    assert.deepEqual(result.errors, []);
    assert.equal(result.reportDate, "2026-10-26");
    assert.equal(result.storeCount, 2);
    assert.equal(result.lines, 3);
    assert.equal(result.dispatchQty, 14);
    assert.equal(result.separateQty, 60);
    assert.deepEqual(result.rows.map(x => x.storeNumber), ["01", "01", "09"]);
    assert.equal(result.rows[2].dispatchCode, "0");
    assert.equal(result.rows[2].packageSize, 1);
  });
  it("aceita tabelas com separadores Markdown do extrator PDF", () => {
    const pipe = document.replace("12345 MOLHO SINTETICO 150ML                7896007811298   80776  27896007811292  24 1,000 24,000",
      "| 12345 | MOLHO SINTETICO 150ML | 7896007811298 | 80776 | 27896007811292 | 24 | 1,000 | 24,000 |");
    assert.deepEqual(parseCrossReport(pipe).errors, []);
  });
  it("bloqueia total geral divergente", () => {
    const result = parseCrossReport(document.replace("TOTAL GERAL (3) 14,000 60,000", "TOTAL GERAL (3) 14,000 61,000"));
    assert.ok(result.errors.includes("TOTAL_GERAL_DIVERGENTE"));
  });
  it("bloqueia linha de produto não interpretada", () => {
    const result = parseCrossReport(document.replace("7896007811298", "78960078112"));
    assert.ok(result.errors.includes("PRODUTO_NAO_INTERPRETADO"));
    assert.ok(result.errors.includes("TOTAL_GERAL_DIVERGENTE"));
  });
  it("regressão sintética com 8 lojas e 34 produtos em duas páginas", () => {
    // Reproduz o volume e a quebra de página sem versionar nomes ou itens reais.
    const batches = [4, 4, 4, 4, 4, 4, 5, 5];
    const decimal = value => value.toLocaleString("pt-BR", {
      minimumFractionDigits: 3, maximumFractionDigits: 3
    });
    const lines = [
      "TODAS AS EMPRESAS                                             26/10/2026",
      "Scm405",
      "Código Descrição GTIN Pedido Cod. expedição Embe Qnt. expedição Separar"
    ];
    let product = 0;
    batches.forEach((count, storeIndex) => {
      const store = String(storeIndex + 1).padStart(2, "0");
      lines.push(`EMPRESA DO PEDIDO : ${storeIndex + 1} - LOJA SINTETICA ${store}`);
      lines.push("DEPARTAMENTO : 1 - MERCEARIA");
      for (let index = 0; index < count; index++) {
        if (storeIndex === 4 && index === 2) {
          lines.push("Processado por: EXEMPLO                                    1/2");
          lines.push("TODAS AS EMPRESAS                                         26/10/2026");
          lines.push("Scm405");
          lines.push("Código Descrição GTIN Pedido Cod. expedição Embe Qnt. expedição Separar");
        }
        product += 1;
        lines.push(`${10000 + product} PRODUTO SINTETICO ${product} ${7896000000000 + product} ${80000 + product} ${27890000000000 + product} 36 1,000 36,000`);
      }
      lines.push(`TOTAL DO DEPARTAMENTO (${count}) ${decimal(count)} ${decimal(count * 36)}`);
      lines.push(`TOTAL DA EMPRESA DO PEDIDO (${count}) ${decimal(count)} ${decimal(count * 36)}`);
    });
    lines.push("TOTAL GERAL (34) 34,000 1.224,000");
    const result = parseCrossReport(lines.join("\n"));
    assert.deepEqual(result.errors, []);
    assert.equal(result.storeCount, 8);
    assert.equal(result.lines, 34);
    assert.equal(result.dispatchQty, 34);
    assert.equal(result.separateQty, 1224);
    assert.deepEqual([...new Set(result.rows.map(item => item.storeNumber))],
      ["01", "02", "03", "04", "05", "06", "07", "08"]);
  });

  it("rejeita documento sem código de relatório", () => {
    assert.ok(parseCrossReport(document.replaceAll("Scm405", "Outra coisa")).errors.includes("FORMATO_CROSS_NAO_RECONHECIDO"));
  });
});

describe("Validação da importação no Worker", () => {
  const report = parseCrossReport(document);
  const input = {
    operationalDate: "2026-10-26", reportDate: report.reportDate, rows: report.rows,
    declared: { lines: report.lines, dispatchQty: report.dispatchQty, separateQty: report.separateQty }
  };
  it("confere todos os totais recebidos", () => {
    assert.deepEqual(crossInputTotals(input), { lines: 3, dispatchQty: 14, separateQty: 60, stores: 2 });
    assert.equal(crossInputTotals({ ...input, declared: { ...input.declared, separateQty: 1000 } }), null);
    assert.equal(crossInputTotals({ ...input, rows: input.rows.map((r, i) => i ? r : { ...r, separateQty: 500 }) }), null);
  });
  it("rejeita datas inválidas", () => {
    assert.equal(validIsoDate("2026-02-29"), false);
    assert.equal(validIsoDate("2028-02-29"), true);
    assert.equal(crossInputTotals({ ...input, operationalDate: "2026-13-01" }), null);
  });

});
