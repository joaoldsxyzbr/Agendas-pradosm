# Remoção do legado da preview (31/10/2026)

## Objetivo

Remover a interface legada em JavaScript puro da branch `preview`, deixando a
interface React como única UI da homologação. Autorização explícita do usuário
em 31/10/2026 ("Já pode remover o legado completo da preview"). A `main`
(produção) permanece intocável e continua com a UI legada.

## Decisões

1. React na raiz com BrowserRouter: a build deixa de usar `base: /modern/`;
   `main.tsx` passa a usar BrowserRouter direto. O fallback SPA do Workers
   (`not_found_handling: single-page-application`) atende links diretos
   (`/login`, `/admin`, `/app/tags`) com `dist/index.html` do React. O antigo
   caminho `/modern/` continua carregando o app (rota desconhecida redireciona
   ao destino do papel). O HashRouter existia somente para evitar que links
   profundos caíssem no `index.html` legado; sem legado, ele perde a razão de
   existir.
2. Parsers de importação permanecem: `frontend/import/` (CSV/PDF) é reaproveitado
   pelo React (`apps/web/src/features/import/import-model.ts`) e continua sendo
   a lógica oficial de negócio. Os 5 módulos movem para `shared/import/`, fora
   do diretório legado. `@llamaindex/liteparse-wasm` permanece no `package.json`
   (o Vite empacota o parser; nenhum artefato `/vendor` é mais necessário).
3. `public/` mantém `_headers` (CSP) e `agenda-prado-icon.svg` (referenciado pelo
   HTML React). `manifest.webmanifest` e `theme-bootstrap.js` eram exclusivos
   do HTML legado e são removidos. A CSP vigente funciona sem o importmap do
   WASM (o bundle React é um módulo `script-src 'self'`).
4. Contratos de pipeline preservados: `npm run build` continua existindo e passa
   a montar `dist/` com React + `public/`; `scripts/build-modern-preview.mjs`
   continua existindo e passa a ser validador pós-build (a configuração do
   Workers Builds não está no repositório, então os dois pontos de entrada são
   mantidos funcionais). `scripts/check-build.mjs` é reescrito para o novo
   `dist/`.
5. Testes: removem-se as suítes exclusivas do legado (E2E de navegador
   `tests/browser`, specs de unidade de módulos `frontend/`, `check-frontend`,
   `check-design-system`, `prepare-e2e`). Os testes de Worker/API/contratos
   permanecem; os testes dos parsers passam a apontar para `shared/import/`;
   `diagnostics.test.js` perde os casos do cliente legado e mantém os casos do
   Worker.
6. Dependências: `chart.js`, `lucide-static`, `@tailwindcss/cli` e `tailwindcss`
   saem do `package.json` (somente legado). `hono`, `zod`,
   `@llamaindex/liteparse-wasm`, `wrangler` e `@playwright/test` permanecem.

## Escopo

- Removidos: `index.html` (legado), `frontend/` exceto `import/`, `public/manifest.webmanifest`,
  `public/theme-bootstrap.js`, `playwright.config.js`, `tests/browser/`, `tests/e2e/`,
  `scripts/{check-frontend,check-design-system,prepare-e2e}.mjs`, 19 specs de unidade
  do legado e dependências de UI antiga.
- Movidos: `frontend/import/*` → `shared/import/*`.
- Modificados: `apps/web/vite.config.ts` (base `/`), `apps/web/src/main.tsx`
  (BrowserRouter), `apps/web/src/features/import/import-model.ts` (caminhos),
  `scripts/{build-native,check-build,build-modern-preview,check-worker}.mjs`,
  `package.json` + `package-lock.json`, `.github/workflows/{ci,modern-ui,runner-diagnostico}.yml`,
  `README.md`, `docs/architecture.md`, `tests/unit/{shared-contracts,csv-decoding,pdf-text-contract,diagnostics}.test.js`.
- Intocados: `worker/`, `migrations/`, `shared/` (exceto adição de `import/`), D1s,
  `wrangler*.jsonc` e toda a API.

## Validação

Local: `npm ci`, `npm run check:migrations`, `npm test`, `npm run test:bootstrap-admin`,
`npm run build` + `check-build` + `build-modern-preview`, dry-run do wrangler preview,
auditorias npm e Playwright React completo. No PR: CI verde completo (quality,
CodeQL, verify). Pós-merge: deploy do worker validado por HTTP (raiz serve o React,
`/modern/` e caminhos antigos respondem, `/api/health` 200).
