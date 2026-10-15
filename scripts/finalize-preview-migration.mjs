import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { transformSync } from "esbuild";

const ignoredDirectories = new Set([".git", "node_modules", ".wrangler", "dist", "coverage", "playwright-report", "test-results"]);

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...filesUnder(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(command + " " + args.join(" ") + " falhou.");
}

function rewriteTsImportExtensions(source) {
  return source.replace(/(["'])(\.\.?\/[^"']+)\.(?:ts|tsx)(["'])/g, "$1$2.js$3");
}

function transpileTypeScript(path) {
  const source = readFileSync(path, "utf8");
  const output = path.replace(/\.ts$/, ".js");
  const compiled = transformSync(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcefile: path,
  }).code;
  write(output, rewriteTsImportExtensions(compiled));
  console.log("Convertido " + path + " para " + output);
}

function replaceSection(source, startHeading, endHeading, replacement) {
  const start = source.indexOf(startHeading);
  const end = source.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) throw new Error("Seção ausente no README: " + startHeading);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
}

function removeEmptyDirectories(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    removeEmptyDirectories(path);
    if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
  }
}

run(process.execPath, ["scripts/convert-worker-preview.mjs"]);
run(process.execPath, ["scripts/build-pdf-preview.mjs"]);

for (const root of ["src/import", "src/agenda", "tests/worker", "tests/ui", "tests/setup"]) {
  for (const path of filesUnder(root)) {
    if (path.endsWith(".ts")) transpileTypeScript(path);
  }
}

for (const path of filesUnder("worker").concat(filesUnder("shared"), filesUnder("src"), filesUnder("tests"), filesUnder("public/vanilla"))) {
  if (!path.endsWith(".js")) continue;
  const before = readFileSync(path, "utf8");
  const after = rewriteTsImportExtensions(before);
  if (after !== before) write(path, after);
}

const packagePath = "package.json";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
packageJson.scripts = {
  dev: "wrangler dev --local",
  test: "npm run test:worker && npm run test:parser && npm run test:design && npm run test:deploy-flow && npm run test:bootstrap-admin",
  "test:watch": "vitest --config vitest.config.js",
  "check:javascript": "node scripts/check-javascript.mjs",
  build: "node scripts/build-pdf-preview.mjs && wrangler deploy --dry-run --var SESSION_SECRET:agenda-prado-build-secret",
  "verify:production": "npm test && npm run check:javascript && npm run build",
  "check:migrations": "node scripts/check-migration-safety.mjs",
  deploy: "npm run verify:production && npm run deploy:cloudflare",
  "test:worker": "vitest run --config vitest.config.js",
  "test:parser": "vitest run --config vitest.parser.config.js",
  "bootstrap-admin": "node scripts/bootstrap-admin.mjs",
  "test:design": "node scripts/check-design-system.mjs",
  "test:deploy-flow": "node scripts/check-deploy-flow.mjs",
  "test:e2e:prepare": "node scripts/prepare-e2e.mjs",
  "test:e2e": "npm run build && npm run test:e2e:prepare && playwright test",
  "test:bootstrap-admin": "node scripts/check-bootstrap-admin.mjs",
  "test:e2e:ci": "npm run test:e2e:prepare && playwright test",
  "deploy:cloudflare": "npm run check:migrations && wrangler d1 migrations apply DB --remote && wrangler deploy",
};
packageJson.dependencies = {
  "@llamaindex/liteparse-wasm": packageJson.dependencies["@llamaindex/liteparse-wasm"],
  hono: packageJson.dependencies.hono,
  zod: packageJson.dependencies.zod,
};
packageJson.devDependencies = {
  "@axe-core/playwright": packageJson.devDependencies["@axe-core/playwright"],
  "@cloudflare/vitest-plugin": packageJson.devDependencies["@cloudflare/vitest-plugin"],
  "@playwright/test": packageJson.devDependencies["@playwright/test"],
  esbuild: "^0.25.0",
  jsdom: packageJson.devDependencies.jsdom,
  vitest: packageJson.devDependencies.vitest,
  wrangler: packageJson.devDependencies.wrangler,
};
write(packagePath, JSON.stringify(packageJson, null, 2) + "\n");

