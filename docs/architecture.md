# Arquitetura do Agenda Prado

## Fonte de verdade e ambientes

Repositório: `joaoldsxyzbr/Agendas-pradosm`. Branch `main`: produção; branch `testes`: homologação isolada (Preview). Alterações grandes de estrutura devem passar por PR e CI antes de entrar em `main`. O deploy efetivo depende de confirmação separada no Cloudflare Workers Builds.

**Stack:** JavaScript puro (ES Modules), HTML, CSS, Hono no Cloudflare Workers, D1, Zod, PDF WASM e recursos locais Lucide/Chart.js. Sem React, Vite ou TypeScript.

## Fluxo técnico

- `index.html` carrega `/frontend/entry.js` e CSS em `/frontend/styles/`.
- `frontend/` implementa páginas, sessão, UI, chamadas à API, relatório, importação e PDF.
- `frontend/import/`: parser CSV/PDF, validação de dados; `frontend/agenda/`: exportação PDF.
- `worker/index.js` é o ponto de entrada Worker; `worker/app.js` configura Hono e rotas.
- `worker/routes/` aplica validação/autorização; `worker/repositories/` acessa D1; `worker/services/` concentra regras e realtime.
- `shared/` preserva formatos e funções compartilhadas, sem depender de browser.
- `migrations/`: sequência aplicada via Wrangler, **não** renumerar ou sobrescrever migrations já aplicadas.
- `scripts/build-native.mjs` constrói `dist/`, copia todo `frontend/`, os contratos compartilhados e vendor local, valida importações e gera importmap para PDF WASM.
- `scripts/check-frontend.mjs`, `scripts/check-worker.mjs`, `scripts/check-build.mjs`: verificação de integridade.
- `tests/unit/` e `tests/browser/`: testes de contrato e fluxos no Chromium com D1 sintético e APIs mockadas.
- `.github/workflows/ci.yml`: testes, segurança, dry-run e navegador em cada PR.

## Comandos

```bash
npm ci --legacy-peer-deps
npm run dev
npm test
npm run test:e2e
npm run verify:production
```

Ambiente local: `wrangler.local.jsonc`. Produção: `wrangler.jsonc`. O comando `npm run deploy` aplica verificações e migrations remotas antes de publicar; **não executar sem aprovar o deploy**.

## Alterações estruturais

Preferir mudanças pequenas: criar o novo caminho, atualizar imports e scripts, executar CI e testes, remover somente as duplicatas antigas, arquivar documentação histórica, e então mesclar a PR. Não mexer em credenciais, sessões, permissões, banco de produção ou Worker de negócio numa reorganização de arquivos.
## Folhas de estilo em produção

O `index.html` define explicitamente a ordem das folhas CSS, parte da cascata visual. Não reordene ou consolide os arquivos sem testar os perfis administrador, visualizador e conferente.

Na primeira limpeza, removemos o carregamento redundante de `palette-refresh.css`, cujo conteúdo era o sufixo idêntico de `enterprise-gray.css`, imediatamente anterior na sequência. A paleta final permanece em `enterprise-gray.css`. O comando `npm run test:design` também verifica os links CSS reais do HTML, a existência dos arquivos e a duplicação de folhas por sufixo.

Consolidar outras regras somente por etapas verificáveis com testes de navegador. Plano e evidências: [Melhoria CSS e manutenção](operations/melhoria-css-manutencao-2026-10-25.md).
