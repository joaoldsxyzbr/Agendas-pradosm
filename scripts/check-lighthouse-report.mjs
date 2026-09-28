import { readFileSync } from "node:fs";

const reportPath = process.argv[2];

if (!reportPath) {
  console.error("Informe o caminho do relatório Lighthouse JSON.");
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const accessibility = report.categories?.accessibility;
const score = accessibility?.score;

if (typeof score !== "number") {
  console.error("Relatório Lighthouse sem categoria de acessibilidade.");
  process.exit(1);
}

if (score < 1) {
  const failures = Object.values(report.audits ?? {})
    .filter(
      (audit) =>
        audit &&
        typeof audit === "object" &&
        audit.scoreDisplayMode !== "notApplicable" &&
        audit.score !== null &&
        typeof audit.score === "number" &&
        audit.score < 1,
    )
    .map((audit) => `- ${audit.id}: ${audit.title}`);

  console.error(
    `Acessibilidade Lighthouse abaixo de 100%: ${Math.round(score * 100)}%.`,
  );
  if (failures.length > 0) {
    console.error(failures.join("\n"));
  }
  process.exit(1);
}

console.log("Acessibilidade Lighthouse: 100%.");