write("vitest.config.js", [
  'import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";',
  'import { defineConfig } from "vitest/config";',
  "",
  "export default defineConfig({",
  "  plugins: [",
  "    cloudflareTest(async () => {",
  '      const migrations = await readD1Migrations("migrations");',
  "      return {",
  '        wrangler: { configPath: "./wrangler.jsonc" },',
  "        miniflare: {",
  "          bindings: {",
  "            TEST_MIGRATIONS: migrations,",
  '            SESSION_SECRET: "agenda-prado-test-session-secret",',
  "            REALTIME_MODE: \"on\",",
  "          },",
  "        },",
  "      };",
  "    }),",
  "  ],",
  "  test: {",
  "    include: [",
  '      "tests/worker/**/*.test.js",',
  '      "tests/ui/parser.test.js",',
  '      "tests/ui/extract-pdf.test.js",',
  "    ],",
  '    setupFiles: ["./tests/setup/migrations.js"],',
  "  },",
  "});",
].join("\n") + "\n");

write("vitest.parser.config.js", [
  'import { defineConfig } from "vitest/config";',
  "",
  "export default defineConfig({",
  "  test: {",
  "    include: [",
  '      "tests/ui/parse-agenda-batch.test.js",',
  '      "tests/ui/export-agenda-pdf.test.js",',
  "    ],",
  '    environment: "jsdom",',
  "  },",
  "});",
].join("\n") + "\n");

write("playwright.config.js", [
  'import { defineConfig, devices } from "@playwright/test";',
  "",
  'const baseURL = "http://127.0.0.1:5173";',
  "",
  "export default defineConfig({",
  '  testDir: "./tests/e2e",',
  "  fullyParallel: false,",
  "  workers: 1,",
  "  retries: process.env.CI ? 1 : 0,",
  '  reporter: process.env.CI ? "line" : "list",',
  "  use: {",
  "    baseURL,",
  '    trace: "retain-on-failure",',
  "  },",
  "  webServer: {",
  '    command: "npm run dev -- --ip 127.0.0.1 --port 5173",',
  '    url: baseURL + "/",',
  "    reuseExistingServer: false,",
  "    timeout: 120_000,",
  '    stdout: "pipe",',
  '    stderr: "pipe",',
  "    env: {",
  '      SESSION_SECRET: process.env.SESSION_SECRET ?? "agenda-prado-e2e-session-secret",',
  "    },",
  "  },",
  "  projects: [",
  "    {",
  '      name: "chromium",',
  '      use: { ...devices["Desktop Chrome"] },',
  "    },",
  "  ],",
  "});",
].join("\n") + "\n");

const liveHtml = readFileSync("public/vanilla/live.html", "utf8");
let rootHtml = liveHtml
  .replace('href="./styles.css"', 'href="/vanilla/styles.css"')
  .replace('src="./live.js"', 'src="/vanilla/live.js"');
if (!rootHtml.includes('href="/vanilla/styles.css"') || !rootHtml.includes('src="/vanilla/live.js"')) {
  throw new Error("Não foi possível apontar a entrada HTML para os assets da aplicação live.");
}
if (!rootHtml.includes("/theme-bootstrap.js")) {
  const themeElements = [
    '  <link rel="icon" type="image/svg+xml" href="/agenda-prado-icon.svg">',
    '  <link rel="manifest" href="/manifest.webmanifest">',
    '  <script src="/theme-bootstrap.js"></script>',
  ].join("\n");
  rootHtml = rootHtml.replace("</head>", themeElements + "\n</head>");
}
write("public/index.html", rootHtml);

const wranglerPath = "wrangler.jsonc";
const wrangler = JSON.parse(readFileSync(wranglerPath, "utf8"));
wrangler.assets = {
  ...wrangler.assets,
  directory: "./public",
  binding: "ASSETS",
};
write(wranglerPath, JSON.stringify(wrangler, null, 2) + "\n");

const pdfBuildPath = "scripts/build-pdf-preview.mjs";
write(pdfBuildPath, readFileSync(pdfBuildPath, "utf8").replaceAll("src/import/extractPdfText.ts", "src/import/extractPdfText.js"));

write("scripts/check-design-system.mjs", [
  'import assert from "node:assert/strict";',
  'import { readFileSync } from "node:fs";',
  "",
  'const css = readFileSync(new URL("../public/vanilla/styles.css", import.meta.url), "utf8");',
  'for (const token of ["--canvas", "--panel", "--accent"]) {',
  '  assert.ok(css.includes(token), "token de design ausente: " + token);',
  "}",
  'for (const feature of [":focus-visible", "prefers-reduced-motion", ".sidebar", ".table-scroll", "@media"]) {',
  '  assert.ok(css.includes(feature), "regra de interface responsiva/acessível ausente: " + feature);',
  "}",
  'console.log("CSS nativo, tokens, foco, movimento reduzido e responsividade validados.");',
].join("\n") + "\n");

