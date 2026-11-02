import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { presenceSchema, type Presence } from "@/features/receiving/model";

const configSchema = z.object({
  mode: z.enum(["on", "shadow", "off"]),
  protocolVersion: z.literal(1),
});
const changedSchema = z.object({
  version: z.literal(1),
  type: z.literal("agenda.changed"),
  agendaId: z.string(),
  storeId: z.string(),
  date: z.iso.date(),
  reason: z.enum(["status", "exchanges", "manual", "day-status", "import", "observation"]),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  type: z.literal("presence.snapshot"),
  stores: z.array(presenceSchema),
});
const presenceChangedSchema = z.object({
  version: z.literal(1),
  type: z.literal("presence.changed"),
  storeId: z.string(),
  status: z.enum(["online", "away", "offline"]),
});
const realtimeEventSchema = z.discriminatedUnion("type", [
  changedSchema, snapshotSchema, presenceChangedSchema,
  z.object({ version: z.literal(1), type: z.literal("realtime.ready") }),
]);

const delays = [1_000, 2_000, 5_000, 10_000, 30_000];
type RealtimeStatus = "off" | "connecting" | "connected" | "reconnecting";

export function useReceivingRealtime(sessionId: string | undefined, selectedDate: string) {
  const client = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("off");
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pongTimer: ReturnType<typeof setTimeout> | null = null;
    let mode: "on" | "shadow" | "off" = "off";

    const clearConnectionTimers = () => {
      if (pingTimer !== null) clearInterval(pingTimer);
      if (pongTimer !== null) clearTimeout(pongTimer);
      pingTimer = null;
      pongTimer = null;
    };
    const scheduleReconnect = () => {
      if (cancelled || mode === "off" || reconnectTimer !== null) return;
      setStatus("reconnecting");
      const delay = delays[Math.min(attempt++, delays.length - 1)] ?? 30_000;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };
    function connect() {
      if (cancelled || mode === "off") return;
      clearConnectionTimers();
      setStatus("connecting");
      const url = new URL("/api/realtime", window.location.href);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let ws: WebSocket;
      try {
        ws = new WebSocket(url.toString());
      } catch {
        scheduleReconnect();
        return;
      }
      socket = ws;
      ws.onopen = () => {
        if (cancelled || socket !== ws) return;
        pingTimer = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send("ping");
          if (pongTimer !== null) clearTimeout(pongTimer);
          pongTimer = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) ws.close(4000, "Realtime sem resposta");
          }, 10_000);
        }, 30_000);
      };
      ws.onmessage = (message) => {
        if (cancelled || socket !== ws) return;
        if (message.data === "pong") {
          if (pongTimer !== null) clearTimeout(pongTimer);
          pongTimer = null;
          return;
        }
        let raw: unknown;
        try { raw = JSON.parse(String(message.data)); } catch { return; }
        const parsed = realtimeEventSchema.safeParse(raw);
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === "realtime.ready") {
          attempt = 0;
          setStatus("connected");
          // Recupera eventos que possam ter ocorrido durante uma reconexão.
          void client.invalidateQueries({ queryKey: ["receiving", "agendas", selectedDateRef.current], exact: true });
          void client.invalidateQueries({ queryKey: ["receiving", "presence"], exact: true });
        } else if (event.type === "agenda.changed") {
          if (event.date === selectedDateRef.current) {
            void client.invalidateQueries({ queryKey: ["receiving", "agendas", selectedDateRef.current], exact: true });
          }
          void client.invalidateQueries({ queryKey: ["receiving", "detail", event.agendaId], exact: true });
        } else if (mode === "on" && event.type === "presence.snapshot") {
          client.setQueryData(["receiving", "presence"], event.stores);
        } else if (mode === "on" && event.type === "presence.changed") {
          client.setQueryData<Presence[]>(["receiving", "presence"], previous => {
            const next = new Map((previous ?? []).map(row => [row.storeId, row]));
            next.set(event.storeId, { storeId: event.storeId, status: event.status });
            return [...next.values()];
          });
        }
      };
      ws.onclose = event => {
        if (socket !== ws || cancelled) return;
        socket = null;
        clearConnectionTimers();
        if (event.code === 4003) {
          mode = "off";
          setStatus("off");
        } else scheduleReconnect();
      };
      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN) ws.close(4002, "Falha de conexão");
      };
    }

    void (async () => {
      try {
        const config = configSchema.parse(await apiFetch<unknown>("/api/realtime/config"));
        if (cancelled) return;
        mode = config.mode;
        if (mode === "off") { setStatus("off"); return; }
        connect();
      } catch {
        if (!cancelled) setStatus("off"); // O polling continua funcionando.
      }
    })();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      clearConnectionTimers();
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, "Página encerrada");
      }
      socket = null;
    };
  }, [client, sessionId]);
  return status;
}
