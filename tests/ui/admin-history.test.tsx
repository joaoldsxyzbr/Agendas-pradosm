import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAgendaHistoryPage } from "../../src/admin/AdminAgendaHistoryPage";

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
  vi.restoreAllMocks();
});

describe("AdminAgendaHistoryPage", () => {
  it("filtra por loja/data, abre detalhes e histórico de status", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/stores") {
        return json([
          { id: "s1", codigo: "F03", nome: "LOJA 03", ativo: true },
        ]);
      }

      if (
        url ===
        "/api/admin/agendas?date=2026-09-24&storeCode=F03"
      ) {
        return json([
          {
            id: "agenda-1",
            storeCode: "F03",
            storeName: "LOJA 03",
            date: "2026-09-24",
            total: 1,
            aguardando: 1,
            recebido: 0,
            naoChegou: 0,
            recusado: 0,
          },
        ]);
      }

      if (url === "/api/admin/agendas/agenda-1") {
        return json({
          agenda: {
            id: "agenda-1",
            storeCode: "F03",
            storeName: "LOJA 03",
            date: "2026-09-24",
          },
          appointments: [
            {
              id: "appt-1",
              protocol: "90000001",
              startTime: "08:00",
              endTime: "08:10",
              supplier: "FORNECEDOR TESTE",
              status: "recebido",
              ativo: true,
              nfe: [],
              orders: [],
            },
          ],
        });
      }

      if (url === "/api/admin/appointments/appt-1/history") {
        return json([
          {
            id: "h1",
            statusAnterior: "aguardando",
            statusNovo: "recebido",
            alteradoEm: "2026-09-24T12:00:00.000Z",
            usuario: { id: "u1", nome: "Conferente" },
          },
        ]);
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAgendaHistoryPage />);

    const store = await screen.findByLabelText("Loja");
    fireEvent.change(store, { target: { value: "F03" } });
    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-09-24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(await screen.findByText("LOJA 03")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir agenda" }));

    expect(await screen.findByText("FORNECEDOR TESTE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico" }));

    expect(await screen.findByText("aguardando → recebido")).toBeInTheDocument();
    expect(screen.getByText("Conferente")).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/agendas?date=2026-09-24&storeCode=F03",
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });
});
