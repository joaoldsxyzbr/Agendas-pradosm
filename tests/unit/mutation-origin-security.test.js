import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { validateMutationOrigin } from "../../worker/lib/http.js";

function fixture() {
  const app = new Hono();
  app.use("/api/admin/*", validateMutationOrigin);
  app.post("/api/admin/example", (c) => c.json({ ok: true }));
  return app;
}

describe("Proteção de origem das mutações", () => {
  it("rejeita Origin externo", async () => {
    const response = await fixture().request("https://agendas.example/api/admin/example", { method: "POST", headers: { Origin: "https://other.example" } });
    assert.equal(response.status, 403);
  });
  it("aceita requisição de mesma origem", async () => {
    const response = await fixture().request("https://agendas.example/api/admin/example", { method: "POST", headers: { Origin: "https://agendas.example", "Sec-Fetch-Site": "same-origin" } });
    assert.equal(response.status, 200);
  });
  it("rejeita Fetch Metadata cross-site sem Origin", async () => {
    const response = await fixture().request("https://agendas.example/api/admin/example", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(response.status, 403);
  });
  it("aceita cliente sem Fetch Metadata e sem Origin para compatibilidade", async () => {
    const response = await fixture().request("https://agendas.example/api/admin/example", { method: "POST" });
    assert.equal(response.status, 200);
  });
});
import { app as productionApp } from "../../worker/app.js";

describe("Login e logout protegidos contra requisições cross-site", () => {
  it("bloqueia login sem Origin quando Fetch Metadata indica outro site", async () => {
    const response = await productionApp.request("https://agendas.example/api/auth/login", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" }, body: "{}" });
    assert.equal(response.status, 403);
  });
  it("bloqueia logout vindo de outra origem", async () => {
    const response = await productionApp.request("https://agendas.example/api/auth/logout", { method: "POST", headers: { Origin: "https://outro.example" } });
    assert.equal(response.status, 403);
  });
  it("mantém respostas normais de validação para login de mesma origem", async () => {
    const response = await productionApp.request("https://agendas.example/api/auth/login", { method: "POST", headers: { Origin: "https://agendas.example", "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 400);
  });
});
