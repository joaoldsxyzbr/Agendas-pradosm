import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/admin/DashboardPage";
import { useRealtimeConnection } from "../../src/realtime/useRealtimeConnection";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(_url: string | URL) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  send(_data: string) {}

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function Harness() {
  useRealtimeConnection("admin-realtime");
  return (
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  MockWebSocket.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("dashboard com presença realtime", () => {
  it("usa snapshot e transições do WebSocket quando a conexão está ativa", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);

    const stores = [
      { id: "s1", codigo: "F03", nome: "Canasvieiras", ativo: true },
    ];
    const agendas = [
      {
        id: "a1",
        storeCode: "F03",
        storeName: "Canasvieiras",
        date: "2026-09-30",
        total: 1,
        aguardando: 1,
        recebido: 0,
        naoChegou: 0,
        recusado: 0,
        semAgenda: 0,
        dayStatus: "aberto",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/realtime/config") {
        return json({ mode: "on", protocolVersion: 1 });
      }
      if (url === "/api/admin/stores") return json(stores);
      if (url === "/api/admin/presence") {
        return json([{ storeId: "s1", status: "offline" }]);
      }
      if (url.startsWith("/api/admin/agendas?date=")) return json(agendas);

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness />);
    await flushPromises();

    const card = await screen.findByTestId("dashboard-store-F03");
    expect(
      within(card).getByLabelText("Conferente offline"),
    ).toBeInTheDocument();

    const socket = MockWebSocket.instances[0];
    act(() => socket.open());
    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "realtime.ready",
        }),
      ),
    );
    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "presence.snapshot",
          stores: [{ storeId: "s1", status: "online" }],
        }),
      ),
    );

    expect(
      within(card).getByLabelText("Conferente online"),
    ).toBeInTheDocument();

    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "presence.changed",
          storeId: "s1",
          status: "away",
        }),
      ),
    );

    expect(
      within(card).getByLabelText("Conferente ausente"),
    ).toBeInTheDocument();
  });
  it("invalida somente a data afetada e atualiza o preview aberto", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);

    const stores = [
      { id: "s2", codigo: "F04", nome: "Centro", ativo: true },
    ];
    let agendaReads = 0;
    let detailReads = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/realtime/config") {
        return json({ mode: "on", protocolVersion: 1 });
      }
      if (url === "/api/admin/stores") return json(stores);
      if (url === "/api/admin/presence") return json([]);
      if (url.startsWith("/api/admin/agendas?date=")) {
        agendaReads += 1;
        return json([
          {
            id: "a2",
            storeCode: "F04",
            storeName: "Centro",
            date: "2026-09-30",
            total: 1,
            aguardando: agendaReads === 1 ? 1 : 0,
            recebido: agendaReads === 1 ? 0 : 1,
            naoChegou: 0,
            recusado: 0,
            semAgenda: 0,
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
          },
        ]);
      }
      if (url === "/api/admin/agendas/a2") {
        detailReads += 1;
        return json({
          agenda: {
            id: "a2",
            storeCode: "F04",
            storeName: "Centro",
            date: "2026-09-30",
            dayStatus: "aberto",
            completedAt: null,
            completedBy: null,
          },
          appointments: [
            {
              id: "ap2",
              protocol: "98000002",
              startTime: "08:00",
              endTime: "09:00",
              supplier: "Fornecedor Realtime",
              items: 1,
              volumes: 1,
              pallets: 0,
              cargaBatida: null,
              type: "Pedido",
              nfe: [],
              orders: [],
              status: detailReads === 1 ? "aguardando" : "recebido",
              hasExchanges: detailReads > 1,
              origin: "imported",
              ativo: true,
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness />);
    await flushPromises();

    const card = screen.getByTestId("dashboard-store-F04");
    expect(within(card).getByText("0 / 1")).toBeInTheDocument();

    const socket = MockWebSocket.instances[0];
    act(() => socket.open());
    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "realtime.ready",
        }),
      ),
    );
    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "presence.snapshot",
          stores: [],
        }),
      ),
    );

    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "agenda.changed",
          agendaId: "a2",
          storeId: "s2",
          date: "2026-09-30",
          reason: "status",
        }),
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75);
      await Promise.resolve();
    });

    expect(within(card).getByText("1 / 1")).toBeInTheDocument();
    expect(agendaReads).toBe(2);

    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "agenda.changed",
          agendaId: "outro",
          storeId: "s2",
          date: "2026-10-01",
          reason: "import",
        }),
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(agendaReads).toBe(2);

    fireEvent.click(
      within(card).getByRole("button", { name: "Ver detalhes" }),
    );
    await flushPromises();

    const dialog = screen.getByRole("dialog", {
      name: "Agenda F04 - Centro",
    });
    expect(within(dialog).getAllByText("Aguardando").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Não").length).toBeGreaterThan(0);

    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "agenda.changed",
          agendaId: "a2",
          storeId: "s2",
          date: "2026-09-30",
          reason: "exchanges",
        }),
      ),
    );
    await flushPromises();

    expect(within(dialog).getAllByText("Recebido").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("Sim").length).toBeGreaterThan(0);
    expect(detailReads).toBe(2);
  });

});
