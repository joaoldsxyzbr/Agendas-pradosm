import { Hono } from "hono";
import type { AppEnv } from "../env";
import { originMatchesRequest } from "../lib/http";

export const realtimeRoutes = new Hono<AppEnv>();

realtimeRoutes.get("/", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      {
        error: "WEBSOCKET_NECESSARIO",
        message: "Esta rota aceita apenas conexão WebSocket.",
      },
      426,
    );
  }

  const origin = c.req.header("Origin");
  if (!origin || !originMatchesRequest(c.req.url, origin)) {
    return c.json(
      {
        error: "ORIGEM_INVALIDA",
        message: "Origem da conexão não permitida.",
      },
      403,
    );
  }

  const user = c.get("authUser");

  if (user.papel === "conferente" && !user.lojaId) {
    return c.json(
      {
        error: "ACESSO_NEGADO",
        message: "Conferente sem loja ativa não pode conectar.",
      },
      403,
    );
  }

  const hubId = c.env.REALTIME_HUB.idFromName("agenda-prado");
  const hub = c.env.REALTIME_HUB.get(hubId);

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Agenda-Realtime-User-Id", user.id);
  headers.set("X-Agenda-Realtime-Role", user.papel);

  if (user.lojaId) {
    headers.set("X-Agenda-Realtime-Store-Id", user.lojaId);
  } else {
    headers.delete("X-Agenda-Realtime-Store-Id");
  }

  return hub.fetch(
    new Request(c.req.url, {
      method: "GET",
      headers,
    }),
  );
});
