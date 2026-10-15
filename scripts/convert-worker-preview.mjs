import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import ts from "typescript";

/**
 * Transforma os módulos atuais do Worker e da camada compartilhada em JavaScript
 * fonte. Não altera imports, lógica, schemas SQL nem D1.
 * Passo intermediário exclusivo da branch preview.
 */
const roots = ["worker", "shared"];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    if (extname(path) !== ".ts" || path.endsWith(".d.ts")) continue;

    const source = readFileSync(path, "utf8");
    const result = ts.transpileModule(source, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
      },
    });
    const failures = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (failures.length) {
      throw new Error(path + ": " + failures.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("; "));
    }
    const target = path.replace(/\.ts$/, ".js");
    writeFileSync(target, result.outputText, "utf8");
    console.log(path + " → " + target);
  }
}

for (const root of roots) walk(root);
