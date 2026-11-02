import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// A Preview publica o React na raiz desde a remoção da UI legada (31/10/2026).
// Este script segue existindo como validador pós-build para os pipelines que o invocam.
const dist = join("dist");
if (!existsSync(join(dist, "index.html")))
  throw Error("dist/index.html ausente: rode npm run build primeiro.");
const html = readFileSync(join(dist, "index.html"), "utf8");
if (!html.includes('src="/assets/'))
  throw Error("index.html publicado não aponta para o bundle React na raiz.");
const assets = readdirSync(join(dist, "assets"));
if (assets.length === 0) throw Error("Assets React ausentes do dist.");
console.log("Preview pronta: React na raiz; /modern/ e rotas antigas caem no app pelo fallback SPA.");
