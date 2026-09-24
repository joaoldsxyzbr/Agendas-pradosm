import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../env";
import { verifyPassword } from "../lib/password";
import { createSessionToken, SESSION_MAX_AGE } from "../lib/session";
import { requireAuth } from "../middleware/auth";
import { findUserByLogin } from "../repositories/users";

const COOKIE_NAME = "agenda_session";

const LoginInput = z.object({
  login: z.string().min(1).max(100),
  senha: z.string().min(8).max(200),
});

function invalidCredentials(c: Context<AppEnv>) {
  return c.json(
    {
      error: "CREDENCIAIS_INVALIDAS",
      message: "Login ou senha inválidos.",
    },
    401,
  );
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  const parsed = LoginInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  const user = await findUserByLogin(c.env.DB, parsed.data.login);
  if (!user || user.ativo !== 1) return invalidCredentials(c);

  const passwordOk = await verifyPassword(parsed.data.senha, user.senha_hash);
  if (!passwordOk) return invalidCredentials(c);

  const token = await createSessionToken(user.id, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return c.json({
    id: user.id,
    nome: user.nome,
    perfil: user.perfil,
    lojaId: user.loja_id,
  });
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, {
    path: "/",
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
  });
  return c.body(null, 204);
});

authRoutes.get("/me", requireAuth, (c) => c.json(c.get("authUser")));
