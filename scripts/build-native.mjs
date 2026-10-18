import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const base = fileURLToPath(new URL("../", import.meta.url));
const output = join(base, "dist");
const from = file => join(base, file);
const to = file => join(output, file);

async function copy(source, destination) {
  if (!existsSync(from(source))) throw Error("Fonte JS ausente: " + source);
  await mkdir(dirname(to(destination)), { recursive: true });
  await cp(from(source), to(destination), { recursive: true, force: true });
}

function browserEntry(pkg) {
  const find = node => {
    if (typeof node === "string") return node;
    if (node && typeof node === "object") {
      for (const key of ["browser", "import", "default"]) {
        const result = find(node[key]);
        if (result) return result;
      }
    }
    return null;
  };
  return find(pkg.exports?.["."] ?? pkg.exports) ??
    (typeof pkg.module === "string" ? pkg.module : null) ??
    (typeof pkg.browser === "string" ? pkg.browser : null);
}
async function pdfImportMap() {
  const packageName = "@llamaindex/liteparse-wasm";
  const folder = from("node_modules/" + packageName);
  const meta = join(folder, "package.json");
  if (!existsSync(meta)) throw Error("Instale as dependências com npm ci antes do build.");
  const pkg = JSON.parse(await readFile(meta, "utf8"));
  const entry = browserEntry(pkg);
  if (!entry || !entry.startsWith("./") || !existsSync(resolve(folder, entry)))
    throw Error("Pacote PDF sem entrada ES Module para navegador.");
  await mkdir(to("vendor"), { recursive: true });
  await cp(folder, to("vendor/liteparse"), { recursive: true });
  return { imports: {
    [packageName]: "/vendor/liteparse/" + entry.replace(/^\.\//, ""),
    [packageName + "/"]: "/vendor/liteparse/"
  } };
}

async function verifyImports(dir) {
  let checked = 0;
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      if (path !== to("vendor")) checked += await verifyImports(path);
      continue;
    }
    if (!file.name.endsWith(".js") && !file.name.endsWith(".mjs")) continue;
    checked++;
    const content = await readFile(path, "utf8");
    for (const match of content.matchAll(/\bfrom\s+["'](\.\.?\/[^"']+)["']/g)) {
      const imported = resolve(dirname(path), match[1]);
      if (!imported.startsWith(output + "/") || !existsSync(imported))
        throw Error("Import inválido: " + relative(output, path) + " -> " + match[1]);
    }
  }
  return checked;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copy("public", "");
await copy("migration/frontend", "migration/frontend");
for (const file of [
  "src/agenda/exportAgendaPdf.js", "src/import/extractPdfText.js",
  "src/import/parseAgendaBatch.js", "src/import/parseAgendaText.js"
]) await copy(file, file);
for (const file of ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"])
  await copy("src/" + file, "src/" + file);
for (const name of ["agenda", "api", "auth", "realtime", "store", "time"])
  await copy("shared/" + name + ".js", "shared/" + name + ".js");

const importMap = await pdfImportMap();
const html = await readFile(from("index.html"), "utf8");
const originalEntry = '<script type="module" src="/src/main.tsx"></script>';
if (!html.includes(originalEntry)) throw Error("index.html original mudou. Revisar entrada manualmente.");
const css = ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"]
  .map(name => '<link rel="stylesheet" href="/src/' + name + '">').join("\n    ");
const mapJson = JSON.stringify(importMap);
const mapHash = createHash("sha256").update(mapJson, "utf8").digest("base64");
const scripts = '<script type="importmap">' + mapJson + '</script>\n' +
  '    <script type="module" src="/migration/frontend/entry.js"></script>';
const nativeHtml = html.replace("</head>", "    " + css + "\n  </head>")
  .replace(originalEntry, scripts);
if (nativeHtml.includes(originalEntry)) throw Error("O React continuou como entrypoint.");
await writeFile(to("index.html"), nativeHtml, "utf8");
const security = await readFile(to("_headers"), "utf8");
const needle = "script-src 'self' 'wasm-unsafe-eval';";
if (!security.includes(needle)) throw Error("CSP de produção diferente. Revisão de segurança necessária.");
const updatedSecurity = security.replace(needle,
  "script-src 'self' 'wasm-unsafe-eval' 'sha256-" + mapHash + "';");
await writeFile(to("_headers"), updatedSecurity, "utf8");
const count = await verifyImports(output);
console.log("Build nativo: " + count + " módulos JS conferidos, CSS original e PDF WASM.");