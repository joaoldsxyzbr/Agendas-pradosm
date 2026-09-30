import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStorePresence } from "../../src/presence/useStorePresence";
import { useRealtimeConnection } from "../../src/realtime/useRealtimeConnection";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
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

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

function PresenceHarness() {
  useStorePresence(true);
  return <div>presença ativa</div>;
}

function RealtimePresenceHarness() {
  useRealtimeConnection("conferente-realtime");
  useStorePresence(true);
  return <div>presença realtime ativa</div>;
}

function interactionFromCall(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
) {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as { interacted: boolean };
}

function realtimeMessages(socket: MockWebSocket) {
  return socket.sent
    .filter((message) => message.startsWith("{"))
    .map((message) => JSON.parse(message) as Record<string, unknown>);
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("presença na tela do conferente", () => {
  it("mantém o heartbeat D1 como fallback e agrupa atividade", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          recordedAt: "2026-09-30T15:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<PresenceHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(interactionFromCall(fetchMock, 0)).toEqual({ interacted: true });

    for (let index = 0; index < 10; index += 1) {
      fireEvent.pointerMove(window);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(interactionFromCall(fetchMock, 1)).toEqual({ interacted: true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(interactionFromCall(fetchMock, 2)).toEqual({ interacted: false });

    unmount();
    const callsAfterUnmount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it("muda online e ausente em tempo real sem escrever no D1 por interação", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/realtime/config") {
          return new Response(
            JSON.stringify({ mode: "on", protocolVersion: 1 }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url === "/api/store/presence") {
          return new Response(
            JSON.stringify({
              ok: true,
              recordedAt: "2026-09-30T15:00:00.000Z",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RealtimePresenceHarness />);
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(realtimeMessages(socket)).toContainEqual({
      version: 1,
      type: "presence.set",
      status: "online",
    });

    const d1CallsBeforeActivity = fetchMock.mock.calls.filter(
      ([input]) => String(input) === "/api/store/presence",
    ).length;

    for (let index = 0; index < 20; index += 1) {
      fireEvent.pointerMove(window);
    }

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/store/presence",
      ),
    ).toHaveLength(d1CallsBeforeActivity);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(realtimeMessages(socket)).toContainEqual({
      version: 1,
      type: "presence.set",
      status: "away",
    });
    expect(realtimeMessages(socket)).toContainEqual({
      version: 1,
      type: "presence.heartbeat",
    });

    fireEvent.pointerMove(window);

    expect(realtimeMessages(socket).at(-1)).toEqual({
      version: 1,
      type: "presence.set",
      status: "online",
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));

    expect(realtimeMessages(socket).at(-1)).toEqual({
      version: 1,
      type: "presence.set",
      status: "away",
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
});
