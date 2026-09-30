import { DurableObject } from "cloudflare:workers";
import {
  REALTIME_PROTOCOL_VERSION,
  type RealtimeClientMessage,
  type RealtimeConnectionIdentity,
  type RealtimePresenceStatus,
  type RealtimePresenceSnapshotEvent,
  type RealtimeReadyEvent,
} from "../../shared/realtime";
import type { WorkerEnv } from "../env";

const PRESENCE_STALE_MS = 45_000;
const MAX_CLIENT_MESSAGE_BYTES = 2_048;

type LivePresenceStatus = Exclude<RealtimePresenceStatus, "offline">;

type ConnectionAttachment = RealtimeConnectionIdentity & {
  connectedAt: string;
  presenceStatus: LivePresenceStatus | null;
  lastPresenceAt: number | null;
};

function connectionTag(prefix: string, value: string) {
  return `${prefix}:${value}`;
}

function isLivePresenceStatus(value: unknown): value is LivePresenceStatus {
  return value === "online" || value === "away";
}

function parseClientMessage(message: string): RealtimeClientMessage | null {
  if (new TextEncoder().encode(message).byteLength > MAX_CLIENT_MESSAGE_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(message) as {
      version?: unknown;
      type?: unknown;
      status?: unknown;
    };

    if (parsed.version !== REALTIME_PROTOCOL_VERSION) return null;

    if (parsed.type === "presence.heartbeat") {
      return {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.heartbeat",
      };
    }

    if (
      parsed.type === "presence.set" &&
      isLivePresenceStatus(parsed.status)
    ) {
      return {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.set",
        status: parsed.status,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export class RealtimeHub extends DurableObject<WorkerEnv> {
  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }

    const userId = request.headers.get("X-Agenda-Realtime-User-Id");
    const role = request.headers.get("X-Agenda-Realtime-Role");
    const storeId =
      request.headers.get("X-Agenda-Realtime-Store-Id") || null;

    if (
      !userId ||
      (role !== "admin" &&
        role !== "visualizador" &&
        role !== "conferente") ||
      (role === "conferente" && !storeId)
    ) {
      return new Response("Invalid realtime identity.", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const now = Date.now();
    const attachment: ConnectionAttachment = {
      userId,
      role,
      storeId,
      connectedAt: new Date(now).toISOString(),
      presenceStatus: null,
      lastPresenceAt: role === "conferente" ? now : null,
    };

    server.serializeAttachment(attachment);

    const tags = [
      connectionTag("role", role),
      connectionTag("user", userId),
    ];
    if (storeId) tags.push(connectionTag("store", storeId));

    this.ctx.acceptWebSocket(server, tags);

    const ready: RealtimeReadyEvent = {
      version: REALTIME_PROTOCOL_VERSION,
      type: "realtime.ready",
    };
    server.send(JSON.stringify(ready));

    if (role === "admin" || role === "visualizador") {
      const snapshot: RealtimePresenceSnapshotEvent = {
        version: REALTIME_PROTOCOL_VERSION,
        type: "presence.snapshot",
        stores: this.presenceSnapshot(),
      };
      server.send(JSON.stringify(snapshot));
    } else {
      await this.ensurePresenceAlarm();
    }

    console.log(
      JSON.stringify({
        event: "websocket_connected",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role,
        hasStore: Boolean(storeId),
      }),
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
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
    await this.ensurePresenceAlarm();

    if (parsed.type === "presence.set") {
      this.broadcastPresence(attachment.storeId);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
  ): Promise<void> {
    const attachment = this.attachment(ws);

    if (attachment?.role === "conferente" && attachment.storeId) {
      this.broadcastPresence(attachment.storeId, new Set([ws]));
      await this.ensurePresenceAlarm(new Set([ws]));
    }

    console.log(
      JSON.stringify({
        event: "websocket_disconnected",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown",
        code,
      }),
    );
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const attachment = this.attachment(ws);

    if (attachment?.role === "conferente" && attachment.storeId) {
      this.broadcastPresence(attachment.storeId, new Set([ws]));
      await this.ensurePresenceAlarm(new Set([ws]));
    }

    console.error(
      JSON.stringify({
        event: "websocket_error",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown",
      }),
    );

    ws.close(1011, "Erro na conexão realtime.");
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const stale = new Set<WebSocket>();
    const affectedStores = new Set<string>();

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachment(ws);
      if (attachment?.role !== "conferente" || !attachment.storeId) continue;

      const lastSeen =
        attachment.lastPresenceAt ?? Date.parse(attachment.connectedAt);
      if (!Number.isFinite(lastSeen) || now - lastSeen >= PRESENCE_STALE_MS) {
        stale.add(ws);
        affectedStores.add(attachment.storeId);
      }
    }

    for (const ws of stale) {
      ws.close(4001, "Presença realtime expirada.");
    }

    for (const storeId of affectedStores) {
      this.broadcastPresence(storeId, stale);
    }

    await this.ensurePresenceAlarm(stale);
  }

  private attachment(ws: WebSocket) {
    return ws.deserializeAttachment() as ConnectionAttachment | null;
  }

  private rejectMessage(ws: WebSocket) {
    console.warn(
      JSON.stringify({
        event: "invalid_realtime_message",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      }),
    );
    ws.close(1008, "Mensagem realtime não suportada.");
  }

  private storePresence(
    storeId: string,
    excluded: ReadonlySet<WebSocket> = new Set(),
  ): RealtimePresenceStatus {
    const now = Date.now();
    let status: RealtimePresenceStatus = "offline";

    for (const ws of this.ctx.getWebSockets(connectionTag("store", storeId))) {
      if (excluded.has(ws)) continue;

      const attachment = this.attachment(ws);
      if (
        attachment?.role !== "conferente" ||
        attachment.storeId !== storeId ||
        !attachment.presenceStatus
      ) {
        continue;
      }

      const lastSeen =
        attachment.lastPresenceAt ?? Date.parse(attachment.connectedAt);
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

  private presenceSnapshot() {
    const stores = new Set<string>();

    for (const ws of this.ctx.getWebSockets(connectionTag("role", "conferente"))) {
      const attachment = this.attachment(ws);
      if (attachment?.storeId) stores.add(attachment.storeId);
    }

    return [...stores].map((storeId) => ({
      storeId,
      status: this.storePresence(storeId),
    }));
  }

  private broadcastPresence(
    storeId: string,
    excluded: ReadonlySet<WebSocket> = new Set(),
  ) {
    const event = JSON.stringify({
      version: REALTIME_PROTOCOL_VERSION,
      type: "presence.changed",
      storeId,
      status: this.storePresence(storeId, excluded),
    });

    for (const role of ["admin", "visualizador"] as const) {
      for (const ws of this.ctx.getWebSockets(connectionTag("role", role))) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event);
        }
      }
    }
  }

  private async ensurePresenceAlarm(
    excluded: ReadonlySet<WebSocket> = new Set(),
  ) {
    let nextAlarm: number | null = null;

    for (const ws of this.ctx.getWebSockets(connectionTag("role", "conferente"))) {
      if (excluded.has(ws)) continue;

      const attachment = this.attachment(ws);
      if (!attachment) continue;

      const lastSeen =
        attachment.lastPresenceAt ?? Date.parse(attachment.connectedAt);
      if (!Number.isFinite(lastSeen)) continue;

      const due = lastSeen + PRESENCE_STALE_MS;
      nextAlarm = nextAlarm === null ? due : Math.min(nextAlarm, due);
    }

    const currentAlarm = await this.ctx.storage.getAlarm();

    if (nextAlarm === null) {
      if (currentAlarm !== null) {
        await this.ctx.storage.deleteAlarm();
      }
      return;
    }

    if (currentAlarm === null || nextAlarm < currentAlarm) {
      await this.ctx.storage.setAlarm(nextAlarm);
    }
  }
}
