import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../../worker/app";

const db = (env as unknown as { DB: D1Database }).DB;
const NOW = "2026-10-15T12:00:00.000Z";

async function seedDemo() {
  await db.prepare(
    "INSERT OR IGNORE INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES ('demo-test-store', 'DEMO-TEST', 'Loja teste', 1, ?, ?)",
  ).bind(NOW, NOW).run();

  await db.batch(
    ([
      ["demo-test-admin", null, "Admin fictício", "demo-admin", "admin"],
      ["demo-test-viewer", null, "Visualizador fictício", "demo-visualizador", "visualizador"],
      ["demo-test-conferente", "demo-test-store", "Conferente fictício", "demo-conferente", "conferente"],
    ] as const).map(([id,storeId,name,login,role]) =>
      db.prepare(
        "INSERT OR IGNORE INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, 'preview-demo-no-password', ?, 1, ?, ?)",
      ).bind(id, storeId, name, login, role, NOW, NOW),
    ),
  );
}

const demoRequest = (papel: string, origin = "https://example.com") =>
  new Request("https://example.com/api/auth/demo-login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ papel }),
  });

describe("quick-login exclusivo da preview", () => {
  it("mostra disponibilidade só quando ambas as proteções estão ligadas", async () => {
    const available = await exports.default.fetch("https://example.com/api/auth/demo-status");
    expect(available.status).toBe(200);
    expect(await available.json()).toEqual({ available: true });

    const disabledEnv = { ...env, PREVIEW_DEMO_LOGIN: "off" };
    const unavailable = await app.request("https://example.com/api/auth/demo-status", undefined, disabledEnv);
    expect(await unavailable.json()).toEqual({ available: false });

    const blocked = await app.request(demoRequest("admin"), undefined, disabledEnv);
    expect(blocked.status).toBe(404);

    const wrongWorkerEnv = { ...env, PREVIEW_DEPLOYMENT: "agendas-pradosm" };
    const wrongWorker = await app.request(demoRequest("admin"), undefined, wrongWorkerEnv);
    expect(wrongWorker.status).toBe(404);
  });

  it("cria sessão normal para os três papéis fictícios", async () => {
    await seedDemo();

    for (const papel of ["admin", "visualizador", "conferente"]) {
      const response = await exports.default.fetch(demoRequest(papel));
      expect(response.status).toBe(200);
      const session = response.headers.get("Set-Cookie") || "";
      expect(session).toContain("HttpOnly");
      expect(session).toContain("SameSite=Strict");
      expect(session).toContain("Secure");
      const authUser = await response.json() as { papel: string; lojaCodigo: string | null };
      expect(authUser.papel).toBe(papel);
      expect(authUser.lojaCodigo).toBe(papel === "conferente" ? "DEMO-TEST" : null);

      const me = await exports.default.fetch(
        new Request("https://example.com/api/auth/me", {
          headers: { Cookie: session.split(";")[0] },
        }),
      );
      expect(me.status).toBe(200);
      expect(await me.json()).toMatchObject({ papel });
    }
  });

  it("nega perfis inválidos e origem externa", async () => {
    expect((await exports.default.fetch(demoRequest("superadmin"))).status).toBe(400);
    expect((await exports.default.fetch(demoRequest("admin", "https://outro.example"))).status).toBe(403);
  });

  it("nunca permite login por senha usando as contas de demonstração", async () => {
    await seedDemo();
    const response = await exports.default.fetch(new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "demo-admin", senha: "senha-segura-123" }),
    }));
    expect(response.status).toBe(401);
  });
});
