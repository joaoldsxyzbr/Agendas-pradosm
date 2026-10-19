# Ajuste visual da sidebar — 19/10/2026

## Contexto
Após a migração visual, abas do menu lateral apareciam com altura excessiva (captura reportada na tela Usuários). Regras anteriores de `src/corporate.css` definiam `.admin-topnav .nav-link { flex: 1 1 0; }`, concebidas para menu horizontal; a nova sidebar herdava esse crescimento, ocupando todo o espaço vertical.

## Correção
- `src/preview-visual.css`: links da sidebar com `flex: 0 0 43px` e 43px de altura, preservando scroll e destaque; links móveis com altura fixa de 34px.
- `migration/frontend/runtime.js`: trilha de navegação acompanhando o item ativo ao navegar por SPA, sem reconstruir o layout.

A mudança não altera autenticação, backend, API, Worker, D1 nem rotas de negócio.

## Verificações
Workflow da candidata na `preview` aprovado: https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39276541277, incluindo build, contratos e Playwright desktop/mobile. Após publicação, conferir CI da `main` e deploy Cloudflare, que pode apresentar erro de token 9109 independente da interface.
