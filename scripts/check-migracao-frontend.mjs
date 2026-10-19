import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const folder = join(root, "migration/frontend");
const files = readdirSync(folder).filter(f => f.endsWith(".js")).map(f => join(folder, f));
files.push(join(root, "src/agenda/exportAgendaPdf.js"));

for (const file of files) {
  const code = readFileSync(file, "utf8");
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw Error("Sintaxe inválida em " + file + ": " + result.stderr);
  for (const match of code.matchAll(/\bfrom\s+["'](\.\.?\/[^"']+)["']/g)) {
    const imported = match[1];
    if (!imported.endsWith(".js")) throw Error("Import sem extensão .js: " + imported);
    if (!existsSync(resolve(dirname(file), imported))) throw Error("Import inexistente em " + file + ": " + imported);
  }
  if (/\bfrom\s+["'](?:react|react-dom|react-router-dom)["']/.test(code)) throw Error("React proibido em " + file);
}
console.log("Verificados " + files.length + " módulos frontend JS puro.");
