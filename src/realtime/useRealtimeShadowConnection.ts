import { useEffect } from "react";
import type {
  RealtimeConfig,
  RealtimeServerEvent,
} from "../../shared/realtime";
import { apiFetch } from "../lib/api";

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

function websocketUrl() {
  const url = new URL("/api/realtime", window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function isReadyEvent(value: unknown): value is RealtimeServerEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; type?: unknown };
  return candidate.version === 1 && candidate.type === "realtime.ready";
}

export function useRealtimeShadowConnection(sessionKey: string | null) {
  useEffect(() => {
    if (!sessionKey) return;

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let pongTimer: number | null = null;

    const clearTimers = () => {
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (pongTimer !== null) window.clearTimeout(pongTimer);

      reconnectTimer = null;
      pingTimer = null;
      pongTimer = null;
    };

    const clearConnectionTimers = () => {
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (pongTimer !== null) window.clearTimeout(pongTimer);
      pingTimer = null;
      pongTimer = null;
    };

    const scheduleReconnect = (connect: () => void) => {
      if (!active || reconnectTimer !== null) return;

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
      if (!active) return;

      clearConnectionTimers();

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
          if (!isReadyEvent(parsed)) {
            console.warn("Evento realtime ignorado no shadow mode.");
          }
        } catch {
          console.warn("Mensagem realtime inválida no shadow mode.");
        }
      };

      current.onerror = () => {
        if (current.readyState === WebSocket.OPEN) {
          current.close(1011, "Falha na conexão realtime.");
        }
      };

      current.onclose = () => {
        if (socket === current) socket = null;
        clearConnectionTimers();
        scheduleReconnect(connect);
      };
    };

    void apiFetch<RealtimeConfig>("/api/realtime/config")
      .then((config) => {
        if (!active || config.protocolVersion !== 1) return;
        if (config.mode === "shadow" || config.mode === "on") {
          connect();
        }
      })
      .catch(() => {
        // O shadow mode nunca deve interferir no fluxo HTTP atual.
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

      socket = null;
    };
  }, [sessionKey]);
}
