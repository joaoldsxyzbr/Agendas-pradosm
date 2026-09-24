import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const name = process.env.ADMIN_NAME?.trim();
const login = process.env.ADMIN_LOGIN?.trim();
const password = process.env.ADMIN_PASSWORD;

if (!name || !login || !password) {
  throw new Error("Defina ADMIN_NAME, ADMIN_LOGIN e ADMIN_PASSWORD.");
}
if (password.length < 8) {
  throw new Error("ADMIN_PASSWORD deve ter pelo menos 8 caracteres.");
}

function sqlText(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

const existingRaw = execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "agendas-prado",
    "--remote",
    "--command",
    `SELECT COUNT(*) AS total FROM usuarios WHERE login = ${sqlText(login)}`,
    "--json",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const parsed = JSON.parse(existingRaw);
const total = Number(parsed?.[0]?.results?.[0]?.total ?? 0);
if (total > 0) {
  throw new Error("Já existe um usuário com esse login.");
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 600_000, 32, "sha256");
const encoded = `pbkdf2_sha256$600000$${salt.toString("base64")}$${hash.toString("base64")}`;
const now = new Date().toISOString();
const id = randomUUID();

mkdirSync(".tmp", { recursive: true });
const file = join(".tmp", "bootstrap-admin.sql");

const sql = `INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)
VALUES (${sqlText(id)}, NULL, ${sqlText(name)}, ${sqlText(login)}, ${sqlText(encoded)}, 'admin', 1, ${sqlText(now)}, ${sqlText(now)});`;

try {
  writeFileSync(file, sql, { encoding: "utf8", mode: 0o600 });
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "agendas-prado", "--remote", `--file=${file}`],
    { stdio: "inherit" },
  );
  console.log("Administrador criado com sucesso.");
} finally {
  rmSync(file, { force: true });
}
