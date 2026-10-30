import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(".");
const dist = join(root, "dist");
const read = file => readFileSync(join(dist, file), "utf8");
const required = [
  "index.html", "frontend/entry.js", "frontend/application.js",
  "frontend/pages.js", "frontend/today.js",
  "frontend/diagnostic-client.js", "frontend/diagnostics.js", "frontend/pages/diagnostics/style.css",
  "frontend/dashboard.js", "frontend/users.js",
  "frontend/stores.js", "frontend/history.js",
  "frontend/import-agenda.js", "frontend/admin-agenda-preview.js",
  "frontend/agenda/exportAgendaPdf.js", "frontend/import/extractPdfText.js",
  "frontend/import/pdf-engine-liteparse.js",
  "frontend/import/parseAgendaBatch.js", "frontend/import/parseAgendaText.js",
  "frontend/styles/styles.css", "frontend/styles/store-desktop.css", "frontend/styles/corporate.css",
  "frontend/pages/cadastros/compact.css", "frontend/pages/cadastros/vendor.css", "shared/time.js", "theme-bootstrap.js",
  "vendor/chart.umd.min.js", "vendor/lucide/layout-dashboard.svg", "vendor/lucide/chart-no-axes-column-increasing.svg",
  "vendor/lucide/store.svg", "vendor/lucide/users.svg", "vendor/lucide/clipboard-check.svg", "vendor/lucide/info.svg"
];
for (const file of required) {
  if (!existsSync(join(dist, file))) throw Error("Asset JS nativo não gerado: " + file);
}
const html = read("index.html");
// Verifica os assets CSS reais após a migração por tela.
const stylesheetPaths = [...html.matchAll(/<link\\s+[^>]*rel="stylesheet"[^>]*href="(\\/frontend\\/[^"]+\\.css)"/g)]
  .map(match => match[1].slice(1));
if (stylesheetPaths.length === 0) throw Error("Nenhuma folha CSS encontrada no HTML.");
if (new Set(stylesheetPaths).size !== stylesheetPaths.length) throw Error("Folha CSS duplicada no HTML.");
for (const stylesheet of stylesheetPaths) {
  if (!existsSync(join(dist, stylesheet))) throw Error("Folha CSS ausente no build: " + stylesheet);
}

if (!html.includes('src="/frontend/entry.js"')) throw Error("HTML sem entrada nativa.");
if (/main\.tsx|vite\/(?:client|assets)|react-dom/i.test(html))
  throw Error("O build ainda referencia React ou Vite.");
for (const file of ["styles/styles.css", "styles/store-desktop.css", "styles/corporate.css", "pages/cadastros/compact.css"]) {
  if (!html.includes("/frontend/" + file)) throw Error("CSS obrigatório ausente: " + file);
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
const engine = read("frontend/import/pdf-engine-liteparse.js");
if (!engine.includes('from "@llamaindex/liteparse-wasm"')) throw Error("Contrato de PDF mudou.");
const facade = read("frontend/import/extractPdfText.js");
if (facade.includes("@llamaindex")) throw Error("A fachada de PDF não pode referenciar o motor WASM diretamente.");
if (!html.includes("/frontend/pages/cadastros/vendor.css")) throw Error("CSS dos ícones Lucide ausente.");
if (!read("frontend/report-chart.js").includes("/vendor/chart.umd.min.js"))
  throw Error("Gráfico Chart.js não aponta para recurso local.");
const chart = read("vendor/chart.umd.min.js");
if (!chart.includes("Chart.js")) throw Error("Artefato Chart.js inválido.");
console.log("Build de produção: HTML, JS, CSS, PDF WASM, Chart.js e Lucide locais.");