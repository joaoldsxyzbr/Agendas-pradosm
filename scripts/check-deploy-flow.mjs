import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const deploy = packageJson.scripts?.deploy ?? "";

assert.ok(deploy.includes("npm run build"), "deploy deve buildar antes de publicar");
assert.ok(
  deploy.includes("wrangler d1 migrations apply agendas-prado --remote"),
  "deploy nativo deve aplicar migrations D1 remotas",
);
assert.ok(
  deploy.includes("wrangler deploy"),
  "deploy nativo deve publicar o Worker com Wrangler",
);

const buildIndex = deploy.indexOf("npm run build");
const migrationIndex = deploy.indexOf(
  "wrangler d1 migrations apply agendas-prado --remote",
);
const deployIndex = deploy.lastIndexOf("wrangler deploy");

assert.ok(
  buildIndex >= 0 && migrationIndex > buildIndex,
  "migration D1 deve ocorrer depois do build",
);
assert.ok(
  deployIndex > migrationIndex,
  "Worker só pode ser publicado depois da migration D1",
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
  !ci.includes("CLOUDFLARE_API_TOKEN"),
  "CI não deve depender de credenciais Cloudflare",
);

console.log("Fluxo nativo Cloudflare validado.");
