import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  it("mostra a operação por loja sem resumo geral", async () => {
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/stores") return json(stores);
      if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("region", { name: "Resumo operacional" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Atenção agora" }),
    ).not.toBeInTheDocument();

    const f03Card = await screen.findByTestId("dashboard-store-F03");
    expect(within(f03Card).getByText("2 / 5")).toBeInTheDocument();
    expect(within(f03Card).getByText("1 sem agenda")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Data da agenda" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Data da agenda" }));
    fireEvent.click(
      screen.getByRole("button", { name: "25 de setembro de 2026" }),
    );

    await screen.findByTestId("dashboard-store-F03");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas?date=2026-09-25",
      expect.objectContaining({ credentials: "include" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Importar agenda" }));
    expect(screen.getByRole("dialog", { name: "Importar agenda" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("dialog", { name: "Importar agenda" }),
    ).not.toBeInTheDocument();
  });

});
