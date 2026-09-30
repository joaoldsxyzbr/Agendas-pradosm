import { useCallback, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";

const HEARTBEAT_MS = 2 * 60 * 1000;
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function useStorePresence(enabled: boolean) {
  const lastInteractionSentAt = useRef(0);
  const interactedSinceSignal = useRef(true);

  const sendPresence = useCallback(
    async (interacted: boolean) => {
      if (!enabled) return;

      try {
        await apiFetch<{ ok: boolean; recordedAt: string }>(
          "/api/store/presence",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interacted }),
          },
        );

        if (interacted) {
          lastInteractionSentAt.current = Date.now();
          interactedSinceSignal.current = false;
        }
      } catch {
        if (interacted) {
          interactedSinceSignal.current = true;
        }
      }
    },
    [enabled],
  );

  const disconnect = useCallback(async () => {
    if (!enabled) return;

    try {
      await apiFetch<void>("/api/store/presence", { method: "DELETE" });
    } catch {
      // A expiração de 7 minutos cobre quedas ou encerramentos abruptos.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    lastInteractionSentAt.current = 0;
    interactedSinceSignal.current = true;
    void sendPresence(true);

    const markInteraction = () => {
      interactedSinceSignal.current = true;

      if (
        Date.now() - lastInteractionSentAt.current >
        ONLINE_WINDOW_MS
      ) {
        void sendPresence(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markInteraction();
      } else {
        void sendPresence(false);
      }
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      "pointermove",
      "pointerdown",
      "keydown",
      "scroll",
      "focus",
    ];

    for (const eventName of interactionEvents) {
      window.addEventListener(eventName, markInteraction, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    const heartbeat = window.setInterval(() => {
      const interacted = interactedSinceSignal.current;
      interactedSinceSignal.current = false;
      void sendPresence(interacted);
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, markInteraction);
      }
    };
  }, [enabled, sendPresence]);

  return { disconnect };
}
