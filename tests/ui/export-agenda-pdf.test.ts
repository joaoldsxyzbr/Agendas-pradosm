import { describe, expect, it } from "vitest";
import { buildAgendaPdf, agendaPdfFileName } from "../../src/agenda/exportAgendaPdf";
import type { StoreAppointment } from "../../src/agenda/types";

const appointments: StoreAppointment[] = [
  {
    id: "appt-1",
    protocol: "12458375",
    startTime: "07:30",
    endTime: "07:40",
    supplier: "PAMPLONA ALIMENTOS S/A",
    items: 1,
    volumes: 1,
    pallets: 0,
    cargaBatida: null,
    type: "CNPJ",
    nfe: [],
    orders: [],
    status: "recebido",
    hasExchanges: true,
    ativo: true,
  },
  {
    id: "appt-2",
    protocol: "12473312",
    startTime: "07:40",
    endTime: "07:50",
    supplier: "GRANJA PINHEIROS LTDA",
    items: 10,
    volumes: 15,
    pallets: 0,
    cargaBatida: null,
    type: "CNPJ",
    nfe: [],
    orders: [],
    status: "nao_chegou",
    hasExchanges: false,
    ativo: true,
  },
  {
    id: "appt-3",
    protocol: "12482860",
    startTime: "07:50",
    endTime: "08:00",
    supplier: "FRIGORIFICO GESSNER LTDA",
    items: 2,
    volumes: 5,
    pallets: 0,
    cargaBatida: null,
    type: "CNPJ",
    nfe: [],
    orders: [],
    status: "aguardando",
    hasExchanges: false,
    ativo: true,
  },
  {
    id: "appt-4",
    protocol: "12470162",
    startTime: "08:00",
    endTime: "08:10",
    supplier: "J.J COMERCIO DE CARVAO LTDA",
    items: 3,
    volumes: 3,
    pallets: 2,
    cargaBatida: null,
    type: "Nota fiscal",
    nfe: ["93469"],
    orders: ["17126"],
    status: "recusado",
    hasExchanges: false,
    ativo: true,
  },
];

