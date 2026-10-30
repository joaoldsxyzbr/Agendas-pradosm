import { spawnSync } from "node:child_process";
import { cp, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const modernBuild = join(root, "dist-modern");
const modernAssets = join(dist, "modern");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args, env = process.env) {
  const result = spawnSync(npm, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falha no comando npm ${args.join(" ")} (${result.status ?? "sem status"})`);
}

// A interface antiga deve existir e continuar como entrada da Preview.
await stat(join(dist, "index.html"));
await stat(join(root, "apps", "web", "package-lock.json"));

// Build reproduzível; não instala dependências React no pacote do Worker.
run(["ci", "--prefix", "apps/web"]);
run(["run", "build", "--prefix", "apps/web"], { ...process.env, MODERN_PREVIEW: "1" });

const built = await readFile(join(modernBuild, "index.html"), "utf8");
if (!built.includes("/modern/assets/") || built.includes('src="/src/'))
  throw new Error("Bundle React sem prefixo /modern/ ou com entrada de desenvolvimento.");
if ((await readdir(join(modernBuild, "assets"))).length === 0)
  throw new Error("Assets React ausentes do build.");

await cp(modernBuild, modernAssets, { recursive: true, force: true });
const published = await readFile(join(modernAssets, "index.html"), "utf8");
if (published !== built) throw new Error("O HTML React não foi copiado corretamente.");
console.log("Preview pronta: legado em /login, React isolado em /modern/index.html#/login.");
