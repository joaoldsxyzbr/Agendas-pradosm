import { describe, expect, it } from "vitest";
import { sumReportRows, reportRate, groupDailyReport, groupStoreReport, exportReportCsv } from "../../public/vanilla/reports.js";

const fixture = [
  { date: "2026-10-01", storeCode: "F01", storeName: "Centro", dayStatus: "concluido", total: 5, recebido: 2, naoChegou: 1, aguardando: 1, recusado: 1, semAgenda: 1 },
  { date: "2026-10-01", storeCode: "F02", storeName: "Praia", dayStatus: "aberto", total: 3, recebido: 1, naoChegou: 1, aguardando: 1, recusado: 0, semAgenda: 0 },
  { date: "2026-10-02", storeCode: "F01", storeName: "Centro", dayStatus: "aberto", total: 2, recebido: 2, naoChegou: 0, aguardando: 0, recusado: 0, semAgenda: 0 },
];

describe("relatórios em JavaScript puro", () => {
  it("mantém recebidos, não recebidos, recusados e aguardando distintos", () => {
    expect(sumReportRows(fixture)).toEqual({ total: 10, recebido: 5, naoChegou: 2, aguardando: 2, recusado: 1, semAgenda: 1, agendas: 3, abertas: 2 });
    expect(reportRate(sumReportRows(fixture))).toBe(50);
    expect(reportRate(sumReportRows([]))).toBe(0);
  });

  it("agrupa evolução diária sem duplicar dias", () => {
    expect(groupDailyReport(fixture)).toEqual([
      { date: "2026-10-01", total: 8, recebido: 3, naoChegou: 2, aguardando: 2, recusado: 1 },
      { date: "2026-10-02", total: 2, recebido: 2, naoChegou: 0, aguardando: 0, recusado: 0 },
    ]);
  });

  it("agrupa lojas com os dados completos", () => {
    expect(groupStoreReport(fixture)).toEqual([
      { code: "F01", name: "Centro", total: 7, recebido: 4, naoChegou: 1, aguardando: 1, recusado: 1, semAgenda: 1 },
      { code: "F02", name: "Praia", total: 3, recebido: 1, naoChegou: 1, aguardando: 1, recusado: 0, semAgenda: 0 },
    ]);
  });

  it("exporta dez campos e protege células contra fórmulas maliciosas", () => {
    const csv = exportReportCsv([{ ...fixture[0], storeName: '=EXEC("alert")' }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0].split(";")).toHaveLength(10);
    expect(csv).toContain('"Recusados";"Sem agenda"');
    expect(csv).toContain("'=EXEC");
    expect(csv).toContain('"Concluído"');
    expect(exportReportCsv([]).split("\r\n")).toHaveLength(1);
  });
});
