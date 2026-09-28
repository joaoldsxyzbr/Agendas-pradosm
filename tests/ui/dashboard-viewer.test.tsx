import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
});
