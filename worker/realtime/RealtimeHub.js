import { DurableObject } from "cloudflare:workers";
import {
  REALTIME_PROTOCOL_VERSION
} from "../../shared/realtime.js";
const PRESENCE_STALE_MS = 12e4;
const MAX_CLIENT_MESSAGE_BYTES = 2048;
function connectionTag(prefix, value) {
  return `${prefix}:${value}`;
}
function isLivePresenceStatus(value) {
  return value === "online" || value === "away";
}
function isAgendaChangedReason(value) {
  return value === "status" || value === "exchanges" || value === "manual" || value === "day-status" || value === "import";
}
function parseAgendaChangedEvent(value) {
  if (!value || typeof value !== "object") return null;
  const event = value;
  if (event.version !== REALTIME_PROTOCOL_VERSION || event.type !== "agenda.changed" || typeof event.agendaId !== "string" || typeof event.storeId !== "string" || typeof event.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !isAgendaChangedReason(event.reason)) {
    return null;
  }
  return {
    version: REALTIME_PROTOCOL_VERSION,
    type: "agenda.changed",
    agendaId: event.agendaId,
    storeId: event.storeId,
    date: event.date,
    reason: event.reason
  };
}
function parseClientMessage(message) {
  if (new TextEncoder().encode(message).byteLength > MAX_CLIENT_MESSAGE_BYTES) {
    return null;
  }
  try {
    const parsed = JSON.parse(message);
    if (parsed.version !== REALTIME_PROTOCOL_VERSION) return null;
    if (parsed.type === "presence.heartbeat") {
      return {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat"
      };
    }
    if (parsed.type === "presence.set" && isLivePresenceStatus(parsed.status)) {
      return {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.set",
        status: parsed.status
      };
    }
    return null;
  } catch {
    return null;
  }
}
class RealtimeHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/internal/publish") {
      const event = parseAgendaChangedEvent(
        await request.json().catch(() => null)
      );
      if (!event) {
        return new Response("Invalid realtime event.", { status: 400 });
      }
      this.broadcastDashboardEvent(event);
      console.log(
        JSON.stringify({
          event: "dashboard_event_published",
          protocolVersion: REALTIME_PROTOCOL_VERSION,
          type: event.type,
          reason: event.reason
        })
      );
      return new Response(null, { status: 204 });
    }
    if (request.method === "POST" && url.pathname === "/internal/revoke") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.userId !== "string" || !body.userId || body.reconnect !== void 0 && typeof body.reconnect !== "boolean") {
        return new Response("Invalid realtime revoke request.", { status: 400 });
      }
      const revoked = /* @__PURE__ */ new Set();
      const affectedStores = /* @__PURE__ */ new Set();
      for (const ws of this.ctx.getWebSockets(connectionTag("user", body.userId))) {
        const attachment2 = this.attachment(ws);
        revoked.add(ws);
        if (attachment2?.role === "conferente" && attachment2.storeId) {
          affectedStores.add(attachment2.storeId);
        }
        ws.close(
          body.reconnect ? 4004 : 4003,
          body.reconnect ? "Identidade realtime atualizada." : "Sess\xE3o realtime revogada."
        );
      }
      for (const storeId2 of affectedStores) {
        this.broadcastPresence(storeId2, revoked);
      }
      await this.ensureAlarm(revoked);
      return new Response(null, { status: 204 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }
    const userId = request.headers.get("X-Agenda-Realtime-User-Id");
    const role = request.headers.get("X-Agenda-Realtime-Role");
    const storeId = request.headers.get("X-Agenda-Realtime-Store-Id") || null;
    const sessionExpiresAtSeconds = Number(
      request.headers.get("X-Agenda-Realtime-Session-Exp")
    );
    if (!userId || !Number.isInteger(sessionExpiresAtSeconds) || sessionExpiresAtSeconds <= Math.floor(Date.now() / 1e3) || role !== "admin" && role !== "visualizador" && role !== "conferente" || role === "conferente" && !storeId) {
      return new Response("Invalid realtime identity.", { status: 400 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const now = Date.now();
    const attachment = {
      userId,
      role,
      storeId,
      connectedAt: new Date(now).toISOString(),
      sessionExpiresAt: sessionExpiresAtSeconds * 1e3,
      presenceStatus: null,
      lastPresenceAt: role === "conferente" ? now : null
    };
    server.serializeAttachment(attachment);
    const tags = [
      connectionTag("role", role),
      connectionTag("user", userId)
    ];
    if (storeId) tags.push(connectionTag("store", storeId));
    this.ctx.acceptWebSocket(server, tags);
    const ready = {
      version: REALTIME_PROTOCOL_VERSION,
      type: "realtime.ready"
    };
    server.send(JSON.stringify(ready));
    if (role === "admin" || role === "visualizador") {
      const snapshot = {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.snapshot",
        stores: this.presenceSnapshot()
      };
      server.send(JSON.stringify(snapshot));
    }
    await this.ensureAlarm();
    console.log(
      JSON.stringify({
        event: "websocket_connected",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role,
        hasStore: Boolean(storeId)
      })
    );
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, message) {
    if (typeof message === "string" && message === "ping") {
      return;
    }
    const attachment = this.attachment(ws);
    if (!attachment || attachment.role !== "conferente" || !attachment.storeId) {
      this.rejectMessage(ws);
      return;
    }
    if (typeof message !== "string") {
      this.rejectMessage(ws);
      return;
    }
    const parsed = parseClientMessage(message);
    if (!parsed) {
      this.rejectMessage(ws);
      return;
    }
    const now = Date.now();
    attachment.lastPresenceAt = now;
    if (parsed.type === "presence.set") {
      attachment.presenceStatus = parsed.status;
    }
    ws.serializeAttachment(attachment);
    await this.ensureAlarm();
    if (parsed.type === "presence.set") {
      this.broadcastPresence(attachment.storeId);
    }
  }
  async webSocketClose(ws, code, _reason) {
    const attachment = this.attachment(ws);
    if (attachment?.role === "conferente" && attachment.storeId) {
      this.broadcastPresence(attachment.storeId, /* @__PURE__ */ new Set([ws]));
      await this.ensureAlarm(/* @__PURE__ */ new Set([ws]));
    }
    console.log(
      JSON.stringify({
        event: "websocket_disconnected",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown",
        code
      })
    );
  }
  async webSocketError(ws) {
    const attachment = this.attachment(ws);
    if (attachment?.role === "conferente" && attachment.storeId) {
      this.broadcastPresence(attachment.storeId, /* @__PURE__ */ new Set([ws]));
      await this.ensureAlarm(/* @__PURE__ */ new Set([ws]));
    }
    console.error(
      JSON.stringify({
        event: "websocket_error",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown"
      })
    );
    ws.close(1011, "Erro na conex\xE3o realtime.");
  }
  async alarm() {
    const now = Date.now();
    const expired = /* @__PURE__ */ new Set();
    const stale = /* @__PURE__ */ new Set();
    const affectedStores = /* @__PURE__ */ new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachment(ws);
      if (!attachment) continue;
      if (now >= attachment.sessionExpiresAt) {
        expired.add(ws);
        if (attachment.role === "conferente" && attachment.storeId) {
          affectedStores.add(attachment.storeId);
        }
        continue;
      }
      if (attachment.role !== "conferente" || !attachment.storeId) continue;
      const lastSeen = this.connectionLastSeen(ws, attachment);
      if (!Number.isFinite(lastSeen) || now - lastSeen >= PRESENCE_STALE_MS) {
        stale.add(ws);
        affectedStores.add(attachment.storeId);
      }
    }
    for (const ws of expired) {
      ws.close(4003, "Sess\xE3o realtime expirada.");
    }
    for (const ws of stale) {
      ws.close(4001, "Presen\xE7a realtime expirada.");
    }
    const excluded = /* @__PURE__ */ new Set([...expired, ...stale]);
    for (const storeId of affectedStores) {
      this.broadcastPresence(storeId, excluded);
    }
    await this.ensureAlarm(excluded);
  }
  attachment(ws) {
    return ws.deserializeAttachment();
  }
  rejectMessage(ws) {
    console.warn(
      JSON.stringify({
        event: "invalid_realtime_message",
        protocolVersion: REALTIME_PROTOCOL_VERSION
      })
    );
    ws.close(1008, "Mensagem realtime n\xE3o suportada.");
  }
  connectionLastSeen(ws, attachment) {
    const presenceSeen = attachment.lastPresenceAt ?? Date.parse(attachment.connectedAt);
    const autoResponseSeen = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? Number.NaN;
    if (!Number.isFinite(presenceSeen)) return autoResponseSeen;
    if (!Number.isFinite(autoResponseSeen)) return presenceSeen;
    return Math.max(presenceSeen, autoResponseSeen);
  }
  storePresence(storeId, excluded = /* @__PURE__ */ new Set()) {
    const now = Date.now();
    let status = "offline";
    for (const ws of this.ctx.getWebSockets(connectionTag("store", storeId))) {
      if (excluded.has(ws)) continue;
      const attachment = this.attachment(ws);
      if (attachment?.role !== "conferente" || attachment.storeId !== storeId || !attachment.presenceStatus) {
        continue;
      }
      const lastSeen = this.connectionLastSeen(ws, attachment);
      if (!Number.isFinite(lastSeen) || now - lastSeen >= PRESENCE_STALE_MS) {
        continue;
      }
      if (attachment.presenceStatus === "online") {
        return "online";
      }
      status = "away";
    }
    return status;
  }
  presenceSnapshot() {
    const stores = /* @__PURE__ */ new Set();
    for (const ws of this.ctx.getWebSockets(connectionTag("role", "conferente"))) {
      const attachment = this.attachment(ws);
      if (attachment?.storeId) stores.add(attachment.storeId);
    }
    return [...stores].map((storeId) => ({
      storeId,
      status: this.storePresence(storeId)
    }));
  }
  broadcastPresence(storeId, excluded = /* @__PURE__ */ new Set()) {
    const event = JSON.stringify({
      version: REALTIME_PROTOCOL_VERSION,
      type: "presence.changed",
      storeId,
      status: this.storePresence(storeId, excluded)
    });
    for (const role of ["admin", "visualizador"]) {
      for (const ws of this.ctx.getWebSockets(connectionTag("role", role))) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event);
        }
      }
    }
  }
  broadcastDashboardEvent(event) {
    const payload = JSON.stringify(event);
    for (const role of ["admin", "visualizador"]) {
      for (const ws of this.ctx.getWebSockets(connectionTag("role", role))) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }
  async ensureAlarm(excluded = /* @__PURE__ */ new Set()) {
    let nextAlarm = null;
    for (const ws of this.ctx.getWebSockets()) {
      if (excluded.has(ws)) continue;
      const attachment = this.attachment(ws);
      if (!attachment) continue;
      nextAlarm = nextAlarm === null ? attachment.sessionExpiresAt : Math.min(nextAlarm, attachment.sessionExpiresAt);
      if (attachment.role !== "conferente") continue;
      const lastSeen = this.connectionLastSeen(ws, attachment);
      if (!Number.isFinite(lastSeen)) continue;
      const presenceDue = lastSeen + PRESENCE_STALE_MS;
      nextAlarm = Math.min(nextAlarm, presenceDue);
    }
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (nextAlarm === null) {
      if (currentAlarm !== null) {
        await this.ctx.storage.deleteAlarm();
      }
      return;
    }
    if (currentAlarm === null || nextAlarm !== currentAlarm) {
      await this.ctx.storage.setAlarm(nextAlarm);
    }
  }
}
export {
  RealtimeHub
};