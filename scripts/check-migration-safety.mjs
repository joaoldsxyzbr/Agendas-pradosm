import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const CONTRACT_MIGRATION_BASELINE = 12;
export const CONTRACT_APPROVALS_FILE = "contract-approvals.json";

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

export function migrationDigest(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function isValidContractApproval(approval, migration) {
  if (!approval || typeof approval !== "object") return false;

  const approvedAt = Date.parse(approval.approvedAt ?? "");
  return (
    approval.fileName === migration.fileName &&
    approval.sha256 === migrationDigest(migration.sql) &&
    approval.operation === migration.operation &&
    typeof approval.issue === "string" &&
    /^#\d+$/.test(approval.issue) &&
    typeof approval.approvedBy === "string" &&
    approval.approvedBy.trim().length >= 2 &&
    Number.isFinite(approvedAt) &&
    typeof approval.reason === "string" &&
    approval.reason.trim().length >= 20
  );
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

export function loadContractApprovals(migrationsDir) {
  const approvalPath = join(migrationsDir, CONTRACT_APPROVALS_FILE);
  if (!existsSync(approvalPath)) return [];

  const parsed = JSON.parse(readFileSync(approvalPath, "utf8"));
  return Array.isArray(parsed?.approvals) ? parsed.approvals : [];
}

export function findUnapprovedUnsafeMigrations(migrationsDir) {
  const approvals = loadContractApprovals(migrationsDir);

  return findUnsafeMigrations(migrationsDir).filter(
    (migration) =>
      !approvals.some((approval) =>
        isValidContractApproval(approval, migration),
      ),
  );
}

function isMainModule() {
  const current = fileURLToPath(import.meta.url);
  return process.argv[1] ? current === process.argv[1] : false;
}

if (isMainModule()) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const migrationsDir = join(root, "migrations");
  const unsafe = findUnapprovedUnsafeMigrations(migrationsDir);

  if (unsafe.length > 0) {
    console.error(
      "Deploy bloqueado: migration destrutiva nova sem aprovação contract válida.",
    );
    for (const migration of unsafe) {
      console.error(
        `- ${migration.fileName}: ${migration.operation}; sha256=${migrationDigest(migration.sql)}`,
      );
    }
    console.error(
      "Para uma etapa contract previamente aprovada, registre no migrations/contract-approvals.json o arquivo, operação, SHA-256 exato, issue, responsável, data e justificativa. Qualquer alteração posterior no SQL invalida a aprovação.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Gate de migrations: nenhuma migration destrutiva não aprovada detectada.",
    );
  }
}
