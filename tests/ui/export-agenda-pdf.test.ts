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
      "Itens",
      "Vol.",
      "Paletes",
      "Carga batida",
      "Tipo",
      "N° NFe",
      "Pedidos",
      "Status",
    ]) {
      expect(text).toContain(header);
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
