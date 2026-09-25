import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

assert.ok(css.includes("--color-primary: #1558a6"), "token primary light ausente");
assert.ok(css.includes("--color-primary-strong: #0b3d78"), "token primary strong ausente");
assert.ok(css.includes("--color-accent: #f4c430"), "token amarelo ausente");
assert.ok(css.includes("var(--color-accent)"), "amarelo não está sendo usado");
assert.ok(!css.toLowerCase().includes("#1f6848"), "verde legado ainda presente");

assert.ok(css.includes('html[data-theme="dark"]'), "bloco dark ausente");
assert.ok(css.includes("--color-background: #0d1624"), "fundo dark ausente");
assert.ok(css.includes("--color-surface: #142033"), "surface dark ausente");
assert.ok(css.includes("--color-primary: #5ca8ff"), "primary dark ausente");
assert.ok(css.includes("--color-accent: #ffd449"), "accent dark ausente");
assert.ok(
  css.includes("grid-template-columns: 208px minmax(0, 1fr)"),
  "sidebar compacta do conferente ausente",
);
assert.ok(
  css.includes(".sidebar-footer-actions"),
  "ações compactas do rodapé da sidebar ausentes",
);

console.log("Design system light/dark validado.");
