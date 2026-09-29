import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

const ITERATIONS = 100_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const DATABASE_NAME = "agendas-prado";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Defina ${name} no ambiente antes de executar o bootstrap.`);
  }
  return value;
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function executeRemote(sql, captureOutput = false) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";

  return execFileSync(
    npx,
    [
      "wrangler",
      "d1",
      "execute",
      DATABASE_NAME,
      "--remote",
      "--command",
      sql,
    ],
    {
      encoding: captureOutput ? "utf8" : undefined,
      stdio: captureOutput ? ["inherit", "pipe", "inherit"] : "inherit",
      env: process.env,
    },
  );
}

function requireRemoteMarker(sql, failureMessage) {
  const marker = "BOOTSTRAP_OK";
  const output = executeRemote(sql, true);
  if (typeof output !== "string" || !output.includes(marker)) {
    throw new Error(failureMessage);
  }
}

const name = required("ADMIN_NAME");
const login = required("ADMIN_LOGIN");
const password = required("ADMIN_PASSWORD");

if (password.length < 12) {
  throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
}

const escapedLogin = sqlString(login);

const preflightSql = [
  "SELECT 'BOOTSTRAP_OK' AS resultado",
  "WHERE NOT EXISTS (",
  "SELECT 1 FROM usuarios",
  "WHERE papel = 'admin' AND ativo = 1 AND excluido_em IS NULL",
  ")",
  "AND NOT EXISTS (",
  `SELECT 1 FROM usuarios WHERE login = ${escapedLogin} COLLATE NOCASE`,
  ");",
].join(" ");

requireRemoteMarker(
  preflightSql,
  "Bootstrap bloqueado: já existe administrador ativo ou o login informado já existe.",
);

const salt = randomBytes(SALT_BYTES);
const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, "sha256");
const encoded = [
  "pbkdf2_sha256",
  String(ITERATIONS),
  salt.toString("base64"),
  hash.toString("base64"),
].join("$");

const id = randomUUID();
const auditId = randomUUID();
const now = new Date().toISOString();
const auditAfter = JSON.stringify({
  nome: name,
  login,
  papel: "admin",
  ativo: true,
});

const createSql = [
  "INSERT INTO usuarios",
  "(id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em)",
  "SELECT",
  `${sqlString(id)}, NULL, ${sqlString(name)}, ${escapedLogin}, ${sqlString(encoded)}, 'admin', 1, ${sqlString(now)}, ${sqlString(now)}`,
  "WHERE NOT EXISTS (",
  "SELECT 1 FROM usuarios",
  "WHERE papel = 'admin' AND ativo = 1 AND excluido_em IS NULL",
  ")",
  "AND NOT EXISTS (",
  `SELECT 1 FROM usuarios WHERE login = ${escapedLogin} COLLATE NOCASE`,
  ");",
  "INSERT INTO auditoria",
  "(id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id, agendamento_id, antes, depois, detalhes, criado_em)",
  "SELECT",
  `${sqlString(auditId)}, NULL, 'admin_provisionado_emergencia', 'usuario', ${sqlString(id)}, NULL, NULL, NULL, NULL, ${sqlString(auditAfter)}, 'Provisionamento administrativo break-glass.', ${sqlString(now)}`,
  "WHERE EXISTS (",
  `SELECT 1 FROM usuarios WHERE id = ${sqlString(id)} AND papel = 'admin' AND ativo = 1 AND excluido_em IS NULL`,
  ");",
].join(" ");

executeRemote(createSql);

const verifySql = [
  "SELECT 'BOOTSTRAP_OK' AS resultado",
  "WHERE EXISTS (",
  `SELECT 1 FROM usuarios WHERE id = ${sqlString(id)} AND papel = 'admin' AND ativo = 1 AND excluido_em IS NULL`,
  ")",
  "AND EXISTS (",
  `SELECT 1 FROM auditoria WHERE id = ${sqlString(auditId)} AND acao = 'admin_provisionado_emergencia' AND entidade = 'usuario' AND entidade_id = ${sqlString(id)}`,
  ");",
].join(" ");

requireRemoteMarker(
  verifySql,
  "Bootstrap incompleto: usuário ou auditoria não foram confirmados. Revise o D1 antes de repetir.",
);

console.log(
  `Administrador de emergencia provisionado e auditado para o login "${login}".`,
);
