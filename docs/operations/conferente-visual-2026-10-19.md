# Migração visual do conferente — 19/10/2026

## Causa
A promoção visual anterior priorizou o administrador: o layout `storeShell` de produção preservou o cabeçalho operacional antigo e os cinco indicadores do conferente continuaram no formato de etiquetas, diferente da página `public/vanilla/pages/conferente.js` da preview.

## Mudança
- `migration/frontend/shell.js`: sidebar do conferente com **somente a rota /app**, breadcrumb, identificação da loja e área do cabeçalho com controles do dia. Sem rotas administrativas.
- `migration/frontend/today.js`: apresentação dos indicadores e da agenda em painel com título e barra de pesquisa, preservando identificadores `data-*`, handlers, status, filtros, PDF, fornecedor manual e realtime.
- `src/conferente-visual.css`: estilos exclusivos do conferente (desktop, celular e impressão), inspirados na paleta, densidade e cartões da preview. Arquivo carregado após os estilos existentes, sem modificar o visual do administrador.
- `index.html` e `scripts/build-native.mjs`: inclusão no build de produção do novo CSS.

## Segurança e validação
Sem alteração do Worker, APIs, sessão, D1, dados de teste ou regras de recebimento. `tests/migracao-browser/conferente-layout.spec.js` cobre visual e controles em desktop/celular; manter os testes existentes de alternância de status e login por perfil. Conferir CI e implantação do Cloudflare separadamente.
