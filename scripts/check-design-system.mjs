import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/vanilla/styles.css", import.meta.url), "utf8");
for (const token of ["--canvas: #14161b", "--panel: #202329", "--accent: #79afff"]) {
  assert.ok(css.includes(token), "token de design ausente: " + token);
}
for (const feature of [":focus-visible", "prefers-reduced-motion", ".sidebar", ".table-scroll", "@media"]) {
  assert.ok(css.includes(feature), "regra de interface responsiva/acessível ausente: " + feature);
}
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
assert.ok(html.includes("styles.css?v=prado-enterprise-20261015"), "cache versionado não encontrado");
assert.ok(html.includes('type="module" src="/vanilla/live.js'), "entrada JavaScript puro ausente");
assert.ok(css.includes(".stat::before { content:none }"), "indicadores sem faixa decorativa");
console.log("Visual empresarial, CSS nativo, foco e responsividade validados.");