write("scripts/check-javascript.mjs", [
  'import assert from "node:assert/strict";',
  'import { existsSync, readdirSync } from "node:fs";',
  'import { join } from "node:path";',
  'import { spawnSync } from "node:child_process";',
  "",
  'const skipped = new Set([".git", "node_modules", ".wrangler", "dist", "coverage", "playwright-report", "test-results"]);',
  "function walk(directory) {",
  "  if (!existsSync(directory)) return [];",
  "  const found = [];",
  "  for (const entry of readdirSync(directory, { withFileTypes: true })) {",
  "    const path = join(directory, entry.name);",
  "    if (entry.isDirectory()) {",
  "      if (!skipped.has(entry.name)) found.push(...walk(path));",
  "    } else {",
  "      found.push(path);",
  "    }",
  "  }",
  "  return found;",
  "}",
  'const files = walk(".");',
  'const legacy = files.filter((path) => /\\.(?:ts|tsx|mts|cts)$/.test(path));',
  'assert.deepEqual(legacy, [], "a migração não pode deixar fontes TypeScript: " + legacy.join(", "));',
  'const scripts = files.filter((path) => /\\.(?:js|mjs|cjs)$/.test(path));',
  "for (const path of scripts) {",
  '  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });',
  '  assert.equal(result.status, 0, path + ": " + (result.stderr || result.stdout));',
  "}",
  'console.log("JavaScript válido em " + scripts.length + " arquivos; nenhuma fonte TypeScript restante.");',
].join("\n") + "\n");

const deployGuardPath = "scripts/check-deploy-flow.mjs";
let deployGuard = readFileSync(deployGuardPath, "utf8");
deployGuard = deployGuard
  .replace('"npm test && npm run typecheck && npm run build"', '"npm test && npm run check:javascript && npm run build"')
  .replaceAll("../playwright.config.ts", "../playwright.config.js")
  .replace('  "../tests/e2e/login-accessibility.spec.ts",\n  "../tests/e2e/roles.spec.ts",', '  "../tests/e2e/live-app.spec.js",')
  .replaceAll("../index.html", "../public/index.html")
  .replace("Fluxo nativo Cloudflare e hardening de produção validados.", "Fluxo HTML/JavaScript Cloudflare e hardening de produção validados.");
const guardMarker = 'console.log("Fluxo HTML/JavaScript Cloudflare e hardening de produção validados.");';
const guardAssertions = [
  'assert.equal(packageJson.scripts?.typecheck, undefined, "o projeto não deve manter o compilador TypeScript");',
  'assert.equal(packageJson.scripts?.dev, "wrangler dev --local", "a aplicação deve ser servida por Wrangler");',
  'assert.equal(wranglerConfig.assets?.directory, "./public", "Cloudflare deve servir os assets de public/");',
  "const declaredDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };",
  'for (const dependency of ["react", "react-dom", "react-router-dom", "@vitejs/plugin-react", "@cloudflare/vite-plugin", "typescript", "vite"]) {',
  '  assert.equal(Object.hasOwn(declaredDependencies, dependency), false, "dependência legada ainda declarada: " + dependency);',
  "}",
  'assert.equal(existsSync(new URL("../.github/workflows/convert-worker-preview.yml", import.meta.url)), false, "conversão TS não pode permanecer no CI");',
  'const nativeIndex = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");',
  'assert.ok(nativeIndex.includes("/vanilla/live.js"), "entrada principal deve carregar a aplicação conectada à API");',
  'assert.ok(nativeIndex.includes("/vanilla/styles.css"), "entrada principal deve carregar os estilos nativos");',
  guardMarker,
].join("\n");
if (!deployGuard.includes(guardMarker)) throw new Error("Não foi localizado o finalizador do guard de deploy.");
deployGuard = deployGuard.replace(guardMarker, guardAssertions);
write(deployGuardPath, deployGuard);

