import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const base = resolve(".");
const read = path => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content, "utf8");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const branch = git("branch", "--show-current");
if (branch !== "migracao-js-puro") throw Error("Finalização autorizada apenas em migracao-js-puro.");
if (!existsSync("worker/index.js") || !existsSync("migration/frontend/entry.js")) throw Error("Entradas JS nativas ausentes.");
if (!existsSync("worker/index.ts") || !existsSync("src/main.tsx")) throw Error("Baseline TS indisponível; finalização já efetuada?");

function assertReplace(original, before, after, path) {
  if (!original.includes(before)) throw Error("Contrato diferente em " + path + ": " + before);
  return original.replace(before, after);
}
function patterns(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[0]);
}
const code = path => read(path);
const baseline = {
  version: 1,
  source: "Contratos da main preservados antes da remoção definitiva de TypeScript",
  agenda: Object.fromEntries(["admin-agendas", "store-agendas"].map(name => [
    name, patterns(code("worker/routes/" + name + ".ts"), /\.(?:get|post|put|patch|delete)\(\s*["'](\/[^"']+)["']/g)
  ])),
  app: patterns(code("worker/app.ts"), /app\.(?:get|use|route)\(\s*["']([^"']+)["']/g),
  auth: [...code("worker/routes/auth.ts").matchAll(/authRoutes\.(get|post|patch|delete)\(\s*"([^"]+)"/g)]
    .map(hit => [hit[1], hit[2]]),
  routes: Object.fromEntries(["admin-audit", "admin-stores", "admin-users", "presence", "realtime"].map(name => [
    name, patterns(code("worker/routes/" + name + ".ts"), /\b(?:get|post|patch|put|delete)\(\s*["'](\/[^"']+)["']/g)
  ]))
};
write("tests/migration/legacy-route-contracts.json", JSON.stringify(baseline, null, 2) + "\n");

const testPatches = [
  ["tests/migration/agenda-routes-parity.test.js", [
    ['const ts = load("../../worker/routes/" + name + ".ts");',
     'const expected = JSON.parse(load("./legacy-route-contracts.json")).agenda[name];'],
    ["assert.deepEqual(endpoints(js), endpoints(ts));", "assert.deepEqual(endpoints(js), expected);"]
  ]],
  ["tests/migration/app-contract.test.js", [
    ['const ts = source("../../worker/app.ts");',
     'const expected = JSON.parse(source("./legacy-route-contracts.json")).app;'],
    ["assert.deepEqual(paths(js), paths(ts));", "assert.deepEqual(paths(js), expected);"]
  ]],
  ["tests/migration/auth-contract.test.js", [
    ['const ts = read("../../worker/routes/auth.ts");',
     'const expected = JSON.parse(read("./legacy-route-contracts.json")).auth;'],
    ["assert.deepEqual(routes(js), routes(ts));", "assert.deepEqual(routes(js), expected);"]
  ]],
  ["tests/migration/routes-parity.test.js", [
    ['assert.deepEqual(routePatterns(load(root + ".js")), routePatterns(load(root + ".ts")));',
     'assert.deepEqual(routePatterns(load(root + ".js")), JSON.parse(load("./legacy-route-contracts.json")).routes[path]);']
  ]],
  ["tests/migration/native-build.test.js", [
    ['assert.match(read("../../index.html"), /main\\.tsx/);',
     'assert.match(read("../../index.html"), /migration\\/frontend\\/entry\\.js/);']
  ]]
];
for (const [path, patches] of testPatches) {
  let s = read(path);
  for (const [before, after] of patches) s = assertReplace(s, before, after, path);
  write(path, s);
}

const htmlPath = "index.html";
let html = read(htmlPath);
html = assertReplace(html,
  '<script type="module" src="/src/main.tsx"></script>',
  '<script type="module" src="/migration/frontend/entry.js"></script>', htmlPath);
const css = ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"];
html = assertReplace(html, "</head>",
  css.map(f => '    <link rel="stylesheet" href="/src/' + f + '" />').join("\n") +
  "\n  </head>", htmlPath);
write(htmlPath, html);

const native = "scripts/build-native.mjs";
let build = read(native);
const pre = [
  'const originalEntry = \'<script type="module" src="/src/main.tsx"></script>\';',
  'if (!html.includes(originalEntry)) throw Error("index.html original mudou. Revisar entrada manualmente.");'
].join("\n");
build = assertReplace(build, pre,
  'const originalEntry = \'<script type="module" src="/migration/frontend/entry.js"></script>\';\n' +
  'if (!html.includes(originalEntry)) throw Error("Entrada JS nativa não localizada.");', native);
const cssBefore = [
  'const css = ["styles.css", "store-desktop.css", "corporate.css", "cadastros-compactos.css"]',
  '  .map(name => \'<link rel="stylesheet" href="/src/\' + name + \'">\').join("\\n    ");'
].join("\n");
build = assertReplace(build, cssBefore, '// CSS da main já está ligado no index.html nativo.', native);
build = assertReplace(build,
  'const nativeHtml = html.replace("</head>", "    " + css + "\\n  </head>")\n  .replace(originalEntry, scripts);',
  'const nativeHtml = html.replace(originalEntry, scripts);', native);
build = assertReplace(build,
  'if (nativeHtml.includes(originalEntry)) throw Error("O React continuou como entrypoint.");',
  'if (!nativeHtml.includes(\'type="importmap"\') || nativeHtml.includes(\'src="/src/main.tsx"\')) throw Error("Entrada JS ou importmap ausente.");', native);
write(native, build);

const configPath = "wrangler.jsonc";
const config = JSON.parse(read(configPath));
if (config.name !== "agendas-pradosm" || config.main !== "./worker/index.ts" ||
  config.vars?.REALTIME_MODE !== "on" || config.triggers?.crons?.[0] !== "5 3 * * *" ||
  !config.d1_databases?.some(x => x.binding === "DB" && x.database_name === "agendas-prado")) {
  throw Error("Configuração produtiva mudou: não sobrescrever os dados ou cron.");
}
config.main = "./worker/index.js";
config.assets = { ...config.assets, directory: "./dist", binding: "ASSETS" };
write(configPath, JSON.stringify(config, null, 2) + "\n");

// Remover todas as fontes TS, TSX e configurações de bundlers legados do git.
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
const obsolete = tracked.filter(path => /\.(ts|tsx)$/.test(path));
for (const path of obsolete) rmSync(path, { force: true });
for (const path of ["scripts/check-deploy-flow.mjs", "scripts/block-migration-deploy.mjs"]) {
  if (existsSync(path)) rmSync(path);
}

const pkgPath = "package.json";
const pkg = JSON.parse(read(pkgPath));
pkg.scripts = {
  dev: "npm run build && wrangler dev --config wrangler.migracao.jsonc",
  build: "npm run migracao:build",
  test: "npm run migracao:test",
  preview: "npm run dev",
  "migracao:build": "node scripts/build-native.mjs",
  "migracao:test": "node scripts/check-migracao-worker.mjs && node scripts/check-migracao-frontend.mjs && node --test tests/migration/*.test.js",
  "migracao:e2e": "playwright test --config playwright.migracao.config.js",
  "check:migrations": "node scripts/check-migration-safety.mjs",
  "test:design": "node scripts/check-design-system.mjs",
  "test:bootstrap-admin": "node scripts/check-bootstrap-admin.mjs",
  "bootstrap-admin": "node scripts/bootstrap-admin.mjs",
  "verify:production": "npm run check:migrations && npm test && npm run test:design && npm run test:bootstrap-admin && npm run build && node scripts/check-migracao-build.mjs",
  "deploy:cloudflare": "npm run check:migrations && wrangler d1 migrations apply DB --remote && wrangler deploy --config wrangler.jsonc",
  deploy: "npm run verify:production && npm run deploy:cloudflare"
};
pkg.dependencies = {
  "@llamaindex/liteparse-wasm": pkg.dependencies["@llamaindex/liteparse-wasm"],
  hono: pkg.dependencies.hono,
  zod: pkg.dependencies.zod
};
pkg.devDependencies = {
  "@playwright/test": pkg.devDependencies["@playwright/test"],
  wrangler: pkg.devDependencies.wrangler
};
write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const legacy = ["react", "react-dom", "react-router-dom", "vite", "vitest", "typescript"];
for (const dep of legacy) {
  if (pkg.dependencies[dep] || pkg.devDependencies[dep]) throw Error("Dependência legada remanescente: " + dep);
}
const remaining = git("ls-files", "-z").split("\0").filter(path => path && /\.(tsx?|jsx)$/.test(path) && existsSync(path));
if (remaining.length) throw Error("Fontes TypeScript/JSX ainda presentes: " + remaining.slice(0, 8).join(", "));
console.log("Migração final: removidos " + obsolete.length + " arquivos TS/TSX; D1 e cron de produção preservados.");