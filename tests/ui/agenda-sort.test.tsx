import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AgendaList } from "../../src/agenda/AgendaList";
import type { StoreAppointment } from "../../src/agenda/types";

afterEach(cleanup);

function appointment(
  id: string,
  startTime: string,
  supplier: string,
  protocol: string,
): StoreAppointment {
  return {
    id,
    protocol,
    startTime,
    endTime: startTime,
    supplier,
    items: 1,
    volumes: 1,
    pallets: 0,
    cargaBatida: null,
    type: "Pedido",
    nfe: [],
    orders: [],
    status: "aguardando",
    hasExchanges: false,
    ativo: true,
  };
}

describe("AgendaList sorting", () => {
  it("faz o ciclo decrescente, crescente e padrão nas colunas ordenáveis", () => {
    render(
      <AgendaList
        editable={false}
        appointments={[
          appointment("late", "10:00", "ZETA LTDA", "300"),
          appointment("early", "08:00", "ALFA LTDA", "100"),
          appointment("middle", "09:00", "BETA LTDA", "200"),
        ]}
      />,
    );

    for (const label of ["Horário", "Fornecedor", "Protocolo", "Tipo", "Status"]) {
      expect(
        within(screen.getByRole("columnheader", { name: label })).getByRole("button", {
          name: label,
        }),
      ).toBeInTheDocument();
    }

    expect(screen.queryByRole("button", { name: "Ações" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trocas" })).not.toBeInTheDocument();

    const supplierHeader = screen.getByRole("columnheader", { name: "Fornecedor" });
    const supplierButton = within(supplierHeader).getByRole("button", {
      name: "Fornecedor",
    });
    const suppliers = () =>
      screen.getAllByTestId("agenda-desktop-row").map((row) =>
        within(row).getAllByRole("cell")[1].textContent,
      );

    expect(suppliers()).toEqual(["ALFA LTDA", "BETA LTDA", "ZETA LTDA"]);

    fireEvent.click(supplierButton);
    expect(supplierHeader).toHaveAttribute("aria-sort", "descending");
    expect(suppliers()).toEqual(["ZETA LTDA", "BETA LTDA", "ALFA LTDA"]);

    fireEvent.click(supplierButton);
    expect(supplierHeader).toHaveAttribute("aria-sort", "ascending");
    expect(suppliers()).toEqual(["ALFA LTDA", "BETA LTDA", "ZETA LTDA"]);

    fireEvent.click(supplierButton);
    expect(supplierHeader).toHaveAttribute("aria-sort", "none");
    expect(suppliers()).toEqual(["ALFA LTDA", "BETA LTDA", "ZETA LTDA"]);
  });
});
