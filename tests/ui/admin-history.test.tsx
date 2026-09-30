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
            semAgenda: 0,
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
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
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
          },
          appointments: [
            {
              id: "appt-1",
              protocol: "90000001",
              startTime: "08:00",
              endTime: "08:10",
              supplier: "FORNECEDOR TESTE",
              status: "recebido",
              hasExchanges: false,
              ativo: true,
              nfe: [],
              orders: [],
            },
          ],
        });
      }

      if (url === "/api/admin/agendas/agenda-1/history") {
        return json([
          {
            id: "auto-close-1",
            action: "concluido_automaticamente",
            details: "Dia concluído automaticamente após a virada da data operacional.",
            changedAt: "2026-09-25T03:05:00.000Z",
            user: null,
          },
        ]);
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
    expect(
      screen.getByText("Dia concluído automaticamente"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sistema · Dia concluído automaticamente/)).toBeInTheDocument();

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

  it("edita dia concluído e permite reabrir para o conferente", async () => {
    let dayStatus: "aberto" | "concluido" = "concluido";
    let appointment = {
      id: "appt-edit",
      protocol: "90000002",
      startTime: "09:00",
      endTime: "09:10",
      supplier: "FORNECEDOR EDITAVEL",
      status: "aguardando",
      hasExchanges: false,
      ativo: true,
      nfe: [],
      orders: [],
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/stores") return json([]);
      if (url === "/api/admin/agendas?date=2026-09-24") {
        return json([{
          id: "agenda-edit",
          storeCode: "F04",
          storeName: "LOJA 04",
          date: "2026-09-24",
          total: 1,
          aguardando: 1,
          recebido: 0,
          naoChegou: 0,
          recusado: 0,
          semAgenda: 0,
          dayStatus,
          completedAt: "2026-09-24T20:00:00.000Z",
          completedBy: { id: "u1", name: "Conferente" },
        }]);
      }
      if (url === "/api/admin/agendas/agenda-edit" && !init?.method) {
        return json({
          agenda: {
            id: "agenda-edit",
            storeCode: "F04",
            storeName: "LOJA 04",
            date: "2026-09-24",
            dayStatus,
            completedAt: dayStatus === "concluido" ? "2026-09-24T20:00:00.000Z" : null,
            completedBy: dayStatus === "concluido" ? { id: "u1", name: "Conferente" } : null,
          },
          appointments: [appointment],
        });
      }
      if (url === "/api/admin/agendas/agenda-edit/history") {
        return json([]);
      }
      if (url === "/api/admin/appointments/appt-edit/status") {
        appointment = { ...appointment, status: "recebido" };
        return json(appointment);
      }
      if (url === "/api/admin/appointments/appt-edit/exchanges") {
        appointment = { ...appointment, hasExchanges: true };
        return json(appointment);
      }
      if (url === "/api/admin/agendas/agenda-edit/status") {
        dayStatus = "aberto";
        return json({
          id: "agenda-edit",
          storeCode: "F04",
          storeName: "LOJA 04",
          date: "2026-09-24",
          dayStatus,
          completedAt: null,
          completedBy: null,
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAgendaHistoryPage />);

    fireEvent.change(await screen.findByLabelText("Data"), {
      target: { value: "2026-09-24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abrir agenda" }));

    const statusSelect = await screen.findByLabelText("Status de FORNECEDOR EDITAVEL");
    fireEvent.change(statusSelect, { target: { value: "recebido" } });
    await waitFor(() => expect(statusSelect).toHaveValue("recebido"));

    const exchanges = screen.getByLabelText("Trocas de FORNECEDOR EDITAVEL");
    fireEvent.click(exchanges);
    await waitFor(() => expect(exchanges).toBeChecked());

    fireEvent.click(screen.getByRole("button", { name: "Reabrir para conferente" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Reabrir para conferente" }),
      ).not.toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/agendas/agenda-edit/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "aberto" }),
      }),
    );
  });

});
