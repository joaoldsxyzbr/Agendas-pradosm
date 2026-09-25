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
    expect(text).toContain("Busca:");
    expect(text).toContain("Total: 4");

    for (const header of [
      "Protocolo",
      "Data agenda",
      "Fornecedor",
      "Tipo",
      "N° NFe",
      "Pedidos",
    ]) {
      expect(text).toContain(header);
    }

    for (const removedHeader of [
      "Itens",
      "Vol.",
      "Paletes",
      "Carga batida",
      "Status",
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
    expect(text).toContain("Não chegou");
    expect(text).toContain("Aguardando");
    expect(text).toContain("Recusado");
    expect(text).toContain("0.09 0.48 0.31 rg");
    expect(text).toContain("0.55 0.38 0.00 rg");
    expect(text).toContain("0.71 0.14 0.09 rg");
  });

  it("posiciona o status abaixo do fornecedor sem sobrepor nomes longos", () => {
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
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
    const commands = [
      ...text.matchAll(
        /1 0 0 1 ([0-9.]+) ([0-9.]+) Tm \(([^)]*)\) Tj ET/g,
      ),
    ].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      value: match[3],
    }));

    const supplierCommands = commands.filter((command) =>
      ["LACTALIS", "COMERCIO", "DISTRIBUICAO", "ALIMENTOS", "LTDA."].some(
        (word) => command.value.includes(word),
      ),
    );
    const statusCommand = commands.find((command) => command.value === "Recusado");

    expect(supplierCommands.length).toBeGreaterThan(0);
    expect(statusCommand).toBeDefined();
    expect(statusCommand!.x).toBe(supplierCommands[0].x);
    expect(statusCommand!.y).toBeLessThan(
      Math.min(...supplierCommands.map((command) => command.y)),
    );
  });

  it("inclui fornecedor manual no PDF com horário único", () => {
    const bytes = buildAgendaPdf(
      {
        id: "agenda-1",
        storeCode: "F08",
        storeName: "PORTO BELO",
        date: "2026-09-25",
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
      }),
    ).toBe("agenda-F08-25-09-2026.pdf");
  });
});
