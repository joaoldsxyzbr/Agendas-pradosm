# Chart.js e Lucide Static na main — 19/10/2026

## Objetivo
Retomar as duas bibliotecas de interface que já eram utilizadas na `preview`, **sem React, Vite, frameworks nem CDN externo**, preservando a arquitetura da `main` em JavaScript puro (ES Modules), HTML e CSS.

## Versões fixadas
- **Chart.js 4.5.1** — apenas o gráfico de evolução diária em `/admin/reports`.
- **Lucide Static 1.57.0** — SVGs locais para navegação do administrador, visualizador e conferente, e ícones de ajuda `i` nos relatórios.
- **@kurkle/color 0.3.4** — dependência transitiva do Chart.js.
As versões constam de `package.json` e `package-lock.json` para builds reproduzíveis por `npm ci`.

## Distribuição e CSP
`scripts/build-native.mjs` copia os recursos estáticos dos pacotes instalados no npm para `dist/vendor` (Chart.js UMD, seis SVGs e licenças disponíveis). Os recursos são servidos pela aplicação/Worker, em mesmo domínio (`'self'`), **sem CDN** e sem alterar CSP, rotas de API, autenticação ou banco D1. A folha `src/vendor-ui.css` é carregada em `index.html`.

Arquivos Lucide selecionados:
- `layout-dashboard.svg` — Recebimento.
- `chart-no-axes-column-increasing.svg` — Relatório Gerencial.
- `store.svg` — Lojas.
- `users.svg` — Usuários.
- `clipboard-check.svg` — Conferência.
- `info.svg` — informações contextuais.

## Chart.js sob demanda e fallback
`migration/frontend/report-chart.js` carrega `/vendor/chart.umd.min.js` **somente após entrar no relatório com dados**. Monta gráfico de barras empilhadas (recebidos, não recebidos, aguardando, recusados), com cores da interface, legenda e tooltip. Os valores vêm das agregações já existentes; cálculos e APIs não mudam.

Se o arquivo do Chart.js estiver indisponível, falhar ao carregar ou a inicialização do canvas falhar, o gráfico HTML anterior permanece visível. Ao mudar filtros/sair da tela, a instância Chart.js é destruída, evitando vazamento de memória; carregamentos assíncronos antigos não recriam gráficos em páginas desmontadas. Não existe carregamento de Chart.js no login ou tela do conferente.

## Verificações
- `tests/migration/vendor-libs.test.js`: versões e lock, SVGs por perfil, valores/gráfico, fallback e referência local.
- `tests/migracao-browser/reports.spec.js`: Chart.js renderizado em canvas real, e fallback ao abortar o recurso.
- `scripts/check-migracao-build.mjs`: verifica os sete recursos distribuídos (Chart e SVGs) e CSS.
- `npm run verify:production` e CI da `main`, mais `npm run migracao:e2e` com mocks. **Não testar escrevendo no D1 de produção.**

## Publicação e reversão
Mudança somente visual: nenhum schema D1 ou Worker de negócio é modificado. Para reverter, remover SVGs, loader do gráfico, estilos e dependências, preservando o gráfico HTML nativo. A entrada em produção depende de build/CI e publicação **confirmados** no Cloudflare. Se houver falha de token Cloudflare (erro histórico 9109), o código no GitHub não comprova que a mudança chegou ao site.
