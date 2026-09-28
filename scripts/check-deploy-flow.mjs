import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CONTRACT_MIGRATION_BASELINE,
  destructiveOperation,
} from "./check-migration-safety.mjs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const deploy = packageJson.scripts?.deploy ?? "";
const productionVerify = packageJson.scripts?.["verify:production"] ?? "";
const migrationCheck = packageJson.scripts?.["check:migrations"] ?? "";
const wranglerConfig = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);

assert.equal(
  productionVerify,
  "npm test && npm run typecheck && npm run build",
  "gate de produção deve executar testes, typecheck e build",
);

assert.equal(
  migrationCheck,
  "node scripts/check-migration-safety.mjs",
  "deploy deve possuir gate explícito de migrations",
);

assert.equal(
  wranglerConfig.name,
  "agendas-pradosm",
  "wrangler deve apontar para o Worker de produção",
);

assert.ok(
  deploy.startsWith("npm run verify:production"),
  "deploy deve verificar toda a aplicação antes de tocar no banco remoto",
);
assert.ok(
  deploy.includes("npm run check:migrations"),
  "deploy deve validar segurança das migrations",
);
assert.ok(
  deploy.includes("wrangler d1 migrations apply DB --remote"),
  "deploy nativo deve aplicar migrations D1 remotas",
);
assert.ok(
  deploy.includes("wrangler deploy"),
  "deploy nativo deve publicar o Worker com Wrangler",
);

const verifyIndex = deploy.indexOf("npm run verify:production");
const guardIndex = deploy.indexOf("npm run check:migrations");
const migrationIndex = deploy.indexOf(
  "wrangler d1 migrations apply DB --remote",
);
const deployIndex = deploy.lastIndexOf("wrangler deploy");

assert.ok(
  verifyIndex === 0 && guardIndex > verifyIndex,
  "gate de migrations deve ocorrer depois da verificação completa",
);
assert.ok(
  migrationIndex > guardIndex,
  "migration D1 só pode ocorrer depois do gate de segurança",
);
assert.ok(
  deployIndex > migrationIndex,
  "Worker deve ser publicado depois de migrations previamente classificadas como aditivas",
);

assert.equal(CONTRACT_MIGRATION_BASELINE, 12);
assert.equal(destructiveOperation("CREATE TABLE exemplo (id TEXT);"), null);
assert.equal(
  destructiveOperation("-- DROP TABLE ignorado\nCREATE INDEX idx_x ON x(id);"),
  null,
);
assert.equal(destructiveOperation("DROP TABLE usuarios;"), "DROP");
assert.equal(destructiveOperation("DELETE FROM usuarios;"), "DELETE FROM");
assert.equal(
  destructiveOperation("ALTER TABLE usuarios RENAME TO usuarios_old;"),
  "ALTER TABLE RENAME",
);

assert.equal(
  existsSync(new URL("../.github/workflows/deploy.yml", import.meta.url)),
  false,
  "GitHub Actions não deve ter um segundo caminho de deploy",
);

const ci = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
assert.ok(!ci.includes("wrangler deploy"), "CI não deve publicar produção");
assert.ok(
  ci.includes("npm audit --omit=dev"),
  "CI deve auditar dependências de produção",
);
assert.equal(
  existsSync(new URL("../.github/dependabot.yml", import.meta.url)),
  true,
  "Dependabot deve manter dependências atualizadas",
);
assert.ok(
  !ci.includes("CLOUDFLARE_API_TOKEN"),
  "CI não deve depender de credenciais Cloudflare",
);

const loginLimiter = wranglerConfig.ratelimits?.find(
  (binding) => binding.name === "LOGIN_RATE_LIMITER",
);
assert.ok(loginLimiter, "produção deve ter rate limit dedicado ao login");
assert.equal(loginLimiter.namespace_id, "2026092401");
assert.deepEqual(loginLimiter.simple, { limit: 10, period: 60 });

assert.equal(
  wranglerConfig.observability?.enabled,
  true,
  "observabilidade do Worker deve estar habilitada",
);
assert.equal(wranglerConfig.observability?.logs?.enabled, true);
assert.equal(wranglerConfig.observability?.logs?.invocation_logs, true);
assert.equal(wranglerConfig.observability?.redact_query_string, true);
assert.equal(wranglerConfig.observability?.traces?.enabled, true);
assert.ok(
  wranglerConfig.observability.traces.head_sampling_rate <= 0.05,
  "traces devem usar amostragem controlada",
);

const headersPath = new URL("../public/_headers", import.meta.url);
assert.equal(
  existsSync(headersPath),
  true,
  "assets estáticos devem declarar headers defensivos",
);
const staticHeaders = readFileSync(headersPath, "utf8");
for (const header of [
  "Content-Security-Policy:",
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: no-referrer",
  "Permissions-Policy:",
  "Strict-Transport-Security:",
]) {
  assert.ok(
    staticHeaders.includes(header),
    `header ausente em public/_headers: ${header}`,
  );
}

console.log("Fluxo nativo Cloudflare e hardening de produção validados.");
