import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const skipped = new Set([".git", "node_modules", ".wrangler", "dist", "coverage", "playwright-report", "test-results"]);
function walk(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name)) found.push(...walk(path));
    } else {
      found.push(path);
    }
  }
  return found;
}
const files = walk(".");
const legacy = files.filter((path) => /\.(?:ts|tsx|mts|cts)$/.test(path));
assert.deepEqual(legacy, [], "a migração não pode deixar fontes TypeScript: " + legacy.join(", "));
const scripts = files.filter((path) => /\.(?:js|mjs|cjs)$/.test(path));
for (const path of scripts) {
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  assert.equal(result.status, 0, path + ": " + (result.stderr || result.stdout));
}
console.log("JavaScript válido em " + scripts.length + " arquivos; nenhuma fonte TypeScript restante.");
