import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
describe("Worker em JavaScript preserva a main", () => {
  it("conserva as rotas e a ordem dos middlewares", () => {
    const expected = JSON.parse(source("./legacy-route-contracts.json")).app;
    const js = source("../../worker/app.js");
    const paths = body => [...body.matchAll(/app\.(?:get|use|route)\(\s*["']([^"']+)["']/g)].map(hit => hit[0]);
    const actual = paths(js);
    const newRoutes = ['app.route("/api/admin/cross"', 'app.route("/api/store/cross"', 'app.route("/api/auth/quick-login"'];
    const crossRouteCount = actual.filter(path => path === 'app.route("/api/admin/cross"' || path === 'app.route("/api/store/cross"').length;
    assert.equal(crossRouteCount, 3, "P4 mantém somente rotas vinculadas e o arquivo legado ADM");
    assert.doesNotMatch(js, /storeCrossRoutes|adminCrossRoutes\b/);
    assert.deepEqual(actual.filter(path => !newRoutes.includes(path)), expected);
    for (const route of newRoutes) assert.ok(actual.includes(route), route);
    assert.ok(actual.indexOf('app.route("/api/admin/cross"') > actual.indexOf('app.use("/api/admin/*"'));
    assert.ok(actual.indexOf('app.route("/api/store/cross"') > actual.indexOf('app.use("/api/store/*"'));
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