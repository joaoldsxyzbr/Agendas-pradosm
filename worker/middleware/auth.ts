import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AuthUser } from "../../shared/auth";
import type { AppEnv } from "../env";
import { verifySessionToken } from "../lib/session";
import { findActiveStoreById } from "../repositories/stores";
import { findUserById } from "../repositories/users";

const COOKIE_NAME = "agenda_session";

function unauthorized() {
  return {
    error: "NAO_AUTENTICADO",
    message: "Sessão inválida ou expirada.",
  };
}

function forbidden() {
  return {
    error: "ACESSO_NEGADO",
    message: "Acesso não permitido.",
  };
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return c.json(unauthorized(), 401);

  const payload = await verifySessionToken(token, c.env.SESSION_SECRET);
  if (!payload) return c.json(unauthorized(), 401);

  const user = await findUserById(c.env.DB, payload.userId);
  if (!user || user.ativo !== 1) return c.json(unauthorized(), 401);

  const store =
    user.papel === "conferente" && user.loja_id
      ? await findActiveStoreById(c.env.DB, user.loja_id)
      : null;

  if (user.papel === "conferente" && !store) {
    return c.json(unauthorized(), 401);
  }

  const authUser: AuthUser = {
    id: user.id,
    nome: user.nome,
    papel: user.papel,
    lojaId: user.loja_id,
    lojaCodigo: store?.codigo ?? null,
    lojaNome: store?.nome ?? null,
  };

  c.set("authUser", authUser);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("authUser");
  if (!user) return c.json(unauthorized(), 401);
  if (user.papel !== "admin" && user.papel !== "visualizador") {
    return c.json(forbidden(), 403);
  }
  await next();
});

export const restrictDashboardViewer = createMiddleware<AppEnv>(
  async (c, next) => {
    const user = c.get("authUser");
    if (!user) return c.json(unauthorized(), 401);

    if (user.papel !== "visualizador") {
      await next();
      return;
    }

    if (c.req.method !== "GET") {
      return c.json(forbidden(), 403);
    }

    const path = c.req.path;
    const allowed =
      path === "/api/admin/stores" ||
      path === "/api/admin/agendas" ||
      /^\/api\/admin\/agendas\/[^/]+$/.test(path);

    if (!allowed) {
      return c.json(forbidden(), 403);
    }

    await next();
  },
);
