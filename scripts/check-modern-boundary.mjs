import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const name of ["react", "react-dom", "react-router", "vite", "typescript"]) {
  assert.equal(pkg.dependencies?.[name], undefined, name + " não pode entrar no Worker antigo");
  assert.equal(pkg.devDependencies?.[name], undefined, name + " não pode entrar no build legado");
}
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
for (const file of files.filter(file => /\.(tsx?|jsx)$/.test(file))) {
  assert.match(file, /^apps\/web\//, "Novo React fora do diretório isolado: " + file);
}
const modern = JSON.parse(readFileSync("apps/web/package.json", "utf8"));
for (const name of ["react", "react-dom", "react-router"]) assert.ok(modern.dependencies[name], name);
for (const name of ["vite", "typescript", "@tailwindcss/vite"]) assert.ok(modern.devDependencies[name], name);
const worker = readFileSync("wrangler.preview.jsonc", "utf8");
assert.match(worker, /agendas-pradosm-preview/);
console.log("Isolamento React/Worker e configuração de preview preservados.");
