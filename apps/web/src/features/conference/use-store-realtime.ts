import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

// Espelha o comportamento do receiving/use-realtime.ts: quando a preview
// responde mode "off", o hook nao conecta e o polling da pagina continua.
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
const readySchema = z.object({ version: z.literal(1), type: z.literal("realtime.ready") });

const delays = [1_000, 2_000, 5_000, 10_000, 30_000];
export type StoreRealtimeStatus = "off" | "connecting" | "connected" | "reconnecting";

// Presenca do conferente para os paineis do admin. O servidor ja expoe as duas
// vias; este hook passa a alimenta-las:
// - WebSocket presence.set: o RealtimeHub retransmite presence.changed em tempo real.
// - REST /api/store/presence: mantem o polling de 30s do Recebimento coerente com o
//   WebSocket (mesma janela de interacao do worker/lib/presence.ts).
const PRESENCE_REPORT_MS = 30_000;
const PRESENCE_ONLINE_MS = 3 * 60_000;
type LivePresenceStatus = "online" | "away";

function presenceSetMessage(status: LivePresenceStatus) {
  return JSON.stringify({ version: 1, type: "presence.set", status });
}

export function useStoreRealtime(selectedDate: string) {
  const client = useQueryClient();
  const [status, setStatus] = useState<StoreRealtimeStatus>("off");
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  const sendRef = useRef<(message: string) => boolean>(() => false);
  const lastInteractionRef = useRef(Date.now());
  const lastSentPresenceRef = useRef<LivePresenceStatus | null>(null);
  const restReportedRef = useRef(false);

  const currentPresence = (): LivePresenceStatus =>
    document.hidden || Date.now() - lastInteractionRef.current > PRESENCE_ONLINE_MS ? "away" : "online";
  const userInteracted = () => Date.now() - lastInteractionRef.current <= PRESENCE_ONLINE_MS;
  const pushPresence = () => {
    const next = currentPresence();
    if (next === lastSentPresenceRef.current) return;
    lastSentPresenceRef.current = next;
    sendRef.current(presenceSetMessage(next));
  };
  const reportRestPresence = (interacted: boolean) => {
    restReportedRef.current = true;
    void apiFetch("/api/store/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interacted }),
    }).catch(() => undefined); // Best-effort: o painel do admin mantem o polling REST.
  };
  const clearRestPresence = (keepalive: boolean) => {
    if (!restReportedRef.current) return;
    restReportedRef.current = false;
    void apiFetch("/api/store/presence", { method: "DELETE", ...(keepalive ? { keepalive: true } : {}) })
      .catch(() => undefined);
  };

  useEffect(() => {
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
    const refreshAgenda = () => {
      // O cache da página inclui [date, today]; invalidar pelo prefixo alcança ambas as variações.
      void client.invalidateQueries({ queryKey: ["conference", "agenda", selectedDateRef.current] });
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
        sendRef.current = (message: string) => {
          if (ws.readyState !== WebSocket.OPEN) return false;
          ws.send(message);
          return true;
        };
        // O hub aceita mensagens de presenca desde a conexao: envia o status
        // atual para os paineis sairem do "offline" sem esperar o primeiro ciclo.
        const initialPresence = currentPresence();
        lastSentPresenceRef.current = initialPresence;
        ws.send(presenceSetMessage(initialPresence));
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
        if (readySchema.safeParse(raw).success) {
          attempt = 0;
          setStatus("connected");
          refreshAgenda(); // Recupera eventos ocorridos durante a reconexao.
          return;
        }
        const parsed = changedSchema.safeParse(raw);
        if (!parsed.success) return;
        if (parsed.data.date === selectedDateRef.current) refreshAgenda();
      };
      ws.onclose = event => {
        if (socket !== ws || cancelled) return;
        socket = null;
        sendRef.current = () => false;
        lastSentPresenceRef.current = null; // Reconexao cria novo attachment no hub: o onopen reenvia.
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
      sendRef.current = () => false;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, "Página encerrada");
      }
      socket = null;
    };
  }, [client]);

  // Sinal de presenca: atividade recente define online; heartbeat REST a cada
  // 30s e saida no pagehide mantem o D1 coerente com o WebSocket.
  useEffect(() => {
    let cancelled = false;
    let reportTimer: number | null = null;
    const markInteraction = () => { lastInteractionRef.current = Date.now(); };
    const report = () => {
      if (cancelled) return;
      reportRestPresence(userInteracted());
      pushPresence();
    };
    const onPageHide = () => { if (!cancelled) clearRestPresence(true); };
    document.addEventListener("pointerdown", markInteraction, { passive: true });
    document.addEventListener("keydown", markInteraction, { passive: true });
    document.addEventListener("visibilitychange", report);
    window.addEventListener("pagehide", onPageHide);
    report();
    reportTimer = window.setInterval(report, PRESENCE_REPORT_MS);
    return () => {
      cancelled = true;
      if (reportTimer !== null) window.clearInterval(reportTimer);
      document.removeEventListener("pointerdown", markInteraction);
      document.removeEventListener("keydown", markInteraction);
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("pagehide", onPageHide);
      clearRestPresence(false);
    };
  }, []);

  return status;
}
