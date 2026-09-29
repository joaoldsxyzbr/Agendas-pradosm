import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./bootstrap-admin.mjs", import.meta.url),
  "utf8",
);

assert.ok(
  !source.includes("ON CONFLICT"),
  "bootstrap de emergencia nao pode promover, reativar ou redefinir conta existente por upsert",
);
assert.ok(
  source.includes("papel = 'admin'") &&
    source.includes("ativo = 1") &&
    source.includes("excluido_em IS NULL"),
  "bootstrap deve verificar se ja existe administrador ativo",
);
assert.ok(
  source.includes("admin_provisionado_emergencia"),
  "bootstrap deve registrar auditoria explicita",
);
assert.ok(
  source.includes("auditoria"),
  "bootstrap deve verificar o registro de auditoria antes de concluir",
);

console.log("Bootstrap administrativo de emergencia validado.");
