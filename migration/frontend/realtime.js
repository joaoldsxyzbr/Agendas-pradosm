import { apiFetch } from "./api.js";

export const PING_INTERVAL_MS = 30_000;
export const PONG_TIMEOUT_MS = 10_000;
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

function isPresenceStatus(value) {
  return value === "online" || value === "away" || value === "offline";
}

// Validação equivalente a isRealtimeServerEvent em useRealtimeConnection.ts.
export function isRealtimeServerEvent(value) {
  if (!value || typeof value !== "object" || value.version !== 1) return false;
  if (value.type === "realtime.ready") return true;
  if (value.type === "presence.changed") {
    return typeof value.storeId === "string" && isPresenceStatus(value.status);
  }
  if (value.type === "presence.snapshot") {
    return Array.isArray(value.stores) &&
      value.stores.every(entry =>
        entry && typeof entry === "object" &&
        typeof entry.storeId === "string" && isPresenceStatus(entry.status)
      );
  }
  if (value.type === "agenda.changed") {
    return typeof value.agendaId === "string" &&
      typeof value.storeId === "string" &&
      typeof value.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      ["status", "exchanges", "manual", "day-status", "import"].includes(value.reason);
  }
  return false;
}

export function createRealtimeClient({
  request = apiFetch,
  Socket = WebSocket,
  location = window.location,
  timers = window
} = {}) {
  let state = { mode: "off", status: "disabled" };
  const statusListeners = new Set();
  const eventListeners = new Set();
  let socket = null;
  let activeSocket = null;
  let generation = 0;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let pingTimer = null;
  let pongTimer = null;

  const updateState = next => {
    if (state.mode === next.mode && state.status === next.status) return;
    state = next;
    for (const listener of statusListeners) listener(state);
  };
  const clearConnectionTimers = () => {
    if (pingTimer !== null) timers.clearInterval(pingTimer);
    if (pongTimer !== null) timers.clearTimeout(pongTimer);
    pingTimer = null;
    pongTimer = null;
  };
  const clearTimers = () => {
    if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    clearConnectionTimers();
  };
  const url = () => {
    const result = new URL("/api/realtime", location.href);
    result.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return result.toString();
  };
  const connect = token => {
    if (token !== generation || state.mode === "off") return;
    clearConnectionTimers();
    updateState({ mode: state.mode, status: "connecting" });
    const current = new Socket(url());
    socket = current;
    current.onopen = () => {
      if (generation !== token || socket !== current) return;
      reconnectAttempt = 0;
      pingTimer = timers.setInterval(() => {
        if (current.readyState !== Socket.OPEN) return;
        current.send("ping");
        if (pongTimer !== null) timers.clearTimeout(pongTimer);
        pongTimer = timers.setTimeout(() => {
          if (current.readyState === Socket.OPEN) current.close(4000, "Realtime sem resposta.");
        }, PONG_TIMEOUT_MS);
      }, PING_INTERVAL_MS);
    };
    current.onmessage = event => {
      if (generation !== token || socket !== current) return;
      if (event.data === "pong") {
        if (pongTimer !== null) timers.clearTimeout(pongTimer);
        pongTimer = null;
        return;
      }
      try {
        const parsed = JSON.parse(String(event.data));
        if (!isRealtimeServerEvent(parsed)) {
          console.warn("Evento realtime inválido ignorado.");
          return;
        }
        if (parsed.type === "realtime.ready") {
          activeSocket = current;
          updateState({ mode: state.mode, status: "connected" });
        }
        for (const listener of eventListeners) listener(parsed);
      } catch {
        console.warn("Mensagem realtime inválida ignorada.");
      }
    };
    current.onerror = () => {
      if (current.readyState === Socket.OPEN) current.close(4002, "Falha na conexão realtime.");
    };
    current.onclose = event => {
      if (socket === current) socket = null;
      if (activeSocket === current) activeSocket = null;
      clearConnectionTimers();
      if (generation !== token) return;
      if (event?.code === 4003) {
        updateState({ mode: "off", status: "disabled" });
        return;
      }
      if (reconnectTimer !== null || state.mode === "off") return;
      updateState({ mode: state.mode, status: "reconnecting" });
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt++;
      reconnectTimer = timers.setTimeout(() => {
        reconnectTimer = null;
        connect(token);
      }, delay);
    };
  };

  function stop() {
    generation++;
    clearTimers();
    const current = socket;
    socket = null;
    activeSocket = null;
    reconnectAttempt = 0;
    if (current && (current.readyState === Socket.OPEN || current.readyState === Socket.CONNECTING)) {
      current.close(1000, "Sessão encerrada.");
    }
    updateState({ mode: "off", status: "disabled" });
  }

  async function start(sessionKey) {
    stop();
    if (!sessionKey) return;
    const token = generation;
    try {
      const config = await request("/api/realtime/config");
      if (token !== generation || config.protocolVersion !== 1) return;
      if (!["on", "shadow", "off"].includes(config.mode)) return;
      if (config.mode === "off") {
        updateState({ mode: "off", status: "disabled" });
        return;
      }
      updateState({ mode: config.mode, status: "connecting" });
      connect(token);
    } catch {
      if (token === generation) updateState({ mode: "off", status: "disabled" });
    }
  }

  return {
    get state() { return state; },
    start, stop,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    send(message) {
      if (state.mode !== "on" || state.status !== "connected" ||
          !activeSocket || activeSocket.readyState !== Socket.OPEN) return false;
      activeSocket.send(JSON.stringify(message));
      return true;
    }
  };
}
