import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { checkLoginRateLimit } from "../lib/login-rate-limit.js";
import { createSessionToken, SESSION_MAX_AGE } from "../lib/session.js";
import { recordAudit } from "../repositories/audit.js";
import { findUserByLogin } from "../repositories/users.js";

const QUICK_USERS = Object.freeze({
  admin: { login: "preview-quick-admin", name: "Administrador de testes", papel: "admin" },
  doca1: { login: "preview-quick-doca01", name: "Conferente Doca 1 (teste)", papel: "conferente" },
  visualizador: { login: "preview-quick-viewer", name: "Visualizador de testes", papel: "visualizador" }
});
const Input = z.object({
  role: z.enum(["admin", "doca1", "visualizador"]),
  code: z.string().min(20).max(128)
}).strict();
const PREVIEW_HOSTS = new Set([
  "testes.agendaspradosm.joaolds.xyz.br",
  "testes-agendas-pradosm.contato-24f.workers.dev"
]);

export function quickLoginEnabled(env, url) {
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return PREVIEW_HOSTS.has(hostname) &&
    env?.PREVIEW_QUICK_LOGIN_ENABLED === "on" &&
    /^[a-f0-9]{64}$/.test(env.PREVIEW_QUICK_LOGIN_HASH || "") &&
    typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 24;
}

export async function matchesQuickCode(code, hash) {
  if (typeof code !== "string" || code.length < 20 || code.length > 128) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const bytes = new Uint8Array(digest);
  const expected = new Uint8Array(hash.match(/.{2}/g).map(item => parseInt(item, 16)));
  let diff = 0;
  for (let index = 0; index < bytes.length; index++) diff |= bytes[index] ^ expected[index];
  return diff === 0;
}

async function createPreviewUser(db, role) {
  const config = QUICK_USERS[role];
  let store = null;
  if (role === "doca1") {
    await db.prepare(`INSERT OR IGNORE INTO lojas
      (id, codigo, nome, ativo, criado_em, atualizado_em)
      VALUES (?, 'CD DOCA 01', 'CD - Doca 1 (teste)', 1, ?, ?)`)
      .bind(crypto.randomUUID(), new Date().toISOString(), new Date().toISOString()).run();
    store = await db.prepare(
      "SELECT id, codigo FROM lojas WHERE codigo = 'CD DOCA 01' COLLATE NOCASE AND ativo = 1 AND excluido_em IS NULL LIMIT 1"
    ).first();
    if (!store) return null;
  }
  const now = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO usuarios
    (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 'preview_quick_login_unusable_password', ?, 1, ?, ?)`)
    .bind(crypto.randomUUID(), store?.id ?? null, config.name, config.login, config.papel, now, now).run();
  const user = await findUserByLogin(db, config.login);
  if (!user || user.ativo !== 1 || user.papel !== config.papel ||
      (config.papel === "conferente" && user.loja_id !== store.id)) return null;
  return { user, store };
}

export const quickLoginRoutes = new Hono();

quickLoginRoutes.get("/status", c => c.json({
  enabled: quickLoginEnabled(c.env, c.req.url)
}));

quickLoginRoutes.post("/", async c => {
  if (!quickLoginEnabled(c.env, c.req.url)) {
    return c.json({ error: "RECURSO_INDISPONIVEL" }, 404);
  }
  const size = Number(c.req.header("content-length") || 0);
  if (size > 512) return c.json({ error: "REQUISICAO_INVALIDA" }, 400);
  const parsed = Input.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "REQUISICAO_INVALIDA" }, 400);
  const limiter = await checkLoginRateLimit(
    c.env.LOGIN_RATE_LIMITER, "preview-quick",
    c.req.header("CF-Connecting-IP")
  );
  if (limiter === "unavailable") return c.json({ error: "LOGIN_TEMPORARIAMENTE_INDISPONIVEL" }, 503);
  if (limiter === "limited") return c.json({ error: "MUITAS_TENTATIVAS" }, 429);
  if (!await matchesQuickCode(parsed.data.code, c.env.PREVIEW_QUICK_LOGIN_HASH)) {
    return c.json({ error: "CODIGO_INVALIDO", message: "Código de testes incorreto." }, 401);
  }

  const identity = await createPreviewUser(c.env.DB, parsed.data.role);
  if (!identity) return c.json({ error: "USUARIO_TESTE_INDISPONIVEL" }, 409);
  const { user, store } = identity;
  const token = await createSessionToken(user.id, user.session_version, c.env.SESSION_SECRET);
  setCookie(c, "agenda_session", token, {
    httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: SESSION_MAX_AGE
  });
  await recordAudit(c.env.DB, {
    userId: user.id, action: "preview_login_rapido", entity: "usuario",
    entityId: user.id, storeId: store?.id ?? null, details: "Acesso de homologação."
  });
  return c.json({
    id: user.id, nome: user.nome, papel: user.papel,
    lojaId: user.loja_id, lojaCodigo: store?.codigo ?? null,
    lojaNome: parsed.data.role === "doca1" ? "CD - Doca 1 (teste)" : null
  });
});
