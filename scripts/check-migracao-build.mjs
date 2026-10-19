import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(".");
const dist = join(root, "dist");
const read = file => readFileSync(join(dist, file), "utf8");
const required = [
  "index.html", "frontend/entry.js", "frontend/application.js",
  "frontend/pages.js", "frontend/today.js",
  "frontend/dashboard.js", "frontend/users.js",
  "frontend/stores.js", "frontend/history.js",
  "frontend/import-agenda.js", "frontend/admin-agenda-preview.js",
  "frontend/agenda/exportAgendaPdf.js", "frontend/import/extractPdfText.js",
  "frontend/import/parseAgendaBatch.js", "frontend/import/parseAgendaText.js",
  "frontend/styles/styles.css", "frontend/styles/store-desktop.css", "frontend/styles/corporate.css",
  "frontend/styles/cadastros-compactos.css", "frontend/styles/vendor-ui.css", "shared/time.js", "theme-bootstrap.js",
  "vendor/chart.umd.min.js", "vendor/lucide/layout-dashboard.svg", "vendor/lucide/chart-no-axes-column-increasing.svg",
  "vendor/lucide/store.svg", "vendor/lucide/users.svg", "vendor/lucide/clipboard-check.svg", "vendor/lucide/info.svg"
];
for (const file of required) {
  if (!existsSync(join(dist, file))) throw Error("Asset JS nativo não gerado: " + file);
}
const html = read("index.html");
if (!html.includes('src="/frontend/entry.js"')) throw Error("HTML sem entrada nativa.");
if (/main\.tsx|vite\/(?:client|assets)|react-dom/i.test(html))
  throw Error("O build ainda referencia React ou Vite.");
for (const file of ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"]) {
  if (!html.includes("/frontend/styles/" + file)) throw Error("CSS da main ausente: " + file);
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
const file = read("frontend/import/extractPdfText.js");
if (!file.includes('from "@llamaindex/liteparse-wasm"')) throw Error("Contrato de PDF mudou.");
if (!html.includes("/frontend/styles/vendor-ui.css")) throw Error("CSS dos ícones Lucide ausente.");
if (!read("frontend/report-chart.js").includes("/vendor/chart.umd.min.js"))
  throw Error("Gráfico Chart.js não aponta para recurso local.");
const chart = read("vendor/chart.umd.min.js");
if (!chart.includes("Chart.js")) throw Error("Artefato Chart.js inválido.");
console.log("Build de migração: HTML, JS, CSS, PDF WASM, Chart.js e Lucide locais.");