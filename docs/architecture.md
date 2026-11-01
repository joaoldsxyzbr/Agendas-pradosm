# Arquitetura do Agenda Prado

## Fonte de verdade e ambientes

Repositório: `joaoldsxyzbr/Agendas-pradosm`. Branch `main`: produção (UI legada em JavaScript puro, intocável durante a homologação); branch `preview`: homologação isolada onde, desde 31/10/2026, a única UI é o React de `apps/web/`, publicado na raiz. Alterações grandes de estrutura devem passar por PR e CI antes de entrar em `preview`; `main` só recebe o React após homologação aprovada e paridade comprovada.

**Stack da `preview`:** React 19 + Vite + TypeScript estrito em `apps/web/`, Hono no Cloudflare Workers, D1, Zod e parser PDF WASM em `shared/import/`. **Stack da `main`:** JavaScript puro (ES Modules), HTML, CSS, sem React, Vite ou TypeScript.

## Fluxo técnico

- `apps/web/` implementa todas as telas (login, recebimento, importação, conferência, tags, relatórios, lojas, histórico, usuários, logs).
- `scripts/build-native.mjs` constrói o React para `dist-modern/` e publica `dist/` na raiz com `public/` (ícone e CSP).
- O Workers serve `dist/` com fallback SPA: qualquer caminho (`/login`, `/admin`, `/app/tags`) entrega o `index.html` do React; o BrowserRouter resolve a rota. `/modern/` continua funcionando e cai no app.
- `worker/index.js` é o ponto de entrada Worker; `worker/app.js` configura Hono e rotas (`/api/*`).
- `worker/routes/` aplica validação/autorização; `worker/repositories/` acessa D1; `worker/services/` concentra regras e realtime.
- `shared/` preserva formatos e funções compartilhadas, sem depender de browser; `shared/import/` guarda o parser CSV/PDF de agendas.
- `migrations/`: sequência aplicada via Wrangler, **não** renumerar ou sobrescrever migrations já aplicadas.
- `scripts/check-worker.mjs`, `scripts/check-build.mjs`, `scripts/check-modern-boundary.mjs`: verificação de integridade e isolamento.
- `tests/unit/` cobre Worker, contratos e parsers; `apps/web/tests/` cobre a UI React no Chromium com API mockada.
- `.github/workflows/ci.yml`: testes, segurança, dry-run e navegador em cada PR.

## Comandos

```bash
npm ci --legacy-peer-deps
npm run dev
npm test
npm run verify:production
npx playwright test --config apps/web/playwright.config.mjs
```

Ambiente local: `wrangler.local.jsonc`. Produção: `wrangler.jsonc`. O comando `npm run deploy` aplica verificações e migrations remotas antes de publicar; **não executar sem aprovar o deploy**.

## Alterações estruturais

Preferir mudanças pequenas: criar o novo caminho, atualizar imports e scripts, executar CI e testes, remover somente as duplicatas antigas, arquivar documentação histórica, e então mesclar a PR. Não mexer em credenciais, sessões, permissões, banco de produção ou Worker de negócio numa reorganização de arquivos.