const ciPath = ".github/workflows/ci.yml";
let ci = readFileSync(ciPath, "utf8")
  .replace(
    "    name: Tests, typecheck, build and E2E\n    runs-on:",
    "    name: Tests, JavaScript checks, build and E2E\n    runs-on:",
  )
  .replace(
    "      - name: Validate JavaScript, HTML and CSS preview\n        run: |\n          node --check public/vanilla/app.js\n          node --check public/vanilla/live.js\n          test -s public/vanilla/live.html\n          test -s public/vanilla/index.html\n          test -s public/vanilla/styles.css\n",
    "      - name: Validate HTML, CSS and JavaScript\n        run: |\n          node scripts/check-javascript.mjs\n          test -s public/index.html\n          test -s public/vanilla/live.js\n          test -s public/vanilla/styles.css\n",
  )
  .replace("      - name: Typecheck\n        run: npm run typecheck\n", "      - name: Check JavaScript\n        run: npm run check:javascript\n")
  .replace(
    '      - name: Build\n        env:\n          VITE_PREVIEW_MOCKS: "off"\n        run: npm run build\n',
    "      - name: Build\n        run: npm run build\n",
  )
  .replace("    name: CodeQL JavaScript/TypeScript\n    runs-on:", "    name: CodeQL JavaScript\n    runs-on:")
  .replace("          languages: javascript-typescript", "          languages: javascript");
const conversionJob = ci.indexOf("\n  convert-preview-sources:");
if (conversionJob >= 0) ci = ci.slice(0, conversionJob) + "\n";
if (ci.includes("npm run typecheck") || ci.includes("javascript-typescript")) {
  throw new Error("CI ainda contém etapas do build TypeScript/Vite.");
}
write(ciPath, ci);

const manualVerifyPath = ".github/workflows/verify.yml";
const manualVerify = readFileSync(manualVerifyPath, "utf8")
  .replaceAll('stage="typecheck"', 'stage="JavaScript validation"')
  .replaceAll("npm run typecheck", "npm run check:javascript");
write(manualVerifyPath, manualVerify);

const codeqlPath = ".github/workflows/codeql.yml";
const codeql = readFileSync(codeqlPath, "utf8")
  .replaceAll("Analyze JavaScript/TypeScript", "Analyze JavaScript")
  .replaceAll("javascript-typescript", "javascript");
write(codeqlPath, codeql);

const readmePath = "README.md";
let readme = readFileSync(readmePath, "utf8");
readme = replaceSection(readme, "## Stack", "## Perfis de acesso", [
  "## Stack",
  "",
  "- HTML, CSS e JavaScript ES modules para a interface.",
  "- Hono em Cloudflare Workers para a API.",
  "- Cloudflare D1 isolado por ambiente.",
  "- Zod para validação de dados.",
  "- Playwright e Vitest para testes; Vite não é usado como servidor ou empacotador da aplicação.",
].join("\n"));
const fence = String.fromCharCode(96).repeat(3);
readme = replaceSection(readme, "## Desenvolvimento local", "## D1 e migrations", [
  "## Desenvolvimento local",
  "",
  "Pré-requisitos: Node.js 22, npm e Wrangler (autenticado somente para recursos remotos).",
  "",
  "Instale as dependências:",
  "",
  fence + "bash",
  "npm ci",
  fence,
  "",
  "Crie um arquivo local .dev.vars com SESSION_SECRET=defina-um-segredo-local-longo-e-aleatorio. Arquivos .dev.vars* e .env* são ignorados e não devem ser versionados.",
  "",
  "Prepare o D1 local com npx wrangler d1 migrations apply DB --local.",
  "Inicie a aplicação HTML/JavaScript e o Worker com npm run dev.",
  "Wrangler serve os assets estáticos de public/ e o Worker local usando .wrangler/state.",
  "",
  "## Comandos principais",
  "",
  "| Comando | Função |",
  "| --- | --- |",
  "| npm run dev | Interface estática e Worker local pelo Wrangler |",
  "| npm test | Testes do Worker, parser e guards do projeto |",
  "| npm run test:e2e | Build + D1 local isolado + Playwright Chromium + axe |",
  "| npm run check:javascript | Sintaxe JS e ausência de fontes TypeScript |",
  "| npm run build | Extrator PDF e validação do Worker/assets |",
  "| npm run verify:production | Testes + sintaxe JavaScript + build |",
  "| npm run check:migrations | Bloqueia migrations destrutivas sem aprovação |",
  "| npm run deploy | Verifica, aplica migrations remotas e publica pelo Wrangler |",
  "| npm run bootstrap-admin | Bootstrap administrativo de emergência, somente break-glass |",
].join("\n"));
readme = readme.replace(
  "Por padrão, Wrangler e o plugin Vite da Cloudflare usam .wrangler/state para o estado local.",
  "Por padrão, Wrangler usa .wrangler/state para o estado local.",
);
write(readmePath, readme);

