import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(".");
const dist = join(root, "dist");
const read = file => readFileSync(join(dist, file), "utf8");
const required = [
  "index.html", "migration/frontend/entry.js", "migration/frontend/application.js",
  "migration/frontend/pages.js", "migration/frontend/today.js",
  "migration/frontend/dashboard.js", "migration/frontend/users.js",
  "migration/frontend/stores.js", "migration/frontend/history.js",
  "migration/frontend/import-agenda.js", "migration/frontend/admin-agenda-preview.js",
  "src/agenda/exportAgendaPdf.js", "src/import/extractPdfText.js",
  "src/import/parseAgendaBatch.js", "src/import/parseAgendaText.js",
  "src/styles.css", "src/store-desktop.css", "src/corporate.css",
  "src/cadastros-compactos.css", "src/vendor-ui.css", "shared/time.js", "theme-bootstrap.js",
  "vendor/chart.umd.min.js", "vendor/lucide/layout-dashboard.svg", "vendor/lucide/chart-no-axes-column-increasing.svg",
  "vendor/lucide/store.svg", "vendor/lucide/users.svg", "vendor/lucide/clipboard-check.svg", "vendor/lucide/info.svg"
];
for (const file of required) {
  if (!existsSync(join(dist, file))) throw Error("Asset JS nativo não gerado: " + file);
}
const html = read("index.html");
if (!html.includes('src="/migration/frontend/entry.js"')) throw Error("HTML sem entrada nativa.");
if (/main\.tsx|vite\/(?:client|assets)|react-dom/i.test(html))
  throw Error("O build ainda referencia React ou Vite.");
for (const file of ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"]) {
  if (!html.includes("/src/" + file)) throw Error("CSS da main ausente: " + file);
}
const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!mapMatch) throw Error("Mapa ESM da biblioteca PDF ausente.");
const map = JSON.parse(mapMatch[1]);
const pdf = map.imports?.["@llamaindex/liteparse-wasm"];
if (!pdf || !pdf.startsWith("/vendor/liteparse/")) throw Error("Caminho PDF WASM inválido.");
if (!existsSync(join(dist, pdf))) throw Error("Biblioteca PDF não foi copiada.");
const expectedHash = createHash("sha256").update(mapMatch[1], "utf8").digest("base64");
const policy = read("_headers");
if (!policy.includes("'sha256-" + expectedHash + "'"))
  throw Error("Importmap PDF foi bloqueado pela política CSP.");
const file = read("src/import/extractPdfText.js");
if (!file.includes('from "@llamaindex/liteparse-wasm"')) throw Error("Contrato de PDF mudou.");
if (!html.includes("/src/vendor-ui.css")) throw Error("CSS dos ícones Lucide ausente.");
if (!read("migration/frontend/report-chart.js").includes("/vendor/chart.umd.min.js"))
  throw Error("Gráfico Chart.js não aponta para recurso local.");
const chart = read("vendor/chart.umd.min.js");
if (!chart.includes("Chart.js")) throw Error("Artefato Chart.js inválido.");
console.log("Build de migração: HTML, JS, CSS, PDF WASM, Chart.js e Lucide locais.");