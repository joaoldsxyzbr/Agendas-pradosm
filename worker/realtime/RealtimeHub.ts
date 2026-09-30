import { DurableObject } from "cloudflare:workers";
import {
  REALTIME_PROTOCOL_VERSION,
  type RealtimeConnectionIdentity,
  type RealtimeReadyEvent,
} from "../../shared/realtime";
import type { WorkerEnv } from "../env";

type ConnectionAttachment = RealtimeConnectionIdentity & {
  connectedAt: string;
};

function connectionTag(prefix: string, value: string) {
  return `${prefix}:${value}`;
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

    const attachment: ConnectionAttachment = {
      userId,
      role,
      storeId,
      connectedAt: new Date().toISOString(),
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

    console.warn(
      JSON.stringify({
        event: "invalid_realtime_message",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      }),
    );
    ws.close(1008, "Mensagem realtime não suportada.");
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    const attachment =
      ws.deserializeAttachment() as ConnectionAttachment | null;

    console.log(
      JSON.stringify({
        event: "websocket_disconnected",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown",
        code,
      }),
    );

    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const attachment =
      ws.deserializeAttachment() as ConnectionAttachment | null;

    console.error(
      JSON.stringify({
        event: "websocket_error",
        protocolVersion: REALTIME_PROTOCOL_VERSION,
        role: attachment?.role ?? "unknown",
      }),
    );

    ws.close(1011, "Erro na conexão realtime.");
  }
}
