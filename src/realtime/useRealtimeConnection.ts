import {
  useEffect,
  useSyncExternalStore,
  type DependencyList,
} from "react";
import type {
  RealtimeClientMessage,
  RealtimeConfig,
  RealtimeMode,
  RealtimePresenceStatus,
  RealtimeServerEvent,
} from "../../shared/realtime";
import { apiFetch } from "../lib/api";

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export type RealtimeConnectionStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "reconnecting";

export type RealtimeRuntimeState = {
  mode: RealtimeMode;
  status: RealtimeConnectionStatus;
};

let runtimeState: RealtimeRuntimeState = {
  mode: "off",
  status: "disabled",
};
let activeSocket: WebSocket | null = null;

const stateListeners = new Set<() => void>();
const eventListeners = new Set<(event: RealtimeServerEvent) => void>();

function websocketUrl() {
  const url = new URL("/api/realtime", window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function updateRuntimeState(next: RealtimeRuntimeState) {
  if (
    runtimeState.mode === next.mode &&
    runtimeState.status === next.status
  ) {
    return;
  }

  runtimeState = next;
  for (const listener of stateListeners) listener();
}

function subscribeState(listener: () => void) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

function currentState() {
  return runtimeState;
}

function emitServerEvent(event: RealtimeServerEvent) {
  for (const listener of eventListeners) listener(event);
}

function isPresenceStatus(value: unknown): value is RealtimePresenceStatus {
  return value === "online" || value === "away" || value === "offline";
}

function isRealtimeServerEvent(value: unknown): value is RealtimeServerEvent {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    version?: unknown;
    type?: unknown;
    agendaId?: unknown;
    storeId?: unknown;
    date?: unknown;
    reason?: unknown;
    status?: unknown;
    stores?: unknown;
  };

  if (candidate.version !== 1) return false;

  if (candidate.type === "realtime.ready") return true;

  if (candidate.type === "presence.changed") {
    return (
      typeof candidate.storeId === "string" &&
      isPresenceStatus(candidate.status)
    );
  }

  if (candidate.type === "presence.snapshot") {
    return (
      Array.isArray(candidate.stores) &&
      candidate.stores.every((store) => {
        if (!store || typeof store !== "object") return false;
        const entry = store as { storeId?: unknown; status?: unknown };
        return (
          typeof entry.storeId === "string" &&
          isPresenceStatus(entry.status)
        );
      })
    );
  }

  if (candidate.type === "agenda.changed") {
    return (
      typeof candidate.agendaId === "string" &&
      typeof candidate.storeId === "string" &&
      typeof candidate.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.date) &&
      (
        candidate.reason === "status" ||
        candidate.reason === "exchanges" ||
        candidate.reason === "manual" ||
        candidate.reason === "day-status" ||
        candidate.reason === "import"
      )
    );
  }

  return false;
}

export function useRealtimeState() {
  return useSyncExternalStore(subscribeState, currentState, currentState);
}

export function useRealtimeEvent(
  handler: (event: RealtimeServerEvent) => void,
  dependencies: DependencyList = [],
) {
  useEffect(() => {
    eventListeners.add(handler);
    return () => {
      eventListeners.delete(handler);
    };
  }, dependencies);
}

export function sendRealtimeMessage(message: RealtimeClientMessage) {
  if (
    runtimeState.mode !== "on" ||
    runtimeState.status !== "connected" ||
    !activeSocket ||
    activeSocket.readyState !== WebSocket.OPEN
  ) {
    return false;
  }

  activeSocket.send(JSON.stringify(message));
  return true;
}

export function useRealtimeConnection(sessionKey: string | null) {
  useEffect(() => {
    if (!sessionKey) {
      activeSocket = null;
      updateRuntimeState({ mode: "off", status: "disabled" });
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let mode: RealtimeMode = "off";
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let pongTimer: number | null = null;

    const clearConnectionTimers = () => {
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (pongTimer !== null) window.clearTimeout(pongTimer);
      pingTimer = null;
      pongTimer = null;
    };

    const clearTimers = () => {
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      clearConnectionTimers();
    };

    const scheduleReconnect = (connect: () => void) => {
      if (!active || reconnectTimer !== null || mode === "off") return;

      updateRuntimeState({ mode, status: "reconnecting" });

      const delay =
        RECONNECT_DELAYS_MS[
          Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
        ];
      reconnectAttempt += 1;

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (!active || mode === "off") return;

      clearConnectionTimers();
      updateRuntimeState({ mode, status: "connecting" });

      const current = new WebSocket(websocketUrl());
      socket = current;

      current.onopen = () => {
        if (!active || socket !== current) return;

        reconnectAttempt = 0;

        pingTimer = window.setInterval(() => {
          if (current.readyState !== WebSocket.OPEN) return;

          current.send("ping");

          if (pongTimer !== null) window.clearTimeout(pongTimer);
          pongTimer = window.setTimeout(() => {
            if (current.readyState === WebSocket.OPEN) {
              current.close(4000, "Realtime sem resposta.");
            }
          }, PONG_TIMEOUT_MS);
        }, PING_INTERVAL_MS);
      };

      current.onmessage = (event) => {
        if (!active || socket !== current) return;

        if (event.data === "pong") {
          if (pongTimer !== null) window.clearTimeout(pongTimer);
          pongTimer = null;
          return;
        }

        try {
          const parsed = JSON.parse(String(event.data)) as unknown;
          if (!isRealtimeServerEvent(parsed)) {
            console.warn("Evento realtime inválido ignorado.");
            return;
          }

          if (parsed.type === "realtime.ready") {
            activeSocket = current;
            updateRuntimeState({ mode, status: "connected" });
          }

          emitServerEvent(parsed);
        } catch {
          console.warn("Mensagem realtime inválida ignorada.");
        }
      };

      current.onerror = () => {
        if (current.readyState === WebSocket.OPEN) {
          current.close(4002, "Falha na conexão realtime.");
        }
      };

      current.onclose = (event) => {
        if (socket === current) socket = null;
        if (activeSocket === current) activeSocket = null;

        clearConnectionTimers();

        if (event?.code === 4003) {
          mode = "off";
          updateRuntimeState({ mode: "off", status: "disabled" });
          return;
        }

        scheduleReconnect(connect);
      };
    };

    void apiFetch<RealtimeConfig>("/api/realtime/config")
      .then((config) => {
        if (!active || config.protocolVersion !== 1) return;

        mode = config.mode;
        if (mode === "off") {
          updateRuntimeState({ mode, status: "disabled" });
          return;
        }

        connect();
      })
      .catch(() => {
        if (active) {
          mode = "off";
          updateRuntimeState({ mode: "off", status: "disabled" });
        }
      });

    return () => {
      active = false;
      clearTimers();

      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close(1000, "Sessão encerrada.");
      }

      if (activeSocket === socket) activeSocket = null;
      socket = null;
      mode = "off";
      updateRuntimeState({ mode: "off", status: "disabled" });
    };
  }, [sessionKey]);
}
