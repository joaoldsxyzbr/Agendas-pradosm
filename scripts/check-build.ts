import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const read = file => readFileSync(join(dist, file), "utf8");

if (!existsSync(join(dist, "index.html"))) throw Error("index.html do React ausente do dist.");
const html = read("index.html");
if (!html.includes('src="/assets/')) throw Error("HTML publicado não aponta para o bundle React.");
if (html.includes("/modern/") || html.includes("/frontend/"))
  throw Error("HTML publicado ainda referencia o prefixo /modern/ ou a UI legada.");
const assets = readdirSync(join(dist, "assets"));
const bundles = assets.filter(name => name.endsWith(".js"));
if (bundles.length === 0) throw Error("Bundle JS do React ausente.");
const bundle = bundles.map(name => read(join("assets", name))).join("\n");
for (const needle of ["Fornecedor sem agenda", "Exportar PDF", "Detalhes do agendamento", "Registros de auditoria"]) {
  if (!bundle.includes(needle)) throw Error("Funcionalidade ausente do bundle: " + needle);
}
const security = read("_headers");
if (!security.includes("script-src 'self' 'wasm-unsafe-eval';"))
  throw Error("CSP de produção diferente. Revisão de segurança necessária.");
if (existsSync(join(dist, "frontend")) || existsSync(join(dist, "vendor")))
  throw Error("Artefatos da UI legada não devem mais existir no dist.");
console.log("Integridade do build React validada: raiz sem legado, CSP e bundle completos.");
