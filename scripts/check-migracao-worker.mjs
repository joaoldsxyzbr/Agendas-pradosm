import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const listed = [
  "worker/app.js", "worker/index.js", "worker/env.js",
  "shared/agenda.js", "shared/api.js", "shared/auth.js", "shared/realtime.js",
  "shared/store.js", "shared/time.js",
  "src/import/extractPdfText.js", "src/import/parseAgendaBatch.js",
  "src/import/parseAgendaText.js",
  "worker/lib/http.js", "worker/lib/login-rate-limit.js", "worker/lib/password.js",
  "worker/lib/presence.js", "worker/lib/session.js", "worker/lib/time.js",
  "worker/middleware/auth.js", "worker/realtime/RealtimeHub.js",
  "worker/repositories/agendas.js", "worker/repositories/audit.js",
  "worker/repositories/presence.js", "worker/repositories/stores.js",
  "worker/repositories/users.js",
  "worker/services/agenda-maintenance.js", "worker/services/realtime.js",
  "worker/routes/admin-agendas.js", "worker/routes/admin-audit.js",
  "worker/routes/admin-stores.js", "worker/routes/admin-users.js",
  "worker/routes/auth.js", "worker/routes/presence.js", "worker/routes/realtime.js",
  "worker/routes/store-agendas.js"
];

let count = 0;
for (const file of listed) {
  const full = join(root, file);
  if (!existsSync(full)) throw Error("Arquivo migrado ausente: " + file);
  const code = readFileSync(full, "utf8");
  if (/\b(?:import|export)\s+type\b|\bnew Hono<AppEnv>\b/.test(code)) throw Error("TypeScript no arquivo: " + file);
  const check = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  if (check.status !== 0) throw Error(file + ": " + (check.stderr || check.stdout));
  for (const match of code.matchAll(/\bfrom\s+["'](\.\.?\/[^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier.endsWith(".js")) throw Error("Import sem extensão: " + file + " -> " + specifier);
    const target = resolve(dirname(full), specifier);
    if (!existsSync(target)) throw Error("Import inexistente: " + file + " -> " + specifier);
  }
  count++;
}
console.log("Worker e contratos em JS: " + count + " módulos com sintaxe e importações verificadas.");
