import { Hono } from "hono";
import {
  REALTIME_PROTOCOL_VERSION
} from "../../shared/realtime.js";
import { originMatchesRequest } from "../lib/http.js";
const realtimeRoutes = new Hono();
function realtimeMode(value) {
  return value === "shadow" || value === "on" ? value : "off";
}
realtimeRoutes.get("/config", (c) => {
  const config = {
    mode: realtimeMode(c.env.REALTIME_MODE),
    protocolVersion: REALTIME_PROTOCOL_VERSION
  };
  return c.json(config);
});
realtimeRoutes.get("/", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      {
        error: "WEBSOCKET_NECESSARIO",
        message: "Esta rota aceita apenas conex\xE3o WebSocket."
      },
      426
    );
  }
  const origin = c.req.header("Origin");
  if (!origin || !originMatchesRequest(c.req.url, origin)) {
    return c.json(
      {
        error: "ORIGEM_INVALIDA",
        message: "Origem da conex\xE3o n\xE3o permitida."
      },
      403
    );
  }
  const user = c.get("authUser");
  if (user.papel === "conferente" && !user.lojaId) {
    return c.json(
      {
        error: "ACESSO_NEGADO",
        message: "Conferente sem loja ativa n\xE3o pode conectar."
      },
      403
    );
  }
  const hubId = c.env.REALTIME_HUB.idFromName("agenda-prado");
  const hub = c.env.REALTIME_HUB.get(hubId);
  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Agenda-Realtime-User-Id", user.id);
  headers.set("X-Agenda-Realtime-Role", user.papel);
  headers.set(
    "X-Agenda-Realtime-Session-Exp",
    String(c.get("sessionExpiresAt"))
  );
  if (user.lojaId) {
    headers.set("X-Agenda-Realtime-Store-Id", user.lojaId);
  } else {
    headers.delete("X-Agenda-Realtime-Store-Id");
  }
  return hub.fetch(
    new Request(c.req.url, {
      method: "GET",
      headers
    })
  );
});
export {
  realtimeRoutes
};