describe("agenda PDF export", () => {
  it("gera um PDF completo com resumo e todos os status", () => {
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "concluido",
        completedAt: "2026-09-25T20:00:00.000Z",
        completedBy: { id: "u1", name: "Conferente" },
      },
      appointments,
    );

    const text = new TextDecoder("windows-1252").decode(bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 595 842]");
    expect(text).toContain("Prado Supermercados");
    expect(text).toContain("Agendas de recebimento");
    expect(text).toContain(
      "Filtros: Dia: 25/09/2026 | Filiais: F08 - PORTO BELO | Doca: Todas",
    );
    expect(text).toContain("Status do dia: Concluído");
    expect(text).toContain("Concluído por: Conferente");
    expect(text).toContain("Total: 4");
    expect(text).toContain("/F2 9.2 Tf");
    expect(text).toContain("1 0 0 1 150 814 Tm (Filtros: Dia: 25/09/2026");
    expect(text).toContain("0.58 0.58 0.62 RG 0.45 w");

    const tableHeaderIndex = text.indexOf("(Data agenda) Tj");
    const totalIndex = text.indexOf("(Total: 4) Tj");
    const lastSupplierIndex = text.lastIndexOf("(J.J COMERCIO DE CARVAO LTDA) Tj");

    expect(tableHeaderIndex).toBeGreaterThan(-1);
    expect(totalIndex).toBeGreaterThan(lastSupplierIndex);
    expect(text.slice(0, tableHeaderIndex)).not.toContain("(Total: 4) Tj");

    for (const header of [
      "Data agenda",
      "Fornecedor",
      "Status",
      "Tipo",
      "N° NFe",
      "Pedidos",
      "Trocas",
    ]) {
      expect(text).toContain(header);
    }

    for (const removedHeader of [
      "Protocolo",
      "Itens",
      "Vol.",
      "Paletes",
      "Carga batida",
    ]) {
      expect(text).not.toContain(`(${removedHeader}) Tj`);
    }

    expect(text).toContain("PAMPLONA ALIMENTOS S/A");
    expect(text).toContain("GRANJA PINHEIROS LTDA");
    expect(text).toContain("FRIGORIFICO GESSNER LTDA");
    expect(text).toContain("J.J COMERCIO DE CARVAO LTDA");
    expect(text).toContain("93469");
    expect(text).toContain("17126");
    expect(text).toContain("Recebido");
    expect(text).toContain("Não recebido");
    expect(text).toContain("Aguardando");
    expect(text).toContain("Recusado");
    expect(text).toContain("Sim");
    expect(text).toContain("Não");
    expect(text).toContain("0.09 0.48 0.31 rg");
    expect(text).toContain("0.55 0.38 0.00 rg");
    expect(text).toContain("0.71 0.14 0.09 rg");
    expect(text).toContain("/F1 7 Tf");
    expect(text).toContain("/F2 6.5 Tf");
    expect(text).toContain("0.975 0.98 0.99 rg");
    expect(text).toContain("Gerado em:");
  });

  it("posiciona Status em coluna própria antes de Tipo", () => {
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      [
        {
          ...appointments[3],
          supplier: "LACTALIS COMERCIO E DISTRIBUICAO DE ALIMENTOS LTDA.",
          status: "recusado",
        },
      ],
    );

    const text = new TextDecoder("windows-1252").decode(bytes);
    const statusHeader = text.indexOf("(Status) Tj");
    const typeHeader = text.indexOf("(Tipo) Tj");

    expect(text).not.toContain("(Protocolo) Tj");
    expect(statusHeader).toBeGreaterThan(-1);
    expect(typeHeader).toBeGreaterThan(statusHeader);
    expect(text).toContain("(Recusado) Tj");
  });

  it("quebra fornecedor longo sem perder texto nem invadir a próxima coluna", () => {
    const supplier =
      "SUPERMERCADODISTRIBUIDORADEALIMENTOSULTRALONGASEMESPACOSPARATESTEDOQUEBRAAUTOMATICA";
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      [
        {
          ...appointments[0],
          supplier,
        },
      ],
    );

    const text = new TextDecoder("windows-1252").decode(bytes);
    const supplierLines = [
      ...text.matchAll(/1 0 0 1 105 [0-9.]+ Tm \(([^)]*)\) Tj ET/g),
    ]
      .map((match) => match[1])
      .filter((value) => value !== "Fornecedor");

    expect(supplierLines.length).toBeGreaterThan(1);
    expect(supplierLines.join("")).toBe(supplier);
    expect(supplierLines.every((line) => line.length < supplier.length)).toBe(true);
  });

  it("repete o cabeçalho e mantém linhas inteiras em PDFs com várias páginas", () => {
    const manyAppointments = Array.from({ length: 40 }, (_, index) => ({
      ...appointments[index % appointments.length],
      id: `appt-many-${index}`,
      protocol: String(20000000 + index),
    }));

    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      manyAppointments,
    );

    const text = new TextDecoder("windows-1252").decode(bytes);
    const headerCount = text.match(/\(Fornecedor\) Tj/g)?.length ?? 0;

    expect(headerCount).toBeGreaterThan(1);
    expect(text).toContain("Página 2 de 2");
    expect(text.match(/\(Total: 40\) Tj/g)).toHaveLength(1);
    expect(text.indexOf("(Total: 40) Tj")).toBeGreaterThan(
      text.indexOf("(Página 1 de 2) Tj"),
    );
  });

  it("inclui fornecedor manual no PDF com horário único", () => {
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      },
      [
        {
          ...appointments[0],
          id: "appt-manual",
          protocol: "Sem agenda",
          startTime: "13:31",
          endTime: "13:31",
          supplier: "FORNECEDOR EXTRA LTDA",
          type: "Sem agenda",
          status: "aguardando",
          origin: "manual",
        },
      ],
    );

    const text = new TextDecoder("windows-1252").decode(bytes);
    expect(text).toContain("FORNECEDOR EXTRA LTDA");
    expect(text).toContain("Sem agenda");
    expect(text).toContain("13:31");
    expect(text).not.toContain("13:31 às 13:31");
  });

  it("gera um nome de arquivo identificável pela loja e data", () => {
    expect(
      agendaPdfFileName({
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
        dayStatus: "aberto",
        completedAt: null,
        completedBy: null,
      }),
    ).toBe("agenda-F08-25-09-2026.pdf");
  });
});
