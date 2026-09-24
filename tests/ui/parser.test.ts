import { describe, expect, it } from "vitest";
import fixture from "../fixtures/agenda-sintetica.txt?raw";
import { parseAgendaText } from "../../src/import/parseAgendaText";

describe("parseAgendaText", () => {
  it("interpreta a agenda sintética completa", () => {
    const result = parseAgendaText(fixture);

    expect(result.storeCode).toBe("F99");
    expect(result.storeName).toBe("LOJA TESTE");
    expect(result.date).toBe("2026-09-24");
    expect(result.blockingErrors).toEqual([]);
    expect(result.appointments).toHaveLength(6);
    expect(result.appointments[0]).toMatchObject({
      protocol: "90000001",
      startTime: "08:00",
      endTime: "08:10",
      supplier: "DISTRIBUIDORA ALFA ALIMENTOS LTDA",
      items: 10,
      volumes: 5,
      pallets: 1,
      cargaBatida: null,
      type: "Nota fiscal",
      status: "aguardando",
    });
  });

  it("preserva listas múltiplas de NF-e e pedidos", () => {
    const result = parseAgendaText(fixture);

    expect(result.appointments[0].nfe).toEqual(["111111", "222222"]);
    expect(result.appointments[0].orders).toEqual(["50001", "50002"]);
    expect(result.appointments[1].nfe).toEqual([]);
    expect(result.appointments[1].orders).toEqual(["50003", "50004"]);
  });

  it("reconhece os quatro tipos conhecidos", () => {
    const result = parseAgendaText(fixture);

    expect(result.appointments.map((appointment) => appointment.type)).toEqual([
      "Nota fiscal",
      "Pedido",
      "CNPJ",
      "Agenda fixa",
      "Nota fiscal",
      "Pedido",
    ]);
  });

  it("bloqueia texto sem filial", () => {
    const result = parseAgendaText(
      fixture.replace("Filiais: F99 - LOJA TESTE", "Filiais: -"),
    );

    expect(result.storeCode).toBeNull();
    expect(result.blockingErrors).toContain("FILIAL_NAO_IDENTIFICADA");
  });

  it("bloqueia texto sem data no cabeçalho", () => {
    const result = parseAgendaText(
      fixture.replace("Dia: 24/09/2026", "Dia: -"),
    );

    expect(result.date).toBeNull();
    expect(result.blockingErrors).toContain("DATA_NAO_IDENTIFICADA");
  });

  it("bloqueia texto sem registros válidos", () => {
    const result = parseAgendaText(
      "Prado Supermercados Filtros: Dia: 24/09/2026 | Filiais: F99 - LOJA TESTE | Doca: Todas\nAgendas de recebimento Total: 0",
    );

    expect(result.appointments).toEqual([]);
    expect(result.blockingErrors).toContain("SEM_AGENDAMENTOS_VALIDOS");
  });

  it("mantém registros válidos e bloqueia texto parcialmente interpretável", () => {
    const result = parseAgendaText(
      fixture.replace("08:50 às 09:00", "HORARIO INVALIDO"),
    );

    expect(result.appointments).toHaveLength(5);
    expect(
      result.blockingErrors.some((error) =>
        error.startsWith("REGISTROS_NAO_INTERPRETADOS:"),
      ),
    ).toBe(true);
  });
});
