# Migração da preview para HTML, CSS e JavaScript

## Estado

A branch preview usa a aplicação HTML/CSS/JavaScript servida diretamente pelo Cloudflare Worker. A entrada publicada é public/index.html; ela carrega `public/vanilla/live.js` e CSS nativo dividido por responsabilidades. Os módulos de cada tela estão em `public/vanilla/pages/` e os popups compartilhados em `public/vanilla/features/`. Consulte `docs/ARQUITETURA.md`. O Wrangler serve os assets de public/ e mantém a API no Worker.

A interface principal é a versão conectada às APIs e ao D1 exclusivo da preview. A demonstração antiga em memória foi retirada para que não haja dois caminhos de entrada. O backend executável e os testes do Worker usam módulos JavaScript. React, Vite como servidor/build e TypeScript foram retirados do projeto executável. Vitest continua na suíte de testes e usa Vite internamente como infraestrutura do runner.

## Funcionalidades preservadas

- Login rápido de preview para administrador, visualizador e conferente, com contas e dados fictícios.
- Autenticação e permissões aplicadas pelo Worker.
- Relatórios gerenciais e importação de agendas CSV/PDF.
- Conferência com motivo obrigatório para Não recebido e persistência no D1.
- Atualização realtime e fallback, relatórios, cadastros, auditoria e proteção de sessão.
- Migrations e D1 isolados do ambiente de produção.

## Desenvolvimento e validação

- npm run dev: Wrangler serve a interface e o Worker local.
- npm test: suíte do Worker, parsers, CSS e guards de deploy.
- npm run test:e2e: D1 local isolado e Playwright/axe contra a entrada principal.
- npm run build: prepara o extrator PDF e executa wrangler deploy --dry-run.
- O CI da branch preview executa testes, CodeQL, build e E2E.

A migração não altera a branch main, os dados reais nem o schema do D1. A validação visual do Penpot registrada na issue #90 permanece separada da migração de stack.
