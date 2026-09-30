import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStorePresence } from "../../src/presence/useStorePresence";

function PresenceHarness() {
  useStorePresence(true);
  return <div>presença ativa</div>;
}

function interactionFromCall(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
) {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as { interacted: boolean };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("presença na tela do conferente", () => {
  it("agrupa atividade, envia heartbeat e cancela ao desmontar", async () => {
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(interactionFromCall(fetchMock, 3)).toEqual({ interacted: false });

    fireEvent.pointerMove(window);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(interactionFromCall(fetchMock, 4)).toEqual({ interacted: true });

    unmount();
    const callsAfterUnmount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterUnmount);
  });
});
