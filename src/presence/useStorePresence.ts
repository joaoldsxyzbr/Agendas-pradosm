import { useCallback, useEffect, useRef } from "react";
import { REALTIME_PROTOCOL_VERSION } from "../../shared/realtime";
import { apiFetch } from "../lib/api";
import {
  sendRealtimeMessage,
  useRealtimeState,
} from "../realtime/useRealtimeConnection";

const HEARTBEAT_MS = 2 * 60 * 1000;
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

const REALTIME_IDLE_MS = 30_000;
const REALTIME_IDLE_CHECK_MS = 5_000;
const REALTIME_HEARTBEAT_MS = 20_000;

type LivePresenceStatus = "online" | "away";

export function useStorePresence(enabled: boolean) {
  const realtime = useRealtimeState();
  const lastInteractionSentAt = useRef(0);
  const interactedSinceSignal = useRef(true);
  const realtimePresence = useRef<LivePresenceStatus | null>(null);
  const lastRealtimeInteractionAt = useRef(0);

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

  const sendRealtimePresence = useCallback((status: LivePresenceStatus) => {
    if (realtimePresence.current === status) return;

    const sent = sendRealtimeMessage({
      version: REALTIME_PROTOCOL_VERSION,
      type: "presence.set",
      status,
    });

    if (sent) {
      realtimePresence.current = status;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!enabled) return;

    sendRealtimeMessage({
      version: REALTIME_PROTOCOL_VERSION,
      type: "presence.set",
      status: "away",
    });

    try {
      await apiFetch<void>("/api/store/presence", { method: "DELETE" });
    } catch {
      // O fallback D1 expira sozinho; o WebSocket encerra ao invalidar a sessão.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    lastInteractionSentAt.current = Date.now();
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

  useEffect(() => {
    if (
      !enabled ||
      realtime.mode !== "on" ||
      realtime.status !== "connected"
    ) {
      realtimePresence.current = null;
      return;
    }

    lastRealtimeInteractionAt.current = Date.now();

    const markRealtimeInteraction = () => {
      lastRealtimeInteractionAt.current = Date.now();

      if (document.visibilityState === "visible") {
        sendRealtimePresence("online");
      }
    };

    const handleRealtimeVisibility = () => {
      if (document.visibilityState === "visible") {
        markRealtimeInteraction();
      } else {
        sendRealtimePresence("away");
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
      window.addEventListener(eventName, markRealtimeInteraction, {
        passive: true,
      });
    }
    document.addEventListener(
      "visibilitychange",
      handleRealtimeVisibility,
    );

    if (document.visibilityState === "visible") {
      sendRealtimePresence("online");
    } else {
      sendRealtimePresence("away");
    }

    const idleCheck = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRealtimeInteractionAt.current >= REALTIME_IDLE_MS
      ) {
        sendRealtimePresence("away");
      }
    }, REALTIME_IDLE_CHECK_MS);

    const heartbeat = window.setInterval(() => {
      sendRealtimeMessage({
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat",
      });
    }, REALTIME_HEARTBEAT_MS);

    return () => {
      window.clearInterval(idleCheck);
      window.clearInterval(heartbeat);
      document.removeEventListener(
        "visibilitychange",
        handleRealtimeVisibility,
      );
      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, markRealtimeInteraction);
      }
      realtimePresence.current = null;
    };
  }, [
    enabled,
    realtime.mode,
    realtime.status,
    sendRealtimePresence,
  ]);

  return { disconnect };
}
