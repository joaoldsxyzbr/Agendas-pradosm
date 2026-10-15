import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { transformSync } from "esbuild";

// Migração isolada: converte código TS existente em módulos JavaScript nativos.
// esbuild é apenas ferramenta de transformação; nenhum framework no runtime.
const roots = ["worker", "shared"];
function convert(source, path) {
  return transformSync(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcefile: path,
  }).code;
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (extname(path) !== ".ts" || path.endsWith(".d.ts")) continue;
    const target = path.replace(/\.ts$/, ".js");
    writeFileSync(target, convert(readFileSync(path, "utf8"), path), "utf8");
    console.log(path + " → " + target);
  }
}
for (const root of roots) walk(root);

for (const [src, dest] of [
  ["src/import/parseAgendaText.ts", "public/vanilla/parseAgendaText.js"],
  ["src/import/parseAgendaBatch.ts", "public/vanilla/parseAgendaBatch.js"],
  ["src/agenda/exportAgendaPdf.ts", "public/vanilla/exportAgendaPdf.js"],
]) {
  const compiled = convert(readFileSync(src, "utf8"), src);
  const js = compiled.replace(/from (["'])\.\/parseAgendaText\1/g, 'from "./parseAgendaText.js"');
  writeFileSync(dest, js, "utf8");
  console.log(src + " → " + dest);
}
