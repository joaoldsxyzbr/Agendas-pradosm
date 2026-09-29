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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function agenda(recebido: number) {
  return [
    {
      id: "a1",
      storeCode: "F03",
      storeName: "Canasvieiras",
      date: "2026-09-28",
      total: 2,
      aguardando: 2 - recebido,
      recebido,
      naoChegou: 0,
      recusado: 0,
      semAgenda: 0,
      dayStatus: "aberto",
      completedAt: null,
      completedBy: null,
    },
  ];
}

describe("atualizacao do dashboard", () => {
  it("atualiza pelo botao sem registrar polling periodico", async () => {
    let agendaReads = 0;
    const setIntervalSpy = vi.spyOn(window, "setInterval");

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
          agendaReads += 1;
          return json(agenda(agendaReads === 1 ? 1 : 2));
        }
        return new Response(null, { status: 404 });
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("dashboard-store-F03");
    expect(within(card).getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(await within(card).findByText("2 / 2")).toBeInTheDocument();
    expect(agendaReads).toBe(2);
    expect(
      setIntervalSpy.mock.calls.some(([, delay]) => delay === 10_000),
    ).toBe(false);
  });

  it("atualiza silenciosamente quando a aba volta a ficar visivel", async () => {
    let agendaReads = 0;

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
          agendaReads += 1;
          return json(agenda(agendaReads === 1 ? 1 : 2));
        }
        return new Response(null, { status: 404 });
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId("dashboard-store-F03");
    expect(within(card).getByText("1 / 2")).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(await within(card).findByText("2 / 2")).toBeInTheDocument();
    expect(agendaReads).toBe(2);
  });
});
