import { apiFetch } from "./api.js";

export const HEARTBEAT_MS = 2 * 60 * 1000;
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
export const REALTIME_IDLE_MS = 30_000;
export const REALTIME_IDLE_CHECK_MS = 5_000;
export const REALTIME_HEARTBEAT_MS = 20_000;

const INPUT_EVENTS = ["pointermove", "pointerdown", "keydown", "scroll", "focus"];

// Versão nativa do comportamento de src/presence/useStorePresence.ts da main.
export function createStorePresence({
  request = apiFetch,
  realtime,
  win = window,
  doc = document,
  now = () => Date.now()
} = {}) {
  let active = false;
  let lastInteractionSentAt = 0;
  let interactedSinceSignal = true;
  let lastRealtimeInteractionAt = 0;
  let realtimePresence = null;
  let heartbeatTimer = null;
  let idleCheckTimer = null;
  let realtimeHeartbeatTimer = null;
  let offRealtime = null;

  const sendPresence = async interacted => {
    if (!active) return;
    try {
      await request("/api/store/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interacted })
      });
      if (interacted) {
        lastInteractionSentAt = now();
        interactedSinceSignal = false;
      }
    } catch {
      if (interacted) interactedSinceSignal = true;
    }
  };

  const sendRealtimePresence = status => {
    if (realtimePresence === status) return;
    if (realtime?.send({ version: 1, type: "presence.set", status })) {
      realtimePresence = status;
    }
  };

  const markInteraction = () => {
    if (!active) return;
    interactedSinceSignal = true;
    if (now() - lastInteractionSentAt > ONLINE_WINDOW_MS) void sendPresence(true);
  };
  const onVisibility = () => {
    if (doc.visibilityState === "visible") markInteraction();
    else void sendPresence(false);
  };
  const markRealtimeInteraction = () => {
    lastRealtimeInteractionAt = now();
    if (doc.visibilityState === "visible") sendRealtimePresence("online");
  };
  const onRealtimeVisibility = () => {
    if (doc.visibilityState === "visible") markRealtimeInteraction();
    else sendRealtimePresence("away");
  };

  const clearRealtimeListeners = () => {
    if (idleCheckTimer !== null) win.clearInterval(idleCheckTimer);
    if (realtimeHeartbeatTimer !== null) win.clearInterval(realtimeHeartbeatTimer);
    idleCheckTimer = null;
    realtimeHeartbeatTimer = null;
    doc.removeEventListener("visibilitychange", onRealtimeVisibility);
    for (const name of INPUT_EVENTS) win.removeEventListener(name, markRealtimeInteraction);
    realtimePresence = null;
  };

  const onRealtimeStatus = () => {
    clearRealtimeListeners();
    const state = realtime?.state;
    if (!active || state?.mode !== "on" || state?.status !== "connected") return;
    lastRealtimeInteractionAt = now();
    for (const name of INPUT_EVENTS) win.addEventListener(name, markRealtimeInteraction, { passive: true });
    doc.addEventListener("visibilitychange", onRealtimeVisibility);
    sendRealtimePresence(doc.visibilityState === "visible" ? "online" : "away");
    idleCheckTimer = win.setInterval(() => {
      if (doc.visibilityState === "visible" && now() - lastRealtimeInteractionAt >= REALTIME_IDLE_MS) {
        sendRealtimePresence("away");
      }
    }, REALTIME_IDLE_CHECK_MS);
    realtimeHeartbeatTimer = win.setInterval(() => {
      realtime.send({ version: 1, type: "presence.heartbeat" });
    }, REALTIME_HEARTBEAT_MS);
  };

  async function disconnect() {
    if (!active) return;
    realtime?.send({ version: 1, type: "presence.set", status: "away" });
    try {
      await request("/api/store/presence", { method: "DELETE" });
    } catch {
      // A presença via D1 expira sozinha; a sessão encerra também o WebSocket.
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    if (heartbeatTimer !== null) win.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    doc.removeEventListener("visibilitychange", onVisibility);
    for (const name of INPUT_EVENTS) win.removeEventListener(name, markInteraction);
    offRealtime?.();
    offRealtime = null;
    clearRealtimeListeners();
  }

  return {
    start() {
      if (active) return;
      active = true;
      lastInteractionSentAt = now();
      interactedSinceSignal = true;
      void sendPresence(true);
      for (const name of INPUT_EVENTS) win.addEventListener(name, markInteraction, { passive: true });
      doc.addEventListener("visibilitychange", onVisibility);
      heartbeatTimer = win.setInterval(() => {
        const interacted = interactedSinceSignal;
        interactedSinceSignal = false;
        void sendPresence(interacted);
      }, HEARTBEAT_MS);
      offRealtime = realtime?.onStatus(onRealtimeStatus) || null;
      onRealtimeStatus();
    },
    disconnect,
    stop
  };
}
