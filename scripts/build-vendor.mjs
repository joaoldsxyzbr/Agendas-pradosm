// Recursos estáticos de bibliotecas com versões fixas, copiados após npm ci.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const at = path => new URL("../" + path, import.meta.url);
for (const [pkg, version] of [["chart.js","4.5.1"],["lucide-static","1.57.0"]]) {
  const found = JSON.parse(readFileSync(at(`node_modules/${pkg}/package.json`), "utf8")).version;
  if (found !== version) throw Error(`Versão incorreta: ${pkg} (${found})`);
}
mkdirSync(at("public/vanilla/vendor/lucide"), { recursive: true });
const chart = at("node_modules/chart.js/dist/chart.umd.min.js");
if (!existsSync(chart)) throw Error("Distribuição local Chart.js ausente.");
copyFileSync(chart, at("public/vanilla/vendor/chart.umd.min.js"));
for (const name of ["layout-dashboard","chart-no-axes-column-increasing","clipboard-check","store","users"]) {
  const from = at(`node_modules/lucide-static/icons/${name}.svg`);
  if (!existsSync(from)) throw Error(`Ícone Lucide ausente: ${name}`);
  copyFileSync(from, at(`public/vanilla/vendor/lucide/${name}.svg`));
}
for (const [pkg,file,target] of [["chart.js","LICENSE.md","LICENSE-chartjs.txt"],["lucide-static","LICENSE","LICENSE-lucide.txt"]]) {
  const from = at(`node_modules/${pkg}/${file}`);
  if (existsSync(from)) copyFileSync(from, at(`public/vanilla/vendor/${target}`));
}
console.log("Chart.js e cinco SVGs Lucide preparados localmente.");
