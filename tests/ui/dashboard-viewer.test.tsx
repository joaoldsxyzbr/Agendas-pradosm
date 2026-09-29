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

describe("visualizador do dashboard", () => {
  it("mantém consulta e esconde importação", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/admin/stores") {
          return json([
            { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
          ]);
        }

        if (url.startsWith("/api/admin/agendas?date=")) {
          return json([]);
        }

        return new Response(null, { status: 404 });
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage readOnly />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Canasvieiras")).toBeInTheDocument();
    expect(screen.getByText("Acompanhamento")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Importar agenda" }),
    ).not.toBeInTheDocument();
  });

  it("não mostra reabertura em agenda concluída", async () => {
    const stores = [
      { id: "s1", codigo: "F05", nome: "Pagani", ativo: true },
    ];
    const agendas = [
      {
        id: "a5",
        storeCode: "F05",
        storeName: "Pagani",
        date: "2026-09-29",
        total: 1,
        aguardando: 0,
        recebido: 1,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
        dayStatus: "concluido",
        completedAt: "2026-09-29T18:00:00.000Z",
        completedBy: { id: "u1", name: "Conferente" },
      },
    ];
    const detail = {
      agenda: agendas[0],
      appointments: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/admin/stores") return json(stores);
        if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);
        if (url === "/api/admin/agendas/a5") return json(detail);

        return new Response(null, { status: 404 });
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage readOnly />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("dashboard-store-F05");
    fireEvent.click(
      within(card).getByRole("button", { name: "Ver detalhes" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Agenda F05 - Pagani",
    });
    expect(within(dialog).getByText("Somente leitura")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "Reabrir para conferente",
      }),
    ).not.toBeInTheDocument();
  });

});
