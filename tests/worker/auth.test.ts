import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const password = "senha-segura-123";
const now = "2026-09-24T12:00:00.000Z";

async function seedUser(input: {
  id: string;
  login: string;
  perfil: "admin" | "loja";
  ativo?: boolean;
  lojaId?: string;
}) {
  if (input.lojaId) {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(input.lojaId, `F-${input.id}`, `Loja ${input.id}`, now, now)
      .run();
  }

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.id,
      input.lojaId ?? null,
      `Usuário ${input.id}`,
      input.login,
      passwordHash,
      input.perfil,
      input.ativo === false ? 0 : 1,
      now,
      now,
    )
    .run();
}

async function login(loginValue: string, senha = password) {
  return exports.default.fetch(
    new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginValue, senha }),
    }),
  );
}

async function bootstrapStatus() {
  return exports.default.fetch("https://example.com/api/auth/bootstrap-status");
}

async function registerFirstAdmin(input: {
  nome: string;
  login: string;
  senha: string;
}) {
  return exports.default.fetch(
    new Request("https://example.com/api/auth/bootstrap-register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.com",
      },
      body: JSON.stringify(input),
    }),
  );
}

function cookiePair(response: Response) {
  const header = response.headers.get("Set-Cookie");
  expect(header).toBeTruthy();
  return header!.split(";")[0];
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function signedSession(userId: string, exp: number) {
  const encoder = new TextEncoder();
  const payload = base64Url(encoder.encode(JSON.stringify({ userId, exp })));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${base64Url(signature)}`;
}

describe("auth", () => {
  it("prepara o primeiro admin inativo e encerra o bootstrap", async () => {
    const before = await bootstrapStatus();
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({ available: true });

    const senhaBootstrap = "senha-bootstrap-123";
    const created = await registerFirstAdmin({
      nome: "Administrador inicial",
      login: "primeiro-admin",
      senha: senhaBootstrap,
    });

    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      nome: "Administrador inicial",
      login: "primeiro-admin",
      status: "pendente_ativacao",
    });

    const stored = await db
      .prepare(
        "SELECT perfil, ativo, senha_hash FROM usuarios WHERE login = ? LIMIT 1",
      )
      .bind("primeiro-admin")
      .first<{ perfil: string; ativo: number; senha_hash: string }>();

    expect(stored).toMatchObject({ perfil: "admin", ativo: 0 });
    expect(stored?.senha_hash).toMatch(/^pbkdf2_sha256\$100000\$/);

    const deniedLogin = await login("primeiro-admin", senhaBootstrap);
    expect(deniedLogin.status).toBe(401);

    const after = await bootstrapStatus();
    expect(await after.json()).toEqual({ available: false });

    const second = await registerFirstAdmin({
      nome: "Outro",
      login: "outro-admin",
      senha: "outra-senha-segura-123",
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "BOOTSTRAP_ENCERRADO" });
  });

  it("faz login com senha correta e retorna a sessão atual", async () => {
    await seedUser({ id: "admin-ok", login: "admin-ok", perfil: "admin" });

    const response = await login("admin-ok");
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Strict");

    const me = await exports.default.fetch(
      new Request("https://example.com/api/auth/me", {
        headers: { Cookie: cookiePair(response) },
      }),
    );

    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      id: "admin-ok",
      perfil: "admin",
      lojaId: null,
    });
  });

  it("rejeita senha incorreta com mensagem neutra", async () => {
    await seedUser({ id: "admin-wrong", login: "admin-wrong", perfil: "admin" });

    const response = await login("admin-wrong", "senha-errada");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "CREDENCIAIS_INVALIDAS",
      message: "Login ou senha inválidos.",
    });
  });

  it("rejeita cookie adulterado", async () => {
    await seedUser({ id: "admin-tamper", login: "admin-tamper", perfil: "admin" });
    const response = await login("admin-tamper");
    const cookie = cookiePair(response);
    const [name, token] = cookie.split("=");
    const [payload, signature] = token.split(".");
    const tamperedSignature =
      (signature.startsWith("a") ? "b" : "a") + signature.slice(1);
    const tampered = `${name}=${payload}.${tamperedSignature}`;

    const me = await exports.default.fetch(
      new Request("https://example.com/api/auth/me", {
        headers: { Cookie: tampered },
      }),
    );

    expect(me.status).toBe(401);
  });

  it("rejeita cookie expirado mesmo com assinatura válida", async () => {
    await seedUser({ id: "admin-expired", login: "admin-expired", perfil: "admin" });
    const token = await signedSession("admin-expired", 1);

    const me = await exports.default.fetch(
      new Request("https://example.com/api/auth/me", {
        headers: { Cookie: `agenda_session=${token}` },
      }),
    );

    expect(me.status).toBe(401);
  });

  it("não permite login de usuário inativo", async () => {
    await seedUser({
      id: "admin-inactive",
      login: "admin-inactive",
      perfil: "admin",
      ativo: false,
    });

    const response = await login("admin-inactive");
    expect(response.status).toBe(401);
  });

  it("bloqueia usuário de loja nas rotas administrativas", async () => {
    await seedUser({
      id: "store-user",
      login: "store-user",
      perfil: "loja",
      lojaId: "store-auth",
    });

    const response = await login("store-user");
    const adminRoute = await exports.default.fetch(
      new Request("https://example.com/api/admin/stores", {
        headers: { Cookie: cookiePair(response) },
      }),
    );

    expect(adminRoute.status).toBe(403);
  });

  it("logout invalida o cookie no navegador", async () => {
    await seedUser({ id: "admin-logout", login: "admin-logout", perfil: "admin" });
    const response = await login("admin-logout");

    const logout = await exports.default.fetch(
      new Request("https://example.com/api/auth/logout", {
        method: "POST",
        headers: { Cookie: cookiePair(response) },
      }),
    );

    expect(logout.status).toBe(204);
    expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