write("docs/preview-migracao-vanilla.md", [
  "# Migração da preview para HTML, CSS e JavaScript",
  "",
  "## Estado",
  "",
  "A branch preview usa a aplicação HTML/CSS/JavaScript servida diretamente pelo Cloudflare Worker. A entrada publicada é public/index.html; ela carrega public/vanilla/live.js e public/vanilla/styles.css. O Wrangler serve os assets de public/ e mantém a API no Worker.",
  "",
  "A interface principal é a versão conectada às APIs e ao D1 exclusivo da preview. A demonstração antiga em memória foi retirada para que não haja dois caminhos de entrada. O backend executável e os testes do Worker usam módulos JavaScript. React, Vite como servidor/build e TypeScript foram retirados do projeto executável. Vitest continua na suíte de testes e usa Vite internamente como infraestrutura do runner.",
  "",
  "## Funcionalidades preservadas",
  "",
  "- Login rápido de preview para administrador, visualizador e conferente, com contas e dados fictícios.",
  "- Autenticação e permissões aplicadas pelo Worker.",
  "- Relatórios gerenciais e importação de agendas CSV/PDF.",
  "- Conferência com motivo obrigatório para Não recebido e persistência no D1.",
  "- Atualização realtime e fallback, relatórios, cadastros, auditoria e proteção de sessão.",
  "- Migrations e D1 isolados do ambiente de produção.",
  "",
  "## Desenvolvimento e validação",
  "",
  "- npm run dev: Wrangler serve a interface e o Worker local.",
  "- npm test: suíte do Worker, parsers, CSS e guards de deploy.",
  "- npm run test:e2e: D1 local isolado e Playwright/axe contra a entrada principal.",
  "- npm run build: prepara o extrator PDF e executa wrangler deploy --dry-run.",
  "- O CI da branch preview executa testes, CodeQL, build e E2E.",
  "",
  "A migração não altera a branch main, os dados reais nem o schema do D1. A validação visual do Penpot registrada na issue #90 permanece separada da migração de stack.",
].join("\n") + "\n");

const releaseDocPath = "docs/operations/production-release.md";
if (existsSync(releaseDocPath)) {
  const releaseDoc = readFileSync(releaseDocPath, "utf8").replaceAll("npm run typecheck", "npm run check:javascript");
  write(releaseDocPath, releaseDoc);
}

write("tests/e2e/live-app.spec.js", [
  'import AxeBuilder from "@axe-core/playwright";',
  'import { expect, test } from "@playwright/test";',
  "",
  "async function enterDemo(page, role) {",
  '  await page.goto("/");',
  '  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();',
  '  await page.getByRole("button", { name: new RegExp(role, "i") }).click();',
  "}",
  "",
  "async function expectNoBlockingAccessibilityViolations(page) {",
  "  const scan = await new AxeBuilder({ page }).analyze();",
  "  const blocking = scan.violations.filter(",
  "    (violation) => violation.impact === \"critical\" || violation.impact === \"serious\",",
  "  );",
  "  expect(blocking).toEqual([]);",
  "}",
  "",
  'test("entrada principal usa o app conectado à API e mantém acessibilidade no login", async ({ page }) => {',
  '  const response = await page.goto("/");',
  "  expect(response).not.toBeNull();",
  '  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();',
  '  await expect(page.getByLabel("Login")).toBeVisible();',
  '  await expect(page.getByLabel("Senha")).toBeVisible();',
  "  await expectNoBlockingAccessibilityViolations(page);",
  "});",
  "",
  'test("administrador percorre recebimento, relatórios e cadastros", async ({ page }) => {',
  '  await enterDemo(page, "Administrador");',
  '  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();',
  '  await page.getByRole("link", { name: /Relatórios/ }).click();',
  '  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();',
  '  await expect(page.getByRole("heading", { name: "Por loja" })).toBeVisible();',
  '  await page.getByRole("link", { name: /Lojas/ }).click();',
  '  await expect(page.getByRole("heading", { name: "Lojas", exact: true })).toBeVisible();',
  '  await page.getByRole("link", { name: /Usuários/ }).click();',
  '  await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible();',
  "});",
  "",
  'test("visualizador consulta relatórios sem ver cadastros", async ({ page }) => {',
  '  await enterDemo(page, "Visualizador");',
  '  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();',
  '  await expect(page.getByRole("link", { name: "Lojas" })).toHaveCount(0);',
  '  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);',
  '  await page.getByRole("link", { name: /Relatórios/ }).click();',
  '  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();',
  '  await expect(page.getByRole("heading", { name: "Ocorrências e observações" })).toBeVisible();',
  '  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();',
  "});",
  "",
  'test("conferente salva motivo obrigatório e volta o status para aguardando", async ({ page }) => {',
  '  await enterDemo(page, "Conferente");',
  '  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();',
  '  await expect(page.getByText("Loja Demonstração").first()).toBeVisible();',
  '  await expect(page.getByText("Distribuidora Exemplo")).toBeVisible();',
  '  await page.locator(\'button[data-status][data-next="nao_chegou"]\').first().click();',
  '  const dialog = page.getByRole("dialog", { name: "Motivo do não recebimento" });',
  "  await expect(dialog).toBeVisible();",
  '  await dialog.getByRole("button", { name: "Salvar" }).click();',
  "  await expect(dialog).toBeVisible();",
  '  const reason = "Fornecedor cancelou a entrega na preview.";'.replace(/^/, ""),
  '  await dialog.locator(\'textarea[name="observation"]\').fill(reason);',
  '  await dialog.getByRole("button", { name: "Salvar" }).click();',
  "  await expect(dialog).toHaveCount(0);",
  "  await expect(page.getByText(reason)).toBeVisible();",
  '  await page.locator(\'button[data-status][data-next="nao_chegou"]\').first().click();',
  "  await expect(page.getByText(reason)).toHaveCount(0);",
  "});",
  "",
  'test("menu mobile abre e navega na aplicação principal", async ({ page }) => {',
  "  await page.setViewportSize({ width: 390, height: 844 });",
  '  await enterDemo(page, "Administrador");',
  '  const menu = page.getByRole("button", { name: "Abrir navegação" });',
  "  await expect(menu).toBeVisible();",
  "  await menu.click();",
  '  await expect(menu).toHaveAttribute("aria-expanded", "true");',
  '  await page.getByRole("link", { name: /Conferente/ }).click();',
  '  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();',
  '  await expect(menu).toHaveAttribute("aria-expanded", "false");',
  "});",
].join("\n") + "\n");

