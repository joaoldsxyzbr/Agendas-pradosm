import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
function routePatterns(source) {
  return [...source.matchAll(/\b(?:get|post|patch|put|delete)\(\s*["'](\/[^"']+)["']/g)].map(hit => hit[0]);
}
describe("Superfície de rotas da main preservada", () => {
  for (const path of ["admin-audit", "admin-stores", "admin-users", "presence", "realtime"]) {
    it(path + " possui os mesmos endpoints da main", () => {
      const root = "../../worker/routes/" + path;
      assert.deepEqual(routePatterns(load(root + ".js")), routePatterns(load(root + ".ts")));
    });
  }
  it("middleware mantém autenticação e permissões por papel", () => {
    const src = load("../../worker/middleware/auth.js");
    for (const token of ["requireAuth", "requireAdmin", "restrictDashboardViewer", "SESSION_MAX_AGE"]) assert.ok(src.includes(token), token);
  });
  it("Durable Object mantém os eventos, publicação e revogação", () => {
    const src = load("../../worker/realtime/RealtimeHub.js");
    for (const token of ["presence.set","presence.changed","agenda.changed","/internal/publish","/internal/revoke"]) assert.ok(src.includes(token), token);
  });
});
