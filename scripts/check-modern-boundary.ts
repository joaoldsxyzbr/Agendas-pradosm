import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const name of ["react", "react-dom", "react-router", "vite", "vitest", "typescript"]) {
  assert.equal(pkg.dependencies?.[name], undefined, name + " não pode entrar no pacote do Worker");
  assert.equal(pkg.devDependencies?.[name], undefined, name + " não pode entrar no pacote do Worker");
}
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
for (const file of files.filter(file => /\.(tsx?|jsx)$/.test(file))) {
  assert.match(file, /^(?:apps\/web|worker|shared|tests|scripts)\//, "TypeScript fora das pastas do produto: " + file);
}
const modern = JSON.parse(readFileSync("apps/web/package.json", "utf8"));
for (const name of ["react", "react-dom", "react-router"]) assert.ok(modern.dependencies[name], name);
for (const name of ["vite", "typescript", "@tailwindcss/vite"]) assert.ok(modern.devDependencies[name], name);
const worker = readFileSync("wrangler.preview.jsonc", "utf8");
assert.match(worker, /agendas-pradosm-preview/);
console.log("Isolamento React/Worker e configuração de preview preservados.");
