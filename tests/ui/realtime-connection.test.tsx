import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REALTIME_PROTOCOL_VERSION } from "../../shared/realtime";
import {
  sendRealtimeMessage,
  useRealtimeConnection,
} from "../../src/realtime/useRealtimeConnection";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  error() {
    this.onerror?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.closeCalls.push({ code, reason });
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

function Harness({ sessionKey }: { sessionKey: string | null }) {
  useRealtimeConnection(sessionKey);
  return null;
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

describe("cliente realtime", () => {
  it("não abre WebSocket quando o servidor mantém realtime desligado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ mode: "off", protocolVersion: 1 })),
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    render(<Harness sessionKey="user-off" />);
    await flushPromises();

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("mantém shadow mode sem permitir mensagens funcionais", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ mode: "shadow", protocolVersion: 1 })),
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    const { unmount } = render(<Harness sessionKey="user-shadow" />);
    await flushPromises();

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain("/api/realtime");

    act(() => socket.open());
    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "realtime.ready",
        }),
      ),
    );

    expect(
      sendRealtimeMessage({
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat",
      }),
    ).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(socket.sent).toEqual(["ping"]);

    act(() => socket.message("pong"));
    unmount();

    expect(socket.closeCalls.at(-1)).toEqual({
      code: 1000,
      reason: "Sessão encerrada.",
    });
  });

  it("permite mensagens funcionais somente em modo on após ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ mode: "on", protocolVersion: 1 })),
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    render(<Harness sessionKey="user-on" />);
    await flushPromises();

    const socket = MockWebSocket.instances[0];
    act(() => socket.open());

    expect(
      sendRealtimeMessage({
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat",
      }),
    ).toBe(false);

    act(() =>
      socket.message(
        JSON.stringify({
          version: 1,
          type: "realtime.ready",
        }),
      ),
    );

    expect(
      sendRealtimeMessage({
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat",
      }),
    ).toBe(true);

    expect(socket.sent).toContain(
      JSON.stringify({
        version: 1,
        type: "presence.heartbeat",
      }),
    );
  });

  it("fecha erro do navegador com código de aplicação válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ mode: "on", protocolVersion: 1 })),
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    render(<Harness sessionKey="user-error" />);
    await flushPromises();

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

    act(() => socket.error());

    expect(socket.closeCalls.at(-1)).toEqual({
      code: 4002,
      reason: "Falha na conexão realtime.",
    });
  });

  it("reconecta com atraso progressivo quando a conexão cai", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ mode: "on", protocolVersion: 1 })),
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    render(<Harness sessionKey="user-reconnect" />);
    await flushPromises();

    const first = MockWebSocket.instances[0];
    act(() => first.open());
    act(() => first.close(1006, "queda"));

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
