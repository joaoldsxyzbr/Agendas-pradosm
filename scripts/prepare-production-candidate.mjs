import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".");
const output = resolve(root, ".release-candidate");
const existing = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const production = JSON.parse(execFileSync("git", [
  "show", "origin/main:wrangler.jsonc"
], { encoding: "utf8" }));

if (production.name !== "agendas-pradosm")
  throw Error("Worker de produção inesperado. Publicação bloqueada.");
if (existing.name !== "agendas-pradosm-preview")
  throw Error("Este preparo só pode rodar a partir da preview isolada.");
const prodDb = production.d1_databases?.find(item => item.binding === "DB");
const previewDb = existing.d1_databases?.find(item => item.binding === "DB");
if (!prodDb || !previewDb || prodDb.database_id === previewDb.database_id)
  throw Error("Bindings D1 de produção e preview não estão isolados.");
if (production.triggers?.crons?.[0] !== "5 3 * * *")
  throw Error("Cron de fechamento mudou na main.");
if (production.vars?.REALTIME_MODE !== "on")
  throw Error("Realtime da produção deve permanecer ativo.");
if (production.main !== "./worker/index.ts")
  throw Error("Entrada original de produção mudou. Revisar a migração.");

const sql = await readFile("migrations/0017_appointment_observation.sql", "utf8");
if (!/^\s*ALTER TABLE agendamentos ADD COLUMN observacao TEXT CHECK \(observacao IS NULL OR length\(observacao\) <= 240\);\s*$/.test(sql))
  throw Error("Migration 0017 não é a alteração aditiva aprovada.");

await mkdir(output, { recursive: true });
await cp("public", resolve(output, "public"), { recursive: true, force: true });

const htmlPath = resolve(output, "public/index.html");
let html = await readFile(htmlPath, "utf8");
if (!html.includes("Agenda Prado | Prévia funcional") || !html.includes('class="preview-chip"'))
  throw Error("HTML da preview alterado: revisar antes da transformação.");
html = html.replace("Agenda Prado | Prévia funcional", "Agenda Prado")
  .replace("Interface empresarial em JavaScript puro conectada ao D1 de testes.",
    "Sistema de recebimentos de mercadorias.")
  .replace(/<span class="preview-chip">[^<]*<\/span>/, "")
  .replace("Conta de demonstração", "Conta")
  .replace("Agenda Prado · Worker Preview · Dados fictícios",
    "Agenda Prado · Sistema de recebimentos");
await writeFile(htmlPath, html, "utf8");

const livePath = resolve(output, "public/vanilla/live.js");
let live = await readFile(livePath, "utf8");
const fixes = [
  ['footer.textContent = "Agenda Prado · Worker Preview · D1 fictício";',
    'footer.textContent = "Agenda Prado · Sistema de recebimentos";'],
  ['$(".preview-chip").textContent = "PREVIEW · D1 ISOLADO";',
    '$(".preview-chip")?.remove();'],
  ['oldBottom.textContent = "Ambiente exclusivo de testes. Nenhum dado de produção é utilizado.";',
    'oldBottom.textContent = "Sistema de recebimentos";']
];
for (const [before, after] of fixes) {
  if (!live.includes(before)) throw Error("Shell da preview mudou: " + before);
  live = live.replace(before, after);
}
await writeFile(livePath, live, "utf8");

const config = structuredClone(production);
config.main = "./worker/index.js";
config.assets = {
  ...config.assets,
  directory: "./.release-candidate/public",
  binding: "ASSETS"
};
delete config.previews;
config.vars = { ...config.vars, REALTIME_MODE: "on" };
delete config.vars.PREVIEW_DEMO_LOGIN;
delete config.vars.PREVIEW_DEPLOYMENT;

if (Object.values(config.vars).some(x => String(x).includes("demo")))
  throw Error("Flag de demo detectada no candidato de produção.");
if (config.d1_databases[0].database_id !== prodDb.database_id)
  throw Error("Binding D1 produtivo não foi preservado.");
if (config.triggers?.crons?.[0] !== "5 3 * * *")
  throw Error("Cron produtivo não foi preservado.");
if (/PREVIEW · D1 ISOLADO|Worker Preview|Dados fictícios|Conta de demonstração/.test(html + live))
  throw Error("Identificadores visuais de preview permaneceram no candidato.");

await writeFile("wrangler.production-candidate.jsonc",
  JSON.stringify(config, null, 2) + "\n", "utf8");
console.log("Candidato de produção preparado localmente sem escrita remota.");
console.log("Worker:", config.name, "| entry:", config.main,
  "| D1 distinto da preview:", true, "| cron:", config.triggers.crons[0]);
