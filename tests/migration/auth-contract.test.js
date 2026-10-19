import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const routes = src => [...src.matchAll(/authRoutes\.(get|post|patch|delete)\(\s*"([^"]+)"/g)].map(m => [m[1], m[2]]);
describe("Autenticação JS corresponde à main", () => {
  it("preserva todos os endpoints e não inclui login de demonstração", () => {
    const expected = JSON.parse(read("./legacy-route-contracts.json")).auth;
    const js = read("../../worker/routes/auth.js");
    assert.deepEqual(routes(js), expected);
    assert.equal(js.includes("/demo-login"), false);
    assert.equal(js.includes("/demo-status"), false);
  });
  it("mantém senha, rate-limit, sessões e revogação de acesso", () => {
    const js = read("../../worker/routes/auth.js");
    for (const token of ["verifyPassword", "checkLoginRateLimit", "verifySessionToken", "sameSite: \"Strict\"", "session_version", "passwordNeedsUpgrade", "revokeRealtimeUser"]) assert.ok(js.includes(token), token);
  });
});