if (existsSync("tests/e2e/native.spec.js")) {
  write("tests/e2e/native.spec.js", readFileSync("tests/e2e/native.spec.js", "utf8").replaceAll("/vanilla/live.html", "/"));
}

for (const path of filesUnder(".")) {
  if (/\.(?:d\.)?(?:ts|tsx|mts|cts)$/.test(path)) rmSync(path, { force: true });
  if (/(^|\/)tsconfig(?:[.-][^/]*)?\.json$/i.test(path)) rmSync(path, { force: true });
}

const keepSourceJavaScript = new Set([
  "src/import/parseAgendaText.js",
  "src/import/parseAgendaBatch.js",
  "src/import/extractPdfText.js",
  "src/agenda/exportAgendaPdf.js",
]);
for (const path of filesUnder("src")) {
  if (!keepSourceJavaScript.has(path)) rmSync(path, { force: true });
}
removeEmptyDirectories("src");

for (const path of [
  "index.html",
  "scripts/convert-worker-preview.mjs",
  ".github/workflows/convert-worker-preview.yml",
  "public/vanilla/index.html",
  "public/vanilla/app.js",
  "public/vanilla/live.html",
  "tests/e2e/vanilla.spec.js",
  "tests/e2e/demo-login.spec.ts",
  "tests/e2e/login-accessibility.spec.ts",
  "tests/e2e/roles.spec.ts",
  "vitest.ui.config.ts",
]) rmSync(path, { force: true });

const wranglerAssetTest = readFileSync("wrangler.jsonc", "utf8");
if (!wranglerAssetTest.includes('"directory": "./public"')) throw new Error("Assets do Wrangler não apontam para public/.");

rmSync("node_modules", { recursive: true, force: true });
rmSync("package-lock.json", { force: true });
run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
run("npm", ["ci"]);
run("npm", ["run", "check:javascript"]);
run("npm", ["run", "test:design"]);
run("npm", ["run", "test:deploy-flow"]);

rmSync("scripts/finalize-preview-migration.mjs", { force: true });
rmSync(".github/workflows/finalize-preview-migration.yml", { force: true });
run("git", ["diff", "--check"]);
run("git", ["config", "user.name", "github-actions[bot]"]);
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
run("git", ["add", "-A"]);
run("git", ["commit", "-m", "refactor(preview): concluir migração HTML CSS JavaScript"]);
run("git", ["push", "origin", "HEAD:preview"]);
