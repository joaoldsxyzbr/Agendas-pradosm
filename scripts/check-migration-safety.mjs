import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const CONTRACT_MIGRATION_BASELINE = 12;

const DESTRUCTIVE_PATTERNS = [
  { label: "DROP", pattern: /\bDROP\s+(?:TABLE|INDEX|TRIGGER|VIEW)\b/i },
  { label: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/i },
  { label: "ALTER TABLE DROP", pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\b/i },
  { label: "ALTER TABLE RENAME", pattern: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\b/i },
];

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
}

export function destructiveOperation(sql) {
  const normalized = stripSqlComments(sql);
  return DESTRUCTIVE_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.label ?? null;
}

export function migrationNumber(fileName) {
  const match = /^(\d+)_.*\.sql$/i.exec(fileName);
  return match ? Number(match[1]) : null;
}

export function findUnsafeMigrations(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => ({
      fileName,
      number: migrationNumber(fileName),
      sql: readFileSync(join(migrationsDir, fileName), "utf8"),
    }))
    .filter(({ number }) => number !== null && number > CONTRACT_MIGRATION_BASELINE)
    .map((migration) => ({
      ...migration,
      operation: destructiveOperation(migration.sql),
    }))
    .filter(({ operation }) => operation !== null);
}

function isMainModule() {
  const current = fileURLToPath(import.meta.url);
  return process.argv[1] ? current === process.argv[1] : false;
}

if (isMainModule()) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const unsafe = findUnsafeMigrations(join(root, "migrations"));

  if (unsafe.length > 0) {
    console.error("Deploy bloqueado: migration destrutiva nova detectada.");
    for (const migration of unsafe) {
      console.error(`- ${migration.fileName}: ${migration.operation}`);
    }
    console.error(
      "Use uma release expand/contract: publique primeiro código compatível com ambos os schemas e remova estruturas antigas em uma release posterior.",
    );
    process.exitCode = 1;
  } else {
    console.log("Gate de migrations: nenhuma migration destrutiva nova detectada.");
  }
}
