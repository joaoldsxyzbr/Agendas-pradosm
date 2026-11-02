import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
describe("Worker em JavaScript preserva a main", () => {
  it("conserva as rotas e a ordem dos middlewares", () => {
    const expected = JSON.parse(source("./legacy-route-contracts.json")).app;
    const js = source("../../worker/app.js");
    const paths = body => [...body.matchAll(/app\.(?:get|use|route)\(\s*["']([^"']+)["']/g)].map(hit => hit[0]);
    const current=paths(js);
    assert.deepEqual(current.filter(path=>!path.includes("/api/store/tags")),expected);
    assert.ok(current.includes('app.route("/api/store/tags"'));
    assert.ok(current.indexOf('app.route("/api/store/tags"')>current.indexOf('app.use("/api/store/*"'));
    assert.match(js,/app\.route\("\/api\/admin\/reports"/);
    for (const forbidden of ["/api/auth/demo-login", "PREVIEW_DEMO_LOGIN"]) assert.equal(js.includes(forbidden), false);
  });
  it("mantém fechamento diário agendado e o Durable Object", () => {
    const js = source("../../worker/index.js");
    assert.match(js, /async scheduled\(/);
    assert.match(js, /controller\.scheduledTime/);
    assert.match(js, /closePastOpenAgendas\(env\.DB/);
    assert.match(js, /RealtimeHub/);
  });
});