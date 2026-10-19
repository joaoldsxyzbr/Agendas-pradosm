import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const endpoints = code => [...code.matchAll(/\.(?:get|post|put|patch|delete)\(\s*["'](\/[^"']+)["']/g)].map(m => m[0]);
for (const name of ["admin-agendas", "store-agendas"]) {
  describe(name + " — paridade da main", () => {
    const expected = JSON.parse(load("./legacy-route-contracts.json")).agenda[name];
    const js = load("../../worker/routes/" + name + ".js");
    it("mantém todos os endpoints e métodos", () => {
      assert.deepEqual(endpoints(js), expected);
    });
    it("exige motivo no não recebido e preserva os endpoints existentes", () => {
      assert.match(js, /validateStatusObservation/);
      assert.match(js, /\/:id\/observation/);
      assert.ok(js.includes("changeAppointmentStatus("));
      assert.ok(js.includes('status: z.enum(["aguardando", "recebido", "nao_chegou", "recusado"])'));
    });
    it("inclui somente imports ESM relativos explícitos", () => {
      const imports = [...js.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)].map(x => x[1]);
      assert.ok(imports.length > 0);
      assert.ok(imports.every(specifier => specifier.endsWith(".js")));
    });
  });
}