import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
describe("Worker em JavaScript preserva a main", () => {
  it("conserva as rotas e a ordem dos middlewares", () => {
    const ts = source("../../worker/app.ts");
    const js = source("../../worker/app.js");
    const paths = body => [...body.matchAll(/app\.(?:get|use|route)\(\s*["']([^"']+)["']/g)].map(hit => hit[0]);
    assert.deepEqual(paths(js), paths(ts));
    for (const forbidden of ["/api/auth/demo-login", "/api/admin/reports", "PREVIEW_DEMO_LOGIN"]) assert.equal(js.includes(forbidden), false);
  });
  it("mantém fechamento diário agendado e o Durable Object", () => {
    const js = source("../../worker/index.js");
    assert.match(js, /async scheduled\(/);
    assert.match(js, /controller\.scheduledTime/);
    assert.match(js, /closePastOpenAgendas\(env\.DB/);
    assert.match(js, /RealtimeHub/);
  });
});
