import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const base = fileURLToPath(new URL("../", import.meta.url));
const output = join(base, "dist");
const web = join(base, "apps", "web");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args, cwd) {
  const result = spawnSync(npm, args, { cwd, env: process.env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw Error("Falha no comando npm " + args.join(" "));
}

// A UI React tem dependências próprias, separadas do pacote do Worker.
if (!existsSync(join(web, "node_modules")) || !existsSync(join(web, "package-lock.json"))) {
  run(["ci"], web);
}

// Build reproduzível do React (Vite + TypeScript estrito) para dist-modern.
run(["run", "build"], web);

const modern = join(base, "dist-modern");
const index = await readFile(join(modern, "index.html"), "utf8");
if (!index.includes('src="/assets/') || index.includes('src="/src/'))
  throw Error("Bundle React com entrada inesperada ou modo de desenvolvimento.");
const assets = await readdir(join(modern, "assets"));
if (assets.length === 0) throw Error("Assets React ausentes do build.");

// dist/ publica o React na raiz; o fallback SPA do Workers atende os links diretos.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(base, "public"), output, { recursive: true });
await cp(modern, output, { recursive: true });

const security = await readFile(join(output, "_headers"), "utf8");
if (!security.includes("script-src 'self' 'wasm-unsafe-eval';"))
  throw Error("CSP de produção diferente. Revisão de segurança necessária.");
console.log("Build da UI React: index.html + " + assets.length + " assets publicados na raiz de dist/.");
