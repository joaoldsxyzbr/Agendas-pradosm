import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../../worker/lib/password";
import { createSessionToken } from "../../worker/lib/session";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const viewerPassword = "senha-viewer-segura";
const now = "2026-09-28T12:00:00.000Z";

async function seedAdmin() {
  const id = crypto.randomUUID();
  const login = `admin-viewer-${id}`;
  const senhaHash = await hashPassword("senha-admin-teste");

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, 'Administrador', ?, ?, 'admin', 1, ?, ?)",
    )
    .bind(id, login, senhaHash, now, now)
    .run();

  const token = await createSessionToken(id, sessionSecret);
  return `agenda_session=${token}`;
}

async function jsonRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  cookie: string,
  body?: unknown,
) {
  return exports.default.fetch(
    new Request(`https://example.com${url}`, {
      method,
      headers: {
        Cookie: cookie,
        Origin: "https://example.com",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("visualizador do dashboard", () => {
  it("admin cria visualizador e ele só acessa leitura do dashboard", async () => {
    const adminCookie = await seedAdmin();
    const login = `viewer-${crypto.randomUUID()}`;

    const created = await jsonRequest(
      "/api/admin/users",
      "POST",
      adminCookie,
      {
        nome: "Equipe Operacional",
        login,
        senha: viewerPassword,
        papel: "visualizador",
      },
    );

    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      nome: "Equipe Operacional",
      login,
      papel: "visualizador",
      lojaId: null,
      ativo: true,
    });

    const loginResponse = await exports.default.fetch(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        },
        body: JSON.stringify({ login, senha: viewerPassword }),
      }),
    );

    expect(loginResponse.status).toBe(200);
    expect(await loginResponse.clone().json()).toMatchObject({
      papel: "visualizador",
    });

    const cookie = loginResponse.headers.get("Set-Cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();

    const me = await exports.default.fetch(
      new Request("https://example.com/api/auth/me", {
        headers: { Cookie: cookie! },
      }),
    );
    expect(await me.json()).toMatchObject({
      papel: "visualizador",
    });

    const stores = await exports.default.fetch(
      new Request("https://example.com/api/admin/stores", {
        headers: { Cookie: cookie! },
      }),
    );
    expect(stores.status).toBe(200);

    const agendas = await exports.default.fetch(
      new Request("https://example.com/api/admin/agendas?date=2026-09-28", {
        headers: { Cookie: cookie! },
      }),
    );
    expect(agendas.status).toBe(200);

    const users = await exports.default.fetch(
      new Request("https://example.com/api/admin/users", {
        headers: { Cookie: cookie! },
      }),
    );
    expect(users.status).toBe(403);

    expect(
      (
        await jsonRequest(
          "/api/admin/agendas/import",
          "POST",
          cookie!,
          {},
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await jsonRequest(
          "/api/admin/stores",
          "POST",
          cookie!,
          { codigo: "FVIEW", nome: "Não deve criar" },
        )
      ).status,
    ).toBe(403);
  });
});
