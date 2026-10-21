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
