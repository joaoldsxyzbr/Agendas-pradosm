import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/admin/DashboardPage";

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("dashboard operacional", () => {
  it("resume o dia e destaca lojas que precisam de atenção", async () => {
    const stores = [
      { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
      { id: "s2", codigo: "F04", nome: "Centro", ativo: true },
      { id: "s3", codigo: "F05", nome: "Porto Belo", ativo: true },
    ];
    const agendas = [
      {
        id: "a1",
        storeCode: "F03",
        storeName: "Canasvieiras",
        date: "2026-09-25",
        total: 5,
        aguardando: 2,
        recebido: 2,
        naoChegou: 1,
        recusado: 0,
        semAgenda: 1,
      },
      {
        id: "a2",
        storeCode: "F04",
        storeName: "Centro",
        date: "2026-09-25",
        total: 3,
        aguardando: 0,
        recebido: 3,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => json(stores))
        .mockImplementationOnce(() => json(agendas)),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const summary = await screen.findByRole("region", {
      name: "Resumo operacional",
    });

    expect(within(summary).getByTestId("dashboard-kpi-total")).toHaveTextContent(
      "8",
    );
    expect(
      within(summary).getByTestId("dashboard-kpi-aguardando"),
    ).toHaveTextContent("2");
    expect(
      within(summary).getByTestId("dashboard-kpi-recebidos"),
    ).toHaveTextContent("5");
    expect(
      within(summary).getByTestId("dashboard-kpi-nao-chegaram"),
    ).toHaveTextContent("1");
    expect(
      within(summary).getByTestId("dashboard-kpi-recusados"),
    ).toHaveTextContent("0");
    expect(
      within(summary).getByTestId("dashboard-kpi-sem-agenda"),
    ).toHaveTextContent("1");
    expect(
      within(summary).getByTestId("dashboard-kpi-lojas-sem-agenda"),
    ).toHaveTextContent("1");

    const attention = screen.getByRole("region", { name: "Atenção agora" });
    expect(within(attention).getByText("F03")).toBeInTheDocument();
    expect(within(attention).getByText("2 aguardando")).toBeInTheDocument();
    expect(within(attention).getByText("F05")).toBeInTheDocument();
    expect(within(attention).getByText("Agenda não importada")).toBeInTheDocument();
    expect(within(attention).queryByText("F04")).not.toBeInTheDocument();

    const f03Card = screen.getByTestId("dashboard-store-F03");
    expect(within(f03Card).getByText("2 / 5")).toBeInTheDocument();
    expect(within(f03Card).getByText("1 sem agenda")).toBeInTheDocument();
  });

  it("mostra estado tranquilo quando nenhuma loja precisa de atenção", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() =>
          json([{ id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true }]),
        )
        .mockImplementationOnce(() =>
          json([
            {
              id: "a1",
              storeCode: "F03",
              storeName: "Canasvieiras",
              date: "2026-09-25",
              total: 2,
              aguardando: 0,
              recebido: 2,
              naoChegou: 0,
              recusado: 0,
              semAgenda: 0,
            },
          ]),
        ),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhuma pendência agora.")).toBeInTheDocument();
  });
});
