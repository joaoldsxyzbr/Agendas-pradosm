import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { RegisterFirstAdminInput } from "../../shared/api";
import type { AppEnv } from "../env";
import { verifyPassword } from "../lib/password";
import { createSessionToken, SESSION_MAX_AGE } from "../lib/session";
import { requireAuth } from "../middleware/auth";
import {
  createInactiveFirstAdmin,
  findUserByLogin,
  hasAdmin,
} from "../repositories/users";

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

function bootstrapClosed(c: Context<AppEnv>) {
  return c.json(
    {
      error: "BOOTSTRAP_ENCERRADO",
      message: "O primeiro administrador já foi preparado ou ativado.",
    },
    409,
  );
}

function isDuplicateLogin(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: usuarios.login")
  );
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/bootstrap-status", async (c) => {
  return c.json({ available: !(await hasAdmin(c.env.DB)) });
});

authRoutes.post("/bootstrap-register", async (c) => {
  if (await hasAdmin(c.env.DB)) return bootstrapClosed(c);

  const parsed = RegisterFirstAdminInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inválidos." },
      400,
    );
  }

  try {
    const user = await createInactiveFirstAdmin(c.env.DB, parsed.data);
    if (!user) return bootstrapClosed(c);

    return c.json(
      {
        id: user.id,
        nome: user.nome,
        login: user.login,
        status: "pendente_ativacao",
      },
      201,
    );
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login já está em uso." },
        409,
      );
    }
    throw error;
  }
});

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
