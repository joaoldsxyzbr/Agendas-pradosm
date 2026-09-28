import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("dashboard em tempo real", () => {
  it("atualiza os números automaticamente a cada 10 segundos", async () => {
    vi.useFakeTimers();
    let agendaReads = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/stores") {
        return json([
          { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
        ]);
      }
      if (url.startsWith("/api/admin/agendas?date=")) {
        agendaReads += 1;
        return json([
          {
            id: "a1",
            storeCode: "F03",
            storeName: "Canasvieiras",
            date: "2026-09-28",
            total: 2,
            aguardando: agendaReads === 1 ? 1 : 0,
            recebido: agendaReads === 1 ? 1 : 2,
            naoChegou: 0,
            recusado: 0,
            semAgenda: 0,
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const card = await screen.findByTestId("dashboard-store-F03");
    expect(within(card).getByText("1 / 2")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await Promise.resolve();
    });

    expect(within(card).getByText("2 / 2")).toBeInTheDocument();
    expect(agendaReads).toBeGreaterThanOrEqual(2);
  });
});
