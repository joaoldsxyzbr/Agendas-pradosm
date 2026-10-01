import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CONTRACT_APPROVALS_FILE,
  CONTRACT_MIGRATION_BASELINE,
  destructiveOperation,
  isValidContractApproval,
  migrationDigest,
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

const contractMigration = {
  fileName: "0099_contract_exemplo.sql",
  operation: "DROP",
  sql: "DROP TABLE exemplo_legado;\n",
};
const contractApproval = {
  fileName: contractMigration.fileName,
  operation: contractMigration.operation,
  sha256: migrationDigest(contractMigration.sql),
  issue: "#999",
  approvedBy: "responsavel-revisao",
  approvedAt: "2026-09-30T20:00:00.000Z",
  reason: "Contract previamente aprovado após uma release inteira de observação.",
};
assert.equal(
  isValidContractApproval(contractApproval, contractMigration),
  true,
  "manifesto contract válido deve liberar somente o SQL exatamente aprovado",
);
assert.equal(
  isValidContractApproval(
    contractApproval,
    { ...contractMigration, sql: "DROP TABLE outro_exemplo;\n" },
  ),
  false,
  "qualquer mudança no SQL deve invalidar a aprovação contract",
);
assert.equal(
  existsSync(new URL(`../migrations/${CONTRACT_APPROVALS_FILE}`, import.meta.url)),
  true,
  "manifesto versionado de aprovações contract deve existir",
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
const productionReleasePath = new URL(
  "../docs/operations/production-release.md",
  import.meta.url,
);
const dataRecoveryPath = new URL(
  "../docs/operations/data-recovery.md",
  import.meta.url,
);
assert.equal(
  existsSync(productionReleasePath),
  true,
  "runbook de release de produção deve existir",
);
const productionRelease = readFileSync(productionReleasePath, "utf8");
assert.ok(
  productionRelease.includes("npm run deploy"),
  "runbook deve registrar npm run deploy como comando de produção",
);
assert.ok(
  productionRelease.includes("Workers Builds"),
  "runbook deve documentar o vínculo com Workers Builds",
);
assert.equal(
  existsSync(dataRecoveryPath),
  true,
  "runbook de recuperação de dados D1 deve existir",
);
const dataRecovery = readFileSync(dataRecoveryPath, "utf8");
assert.ok(
  dataRecovery.includes("d1 time-travel info"),
  "runbook de recuperação deve registrar a captura do bookmark atual",
);
assert.ok(
  dataRecovery.includes("d1 time-travel restore"),
  "runbook de recuperação deve registrar o procedimento de restore",
);
assert.ok(
  productionRelease.includes("data-recovery.md"),
  "runbook de release deve apontar para recuperação de dados",
);

assert.ok(!ci.includes("wrangler deploy"), "CI não deve publicar produção");
assert.ok(
  !ci.includes("paths-ignore:"),
  "CI deve rodar também em alterações somente de documentação",
);
assert.ok(
  ci.includes("npm audit --omit=dev"),
  "CI deve auditar dependências de produção",
);
assert.ok(
  ci.includes("Install Playwright Chromium"),
  "CI deve instalar Chromium do Playwright",
);
assert.ok(
  ci.includes("playwright install --with-deps chromium"),
  "CI deve instalar navegador e dependências pelo Playwright",
);
assert.ok(
  ci.includes("npm run test:e2e:ci"),
  "CI deve executar a suíte E2E sem recompilar o bundle já validado",
);
assert.ok(
  ci.includes("needs: [quality, codeql]"),
  "check verify deve depender de qualidade e CodeQL",
);
assert.ok(
  ci.includes("name: verify"),
  "CI deve publicar um único gate obrigatório chamado verify",
);
assert.ok(
  ci.includes("github/codeql-action/analyze@"),
  "gate CI deve executar CodeQL antes de liberar verify",
);
assert.ok(
  !ci.includes("lighthouse@"),
  "CI não deve manter o smoke Lighthouse substituído pelo Playwright",
);
assert.equal(
  packageJson.scripts?.["test:e2e"],
  "npm run build && npm run test:e2e:prepare && playwright test",
  "package.json deve manter o E2E local autocontido",
);
assert.equal(
  packageJson.scripts?.["test:e2e:ci"],
  "npm run test:e2e:prepare && playwright test",
  "CI não deve executar um segundo build antes do Playwright",
);
for (const path of [
  "../playwright.config.ts",
  "../tests/e2e/login-accessibility.spec.ts",
  "../tests/e2e/roles.spec.ts",
  "../tests/e2e/seed.sql",
]) {
  assert.equal(
    existsSync(new URL(path, import.meta.url)),
    true,
    `arquivo E2E obrigatório ausente: ${path}`,
  );
}
assert.equal(
  existsSync(new URL("../.github/dependabot.yml", import.meta.url)),
  true,
  "Dependabot deve manter dependências atualizadas",
);
assert.ok(
  !ci.includes("CLOUDFLARE_API_TOKEN"),
  "CI não deve depender de credenciais Cloudflare",
);

const manualVerify = readFileSync(
  new URL("../.github/workflows/verify.yml", import.meta.url),
  "utf8",
);
assert.ok(
  manualVerify.includes("name: Manual Verify"),
  "workflow manual deve ter nome distinto do gate obrigatório",
);
assert.ok(
  manualVerify.includes("manual-verify:"),
  "job manual não pode reutilizar o contexto verify",
);
assert.ok(
  manualVerify.includes('context="agenda-prado/manual-verify"'),
  "status manual deve usar contexto inequívoco",
);

const loginLimiter = wranglerConfig.ratelimits?.find(
  (binding) => binding.name === "LOGIN_RATE_LIMITER",
);
assert.ok(loginLimiter, "produção deve ter rate limit dedicado ao login");
assert.equal(loginLimiter.namespace_id, "2026092401");
assert.deepEqual(loginLimiter.simple, { limit: 10, period: 60 });

const productionDb = wranglerConfig.d1_databases?.find(
  (binding) => binding.binding === "DB",
);
const previewDb = wranglerConfig.previews?.d1_databases?.find(
  (binding) => binding.binding === "DB",
);
assert.ok(previewDb, "Preview deve possuir binding D1 próprio");
assert.equal(previewDb.database_name, "agendas-pradosm-preview");
assert.equal(
  previewDb.database_id,
  "716cc88e-7da8-400e-b4be-edc4be0c9c03",
  "Preview deve usar exclusivamente o D1 isolado",
);
assert.notEqual(
  previewDb.database_id,
  productionDb?.database_id,
  "Preview nunca pode compartilhar o D1 de produção",
);

const previewLoginLimiter = wranglerConfig.previews?.ratelimits?.find(
  (binding) => binding.name === "LOGIN_RATE_LIMITER",
);
assert.ok(previewLoginLimiter, "Preview deve ter rate limit próprio");
assert.equal(previewLoginLimiter.namespace_id, "2026100101");
assert.notEqual(
  previewLoginLimiter.namespace_id,
  loginLimiter.namespace_id,
  "Preview nunca pode compartilhar o namespace de rate limit da produção",
);
assert.deepEqual(previewLoginLimiter.simple, { limit: 10, period: 60 });
assert.equal(
  wranglerConfig.previews?.vars?.REALTIME_MODE,
  "off",
  "Preview deve manter realtime desligado por padrão",
);
assert.deepEqual(
  wranglerConfig.previews?.durable_objects?.bindings,
  [{ name: "REALTIME_HUB", class_name: "RealtimeHub" }],
  "Preview deve declarar o binding do Durable Object para evitar erro 1101",
);
assert.equal(
  wranglerConfig.previews?.triggers,
  undefined,
  "Preview não deve declarar cron de produção",
);

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

const indexHtml = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);
assert.ok(
  indexHtml.includes('<script src="/theme-bootstrap.js"></script>'),
  "index.html deve carregar o bootstrap de tema como script same-origin",
);
assert.ok(
  !indexHtml.includes('localStorage.getItem("theme")'),
  "bootstrap de tema não pode permanecer inline no index.html",
);
assert.equal(
  existsSync(new URL("../public/theme-bootstrap.js", import.meta.url)),
  true,
  "bootstrap de tema externo deve existir em public/theme-bootstrap.js",
);

const headersPath = new URL("../public/_headers", import.meta.url);
assert.equal(
  existsSync(headersPath),
  true,
  "assets estáticos devem declarar headers defensivos",
);
const staticHeaders = readFileSync(headersPath, "utf8");
assert.ok(
  !staticHeaders.includes("script-src 'self' 'unsafe-inline'"),
  "CSP não deve liberar unsafe-inline para scripts",
);
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
