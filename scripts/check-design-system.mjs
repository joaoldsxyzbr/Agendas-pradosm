import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/vanilla/styles.css", import.meta.url), "utf8");
for (const token of ["--canvas", "--panel", "--accent"]) {
  assert.ok(css.includes(token), "token de design ausente: " + token);
}
for (const feature of [":focus-visible", "prefers-reduced-motion", ".sidebar", ".table-scroll", "@media"]) {
  assert.ok(css.includes(feature), "regra de interface responsiva/acessível ausente: " + feature);
}
console.log("CSS nativo, tokens, foco, movimento reduzido e responsividade validados.");
