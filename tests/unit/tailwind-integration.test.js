import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Tailwind CSS v4 incremental sem Preflight", () => {
  it("declara CLI versionada e build de CSS estatico sem CDN", () => {
    const p = JSON.parse(read("../../package.json"));
    assert.equal(p.devDependencies.tailwindcss, "4.3.3");
    assert.equal(p.devDependencies["@tailwindcss/cli"], "4.3.3");
    const build = read("../../scripts/build-native.mjs");
    assert.match(build, /tailwind\.input\.css/);
    assert.match(build, /tailwind\.css/);
    assert.match(build, /execFileSync/);
    const html = read("../../index.html");
    assert.match(html, /\/frontend\/styles\/tailwind\.css/);
  });
  it("importa apenas tema e utilities com prefixo e escopo", () => {
    const css = read("../../frontend/styles/tailwind.input.css");
    assert.match(css, /tailwindcss\/theme\.css/);
    assert.match(css, /tailwindcss\/utilities\.css/);
    assert.match(css, /source\(none\)/);
    assert.match(css, /prefix\(tw\)/);
    assert.match(css, /@source "\.\.\/dashboard\.js"/);
    assert.match(css, /@source "\.\.\/ui\/primitives\.js"/);
    assert.ok(css.includes("@apply tw:inline-flex"));
    assert.ok(css.includes("@apply tw:w-full"));
    assert.doesNotMatch(css, /tailwindcss\/preflight\.css/);
    const dashboard = read("../../frontend/dashboard.js");
    for (const name of ["tw:font-medium", "tw:tabular-nums", "tw:shrink-0"]) {
      assert.ok(dashboard.includes(name), name);
    }
  });
});

describe("Contratos de componentes reutilizaveis",()=>{
  it("fornece um unico contrato para controles, tabelas e etiquetas",async()=>{
    const { UI }=await import("../../frontend/ui/primitives.js");
    assert.deepEqual(Object.keys(UI).sort(),["action","badge","field","numeric","table"]);
    for(const key of ["action","badge","field","table"])assert.ok(UI[key].startsWith("ui-"));
    assert.equal(UI.numeric,"tw:tabular-nums");
  });
  it("reutiliza os componentes em Lojas, Usuarios e formularios",()=>{
    for(const page of ["stores","users","store-dialog","user-dialog"]){
      const js=read("../../frontend/"+page+".js");
      assert.ok(js.includes('import { UI } from "./ui/primitives.js"'),page);
      assert.ok(js.includes("${UI.action}"),page);
      assert.ok(js.includes("${UI.field}"),page);
    }
    for(const page of ["stores","users"]){
      const js=read("../../frontend/"+page+".js");
      assert.ok(js.includes("${UI.table}"),page);
      assert.ok(js.includes("${UI.badge}"),page);
    }
  });
});
