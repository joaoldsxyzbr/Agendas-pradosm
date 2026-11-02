import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

describe("Benchmark SQL sintético nativo", () => {
  it("executa as consultas reais sem conectar no D1 remoto", () => {
    const execution = spawnSync(process.execPath,
      ["--no-warnings", new URL("../../scripts/benchmark-agendas.mjs", import.meta.url).pathname, "--quick"],
      { encoding: "utf8", timeout: 30_000 });
    assert.equal(execution.status, 0, execution.stderr || execution.stdout);
    const output = JSON.parse(execution.stdout);
    assert.equal(output.agendas, 40);
    assert.equal(output.appointments, 600);
    assert.equal(output.engine.includes("local"), true);
    assert.deepEqual(output.cases.map(c => c.count), [40, 10, 4]);
    assert.ok(output.cases.every(c => c.median_ms >= 0));
    assert.ok(output.cases.every(c => Array.isArray(c.plan) && c.plan.length > 0));
  });
});
