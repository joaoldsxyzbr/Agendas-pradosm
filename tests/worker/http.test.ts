import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { MAX_IMPORT_JSON_BYTES } from "../../worker/lib/http";
import { createSessionToken } from "../../worker/lib/session";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$600000$AAECAwQFBgcICQoLDA0ODw==$mjQnW0x82GJVUIdErtKLjhrDkQnpSUvwhVvXx4B1L3M=";
const now = "2026-09-24T12:00:00.000Z";

async function adminCookie(id: string) {
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
    )
    .bind(id, `Admin ${id}`, `login-${id}`, passwordHash, now, now)
    .run();

  const token = await createSessionToken(id, sessionSecret);
  return `agenda_session=${token}`;
}

describe("HTTP hardening", () => {
  it("marca respostas de autenticação como no-store e JSON", async () => {
    const response = await exports.default.fetch(
      new Request("https://example.com/api/auth/me"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("rejeita Origin diferente em mutação administrativa autenticada", async () => {
    const cookie = await adminCookie("admin-origin");

    const response = await exports.default.fetch(
      new Request("https://example.com/api/admin/stores", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ codigo: "F90", nome: "Loja origem" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "ORIGEM_INVALIDA",
    });
  });

  it("aceita Origin da própria aplicação", async () => {
    const cookie = await adminCookie("admin-same-origin");

    const response = await exports.default.fetch(
      new Request("https://example.com/api/admin/stores", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://example.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ codigo: "F91", nome: "Loja mesma origem" }),
      }),
    );

    expect(response.status).toBe(201);
  });

  it("bloqueia JSON de importação acima do limite", async () => {
    const cookie = await adminCookie("admin-large-import");
    const oversized = "x".repeat(MAX_IMPORT_JSON_BYTES + 1);

    const response = await exports.default.fetch(
      new Request("https://example.com/api/admin/agendas/import", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://example.com",
          "Content-Type": "application/json",
        },
        body: oversized,
      }),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      error: "REQUISICAO_MUITO_GRANDE",
    });
  });
});
