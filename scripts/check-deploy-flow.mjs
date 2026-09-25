import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);

assert.ok(workflow.includes("workflow_run:"), "deploy deve aguardar o CI");
assert.ok(
  workflow.includes('workflows: ["CI"]'),
  "deploy deve depender do workflow CI",
);
assert.ok(
  workflow.includes("types: [completed]"),
  "deploy deve iniciar apenas quando o CI terminar",
);
assert.ok(
  workflow.includes("branches: [main]"),
  "deploy automático deve aceitar somente main",
);
assert.ok(
  workflow.includes("github.event.workflow_run.conclusion == 'success'"),
  "deploy deve bloquear CI vermelho",
);
assert.ok(
  workflow.includes("github.event.workflow_run.head_sha"),
  "deploy deve publicar o mesmo SHA validado pelo CI",
);
assert.ok(
  workflow.includes("cancel-in-progress: false"),
  "deploys não devem cancelar migrations em andamento",
);

const migration = workflow.indexOf("Apply remote D1 migrations");
const deployStep = workflow.indexOf("Deploy Worker");
const health = workflow.indexOf("Health check");

assert.ok(
  migration >= 0 && deployStep > migration,
  "migration D1 deve ocorrer antes do deploy",
);
assert.ok(health > deployStep, "health-check deve ocorrer depois do deploy");
assert.ok(
  workflow.includes("https://agendaspradosm.joaolds.xyz.br/api/health"),
  "health-check deve validar produção",
);

console.log("Fluxo de deploy validado.");
