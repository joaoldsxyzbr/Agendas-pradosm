import { describe, expect, it } from "vitest";
import singleStoreFixture from "../fixtures/agenda-sintetica.txt?raw";
import sanitizedRealCsvFixture from "../fixtures/agenda-todas-lojas-real-sanitizada.csv?raw";
import sanitizedDockCsvFixture from "../fixtures/agenda-todas-lojas-com-doca-sanitizada.csv?raw";
import {
  parseAgendaCsv,
  parseAgendaPdfText,
} from "../../src/import/parseAgendaBatch";

const STORE_LABELS = [
  "CD",
  "F01 - BIGUAÇU",
  "F02 - AREIAS DE CIMA",
  "F03 - CANASVIEIRAS",
  "F04 - SERRARIA",
  "F05 - PAGANI",
  "F07 - ESTREITO",
  "F08 - PORTO BELO",
  "F09 - SACO DOS LIMÕES",
];

function csvWithRows(total: number) {
  const rows = [
    "Filtros;",
    "Dia: 29/09/2026 ; Filial: Todas ; Doca: Todas ; Busca:  ; ;",
    "",
    "Protocolo;Data agenda;Fornecedor;Filial;Itens;Vol.;Paletes;Carga batida;Tipo;N° NFe;Pedidos;",
  ];

  for (let index = 0; index < total; index += 1) {
    const protocol = `9${String(index + 1).padStart(7, "0")}`;
    const supplier =
      index === 0 ? '"FORNECEDOR; ESPECIAL LTDA"' : `FORNECEDOR ${index + 1} LTDA`;
    rows.push(
      [
        protocol,
        "29/09/2026 08:00 às 08:10",
        supplier,
        STORE_LABELS[index % STORE_LABELS.length],
        "10",
        "20",
        "1",
        "-",
        "Nota fiscal",
        String(700000 + index),
        String(50000 + index),
        "",
      ].join(";"),
    );
  }

  return "\uFEFF" + rows.join("\r\n");
}

