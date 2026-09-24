import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AuthUser } from "../../shared/auth";
import type { AppEnv } from "../env";
import { verifySessionToken } from "../lib/session";
import { findUserById } from "../repositories/users";

const COOKIE_NAME = "agenda_session";

function unauthorized() {
  return {
    error: "NAO_AUTENTICADO",
    message: "Sessão inválida ou expirada.",
  };
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return c.json(unauthorized(), 401);

  const payload = await verifySessionToken(token, c.env.SESSION_SECRET);
  if (!payload) return c.json(unauthorized(), 401);

  const user = await findUserById(c.env.DB, payload.userId);
  if (!user || user.ativo !== 1) return c.json(unauthorized(), 401);

  const authUser: AuthUser = {
    id: user.id,
    nome: user.nome,
    perfil: user.perfil,
    lojaId: user.loja_id,
  };

  c.set("authUser", authUser);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("authUser");
  if (!user) return c.json(unauthorized(), 401);
  if (user.perfil !== "admin") {
    return c.json(
      { error: "ACESSO_NEGADO", message: "Acesso não permitido." },
      403,
    );
  }
  await next();
});
