import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

const ITERATIONS = 600_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

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

const name = required("ADMIN_NAME");
const login = required("ADMIN_LOGIN");
const password = required("ADMIN_PASSWORD");

if (password.length < 12) {
  throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
}

const salt = randomBytes(SALT_BYTES);
const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, "sha256");
const encoded = [
  "pbkdf2_sha256",
  String(ITERATIONS),
  salt.toString("base64"),
  hash.toString("base64"),
].join("$");

const id = randomUUID();
const now = new Date().toISOString();

const sql = [
  "INSERT INTO usuarios",
  "(id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)",
  "VALUES",
  `(${sqlString(id)}, NULL, ${sqlString(name)}, ${sqlString(login)}, ${sqlString(encoded)}, 'admin', 1, ${sqlString(now)}, ${sqlString(now)})`,
  "ON CONFLICT(login) DO UPDATE SET",
  "loja_id = NULL,",
  "nome = excluded.nome,",
  "senha_hash = excluded.senha_hash,",
  "perfil = 'admin',",
  "ativo = 1,",
  "atualizado_em = excluded.atualizado_em;",
].join(" ");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(
  npx,
  [
    "wrangler",
    "d1",
    "execute",
    "agendas-prado",
    "--remote",
    "--command",
    sql,
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

console.log(`Administrador provisionado para o login "${login}".`);
