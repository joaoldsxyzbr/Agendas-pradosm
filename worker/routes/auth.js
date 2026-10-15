import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { RegisterFirstAdminInput } from "../../shared/api";
import { checkLoginRateLimit } from "../lib/login-rate-limit";
import { hashPassword, passwordNeedsUpgrade, verifyPassword } from "../lib/password";
import { createSessionToken, SESSION_MAX_AGE, verifySessionToken } from "../lib/session";
import { requireAuth } from "../middleware/auth";
import { revokeRealtimeUser } from "../services/realtime";
import { findActiveStoreById } from "../repositories/stores";
import {
  createInactiveFirstAdmin,
  findUserByLogin,
  hasAdmin,
  upgradeUserPasswordHash
} from "../repositories/users";
const COOKIE_NAME = "agenda_session";
const DEMO_USERS = {
  admin: "demo-admin",
  visualizador: "demo-visualizador",
  conferente: "demo-conferente"
};
const DemoLoginInput = z.object({
  papel: z.enum(["admin", "visualizador", "conferente"])
});
function isPreviewDemoEnabled(env) {
  return env.PREVIEW_DEMO_LOGIN === "on" && env.PREVIEW_DEPLOYMENT === "agendas-pradosm-preview";
}
const LoginInput = z.object({
  login: z.string().min(1).max(100),
  senha: z.string().min(8).max(200)
});
function invalidCredentials(c) {
  return c.json(
    {
      error: "CREDENCIAIS_INVALIDAS",
      message: "Login ou senha inv\xE1lidos."
    },
    401
  );
}
function bootstrapClosed(c) {
  return c.json(
    {
      error: "BOOTSTRAP_ENCERRADO",
      message: "O primeiro administrador j\xE1 foi preparado ou ativado."
    },
    409
  );
}
function isDuplicateLogin(error) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: usuarios.login");
}
const authRoutes = new Hono();
authRoutes.get(
  "/demo-status",
  (c) => c.json({ available: isPreviewDemoEnabled(c.env) })
);
authRoutes.post("/demo-login", async (c) => {
  if (!isPreviewDemoEnabled(c.env)) return c.notFound();
  const parsed = DemoLoginInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Perfil inv\xE1lido." }, 400);
  }
  const role = parsed.data.papel;
  const limit = await checkLoginRateLimit(
    c.env.LOGIN_RATE_LIMITER,
    `preview-demo-${role}`,
    c.req.header("CF-Connecting-IP")
  );
  if (limit === "unavailable") {
    c.header("Retry-After", "60");
    return c.json({ error: "AUTENTICACAO_TEMPORARIAMENTE_INDISPONIVEL" }, 503);
  }
  if (limit === "limited") {
    c.header("Retry-After", "60");
    return c.json({ error: "MUITAS_TENTATIVAS" }, 429);
  }
  const user = await findUserByLogin(c.env.DB, DEMO_USERS[role]);
  if (!user || user.ativo !== 1 || user.papel !== role) {
    return c.json({ error: "CONTA_DEMONSTRACAO_INDISPONIVEL" }, 503);
  }
  const store = role === "conferente" && user.loja_id ? await findActiveStoreById(c.env.DB, user.loja_id) : null;
  if (role === "conferente" && !store) {
    return c.json({ error: "CONTA_DEMONSTRACAO_INDISPONIVEL" }, 503);
  }
  const token = await createSessionToken(
    user.id,
    user.session_version,
    c.env.SESSION_SECRET
  );
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  return c.json({
    id: user.id,
    nome: user.nome,
    papel: user.papel,
    lojaId: user.loja_id,
    lojaCodigo: store?.codigo ?? null,
    lojaNome: store?.nome ?? null
  });
});
authRoutes.get("/bootstrap-status", async (c) => {
  return c.json({ available: !await hasAdmin(c.env.DB) });
});
authRoutes.post("/bootstrap-register", async (c) => {
  if (await hasAdmin(c.env.DB)) return bootstrapClosed(c);
  const parsed = RegisterFirstAdminInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." },
      400
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
        status: "pendente_ativacao"
      },
      201
    );
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login j\xE1 est\xE1 em uso." },
        409
      );
    }
    throw error;
  }
});
authRoutes.post("/login", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." },
      400
    );
  }
  const parsed = LoginInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." },
      400
    );
  }
  const rateLimitDecision = await checkLoginRateLimit(
    c.env.LOGIN_RATE_LIMITER,
    parsed.data.login,
    c.req.header("CF-Connecting-IP")
  );
  if (rateLimitDecision === "unavailable") {
    c.header("Retry-After", "60");
    return c.json(
      {
        error: "AUTENTICACAO_TEMPORARIAMENTE_INDISPONIVEL",
        message: "N\xE3o foi poss\xEDvel validar o acesso agora. Tente novamente em instantes."
      },
      503
    );
  }
  if (rateLimitDecision === "limited") {
    c.header("Retry-After", "60");
    return c.json(
      {
        error: "MUITAS_TENTATIVAS",
        message: "Muitas tentativas. Aguarde um minuto e tente novamente."
      },
      429
    );
  }
  const user = await findUserByLogin(c.env.DB, parsed.data.login);
  if (!user || user.ativo !== 1) return invalidCredentials(c);
  const passwordOk = await verifyPassword(parsed.data.senha, user.senha_hash);
  if (!passwordOk) return invalidCredentials(c);
  if (passwordNeedsUpgrade(user.senha_hash)) {
    const upgradedHash = await hashPassword(parsed.data.senha);
    await upgradeUserPasswordHash(c.env.DB, user.id, upgradedHash);
  }
  const store = user.papel === "conferente" && user.loja_id ? await findActiveStoreById(c.env.DB, user.loja_id) : null;
  if (user.papel === "conferente" && !store) return invalidCredentials(c);
  const token = await createSessionToken(
    user.id,
    user.session_version,
    c.env.SESSION_SECRET
  );
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  return c.json({
    id: user.id,
    nome: user.nome,
    papel: user.papel,
    lojaId: user.loja_id,
    lojaCodigo: store?.codigo ?? null,
    lojaNome: store?.nome ?? null
  });
});
authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    const payload = await verifySessionToken(token, c.env.SESSION_SECRET);
    if (payload) {
      await revokeRealtimeUser(c.env, payload.userId);
    }
  }
  deleteCookie(c, COOKIE_NAME, {
    path: "/",
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict"
  });
  return c.body(null, 204);
});
authRoutes.get("/me", requireAuth, (c) => c.json(c.get("authUser")));
export {
  authRoutes
};