describe("parseAgendaBatch", () => {
  it("interpreta 121 agendamentos de todas as lojas em um único CSV", () => {
    const result = parseAgendaCsv(csvWithRows(121));

    expect(result.source).toBe("csv");
    expect(result.date).toBe("2026-09-29");
    expect(result.blockingErrors).toEqual([]);
    expect(result.totalAppointments).toBe(121);
    expect(result.agendas).toHaveLength(9);
    expect(
      result.agendas.reduce(
        (total, agenda) => total + agenda.appointments.length,
        0,
      ),
    ).toBe(121);
    expect(result.agendas.map((agenda) => agenda.storeCode)).toEqual([
      "CD",
      "F01",
      "F02",
      "F03",
      "F04",
      "F05",
      "F07",
      "F08",
      "F09",
    ]);

    const cd = result.agendas.find((agenda) => agenda.storeCode === "CD");
    expect(cd?.appointments[0]).toMatchObject({
      supplier: "FORNECEDOR; ESPECIAL LTDA",
      type: "Nota fiscal",
      nfe: ["700000"],
      orders: ["50000"],
    });
  });

  it("interpreta o CSV real exportado com CR isolado como quebra de linha", () => {
    const csv = sanitizedRealCsvFixture
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, "\r");

    const result = parseAgendaCsv(csv);

    expect(result.source).toBe("csv");
    expect(result.date).toBe("2026-09-29");
    expect(result.blockingErrors).toEqual([]);
    expect(result.totalAppointments).toBe(4);
    expect(result.agendas.map((agenda) => agenda.storeCode)).toEqual([
      "CD",
      "F01",
      "F08",
    ]);
    expect(result.agendas.find((agenda) => agenda.storeCode === "F01"))
      .toMatchObject({
        appointments: [
          {
            protocol: "90000002",
            nfe: ["4631257", "4631258"],
            orders: ["80053"],
          },
          {
            protocol: "90000004",
            type: "Pedido",
            orders: ["80054"],
          },
        ],
      });
  });

  it("separa o CD por doca quando a exportação consolidada traz a coluna Doca", () => {
    const result = parseAgendaCsv(sanitizedDockCsvFixture);

    expect(result.source).toBe("csv");
    expect(result.date).toBe("2026-09-30");
    expect(result.blockingErrors).toEqual([]);
    expect(result.totalAppointments).toBe(4);
    expect(result.agendas.map((agenda) => agenda.storeCode)).toEqual([
      "CD DOCA 01",
      "CD DOCA 02",
      "F01",
      "F08",
    ]);

    expect(
      result.agendas.find((agenda) => agenda.storeCode === "CD DOCA 01")
        ?.appointments[0],
    ).toMatchObject({
      protocol: "91000001",
      type: "Pedido",
      orders: ["47338"],
    });

    expect(
      result.agendas.find((agenda) => agenda.storeCode === "CD DOCA 02")
        ?.appointments[0],
    ).toMatchObject({
      protocol: "91000002",
      type: "Agenda fixa",
    });
  });

  it("bloqueia o lote inteiro quando uma linha não é interpretável", () => {
    const csv = [
      "Filtros;",
      "Dia: 29/09/2026 ; Filial: Todas ; Doca: Todas ;",
      "Protocolo;Data agenda;Fornecedor;Filial;Itens;Vol.;Paletes;Carga batida;Tipo;N° NFe;Pedidos;",
      "90000001;29/09/2026 08:00 às 08:10;FORNECEDOR UM;F01 - BIGUAÇU;1;2;0;-;Pedido;-;50001;",
      "90000002;29/09/2026 08:10 às 08:20;FORNECEDOR DOIS;FILIAL DESCONHECIDA;1;2;0;-;Pedido;-;50002;",
    ].join("\r\n");

    const result = parseAgendaCsv(csv);

    expect(result.totalAppointments).toBe(1);
    expect(result.blockingErrors).toContain(
      "REGISTROS_NAO_INTERPRETADOS:1",
    );
  });

  it("bloqueia linha de dados com protocolo vazio", () => {
    const csv = [
      "Filtros;",
      "Dia: 29/09/2026 ; Filial: Todas ; Doca: Todas ;",
      "Protocolo;Data agenda;Fornecedor;Filial;Itens;Vol.;Paletes;Carga batida;Tipo;N° NFe;Pedidos;",
      "90000001;29/09/2026 08:00 às 08:10;FORNECEDOR UM;F01 - BIGUAÇU;1;2;0;-;Pedido;-;50001;",
      ";29/09/2026 08:10 às 08:20;FORNECEDOR SEM PROTOCOLO;F02 - AREIAS DE CIMA;1;2;0;-;Pedido;-;50002;",
    ].join("\r\n");

    const result = parseAgendaCsv(csv);

    expect(result.totalAppointments).toBe(1);
    expect(result.blockingErrors).toContain(
      "REGISTROS_NAO_INTERPRETADOS:1",
    );
  });

  it("bloqueia exportação consolidada quando o total declarado diverge", () => {
    const text = [
      "Prado Supermercados",
      "Agendas de recebimento Total: 3",
      "Filtros: Dia: 29/09/2026 | Filial: Todas | Doca: Todas",
      "Protocolo\tData agenda\tFornecedor\tFilial\tItens\tVol.\tPaletes\tCarga batida\tTipo\tN° NFe\tPedidos",
      "90000001\t29/09/2026 08:00 às 08:10\tFORNECEDOR UM\tF01 - BIGUAÇU\t1\t2\t0\t-\tPedido\t-\t50001",
      "90000002\t29/09/2026 08:10 às 08:20\tFORNECEDOR DOIS\tF02 - AREIAS DE CIMA\t3\t4\t1\tNão\tNota fiscal\t70002\t50002",
    ].join("\n");

    const result = parseAgendaPdfText(text);

    expect(result.totalAppointments).toBe(2);
    expect(result.blockingErrors).toContain("TOTAL_DIVERGENTE:3:2");
  });

  it("interpreta PDF de todas as lojas quando a tabela possui coluna Filial", () => {
    const text = [
      "Prado Supermercados Filtros: Dia: 29/09/2026 | Filial: Todas | Doca: Todas",
      "Protocolo\tData agenda\tFornecedor\tFilial\tItens\tVol.\tPaletes\tCarga batida\tTipo\tN° NFe\tPedidos",
      "90000001\t29/09/2026 08:00 às 08:10\tFORNECEDOR UM\tF01 - BIGUAÇU\t1\t2\t0\t-\tPedido\t-\t50001",
      "90000002\t29/09/2026 08:10 às 08:20\tFORNECEDOR DOIS\tF02 - AREIAS DE CIMA\t3\t4\t1\tNão\tNota fiscal\t70002\t50002",
    ].join("\n");

    const result = parseAgendaPdfText(text);

    expect(result.source).toBe("pdf");
    expect(result.blockingErrors).toEqual([]);
    expect(result.totalAppointments).toBe(2);
    expect(result.agendas.map((agenda) => agenda.storeCode)).toEqual([
      "F01",
      "F02",
    ]);
  });

  it("mantém compatibilidade com o PDF individual já suportado", () => {
    const result = parseAgendaPdfText(singleStoreFixture);

    expect(result.blockingErrors).toEqual([]);
    expect(result.agendas).toHaveLength(1);
    expect(result.agendas[0].storeCode).toBe("F99");
    expect(result.totalAppointments).toBe(6);
  });
});
