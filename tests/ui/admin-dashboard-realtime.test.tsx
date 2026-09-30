import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
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
});
