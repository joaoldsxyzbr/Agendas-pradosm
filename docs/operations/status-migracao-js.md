# Estado da migração integral para JavaScript puro

Atualizado em 18/10/2026 (horário local). Fonte de verdade: repositório `joaoldsxyzbr/Agendas-pradosm`. Branch temporária autorizada: `migracao-js-puro`.

## Resumo da situação

**Código migrado e integrado na branch, mas ainda não homologado.** Não existe evidência de que o build, o navegador ou a integração D1 estejam integralmente aprovados. A `main`, a `preview` e o D1 produtivo não receberam alterações desta migração.

### Implementado na branch

- Worker e serviços backend com equivalentes JavaScript ES Modules, incluindo autenticação, permissões, agendas, fornecedores, auditoria, manutenção agendada, presença e Durable Object de tempo real.
- Frontend nativo em `migration/frontend/`: login, sessão, rotas, tema, dashboard, lojas, usuários, histórico, tela do conferente, importação CSV/PDF, detalhes de agendamento, modais e atualizações incrementais sem troca de página.
- Entrada nativa `migration/frontend/entry.js`; build HTML/CSS/JS em `scripts/build-native.mjs`, preservando a ordem dos quatro arquivos CSS originais da `main`.
- Leitura de PDF com `@llamaindex/liteparse-wasm`, arquivos estáticos do pacote e importmap com hash CSP específico. **Requer validação no navegador real**.
- `npm run dev`, `npm run build` e `npm test` direcionados à stack JS nativa; testes legados mantidos em `npm run verify:legacy`, sem conexão com o runtime novo.
- `wrangler.migracao.jsonc` usa Worker JS e D1 **exclusivamente local/sintético**; comandos padrão de deploy bloqueados na branch.
- Testes de contrato `tests/migration/*.test.js`, testes Playwright com APIs mockadas `tests/migracao-browser/smoke.spec.js`, verificação estática de módulos, build e PDF.

### O que foi verificado de fato

- Conferência estática de sintaxe/importações de módulos JS durante a preparação.
- Verificações isoladas de regras de status, pesquisa, ordenação, métricas, rotas, sessão, HTML escapado, WebSocket/presença e bytes do PDF.
- Paridade estrutural de nomes de funções e consultas-chave do backend com a `main` inspecionada.
- Correção da persistência indevida de linha vazia após reexibir agendamentos e do estado CSS no modo edição.
- **Ainda não** foram executados com sucesso `npm ci`, `npm run build`, o conjunto completo `npm test` ou o Playwright em navegador nesta integração.

## Bloqueio confirmado: GitHub Actions antes do primeiro passo

- Workflow completo da migração: <https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39181152322> — falhou em segundos.
- **Experimento de controle mínimo**: <https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39181152356> — job `ubuntu-latest` contendo apenas `echo RUNNER_EXECUTOU_COM_SUCESSO`, sem checkout, npm, API, Cloudflare, Secrets nem dependências. Também terminou com falha em ~2 segundos e sem etapas/logs acessíveis.
- Isso descarta os testes, npm, React, JS e D1 como causa **direta** da falha no job mínimo. O diagnóstico exato da conta/runner exige a configuração do GitHub ou o suporte GitHub.
- Arquivo `.github/workflows/runner-diagnostico.yml` preservado como workflow manual (não dispara em cada push).
- Próxima ação externa: revisar as configurações e limites de Actions da conta/repositório; se tudo permitido, abrir chamado no <https://support.github.com/contact> com IDs do run/job e falha do `echo`.

## Critérios de aceite ainda não comprovados

1. Obter runner operacional e executar `npm ci --legacy-peer-deps`, `npm run build`, `node scripts/check-migracao-build.mjs` e `npm test`.
2. Executar `npm run migracao:e2e` (mock de APIs) e testes de integração Workers/D1 **local** (sem dados reais). Verificar login, papéis, status reversível, fornecedores manuais, troca, conclusão/reabertura, histórico, importação, PDF, WebSocket e acesso negado.
3. Validar a interface visual e responsiva com comparação direta à `main`, acessibilidade, persistência, atualizações sem piscar e carregamento de PDF WebAssembly sob CSP.
4. Com o código JS comprovado, remover definitivamente arquivos e dependências React/TypeScript/Vite, atualizar e conferir `package-lock.json` e trocar as configurações oficiais do Worker/entrypoint sem alterar cron/D1. **Não remover antecipadamente**, pois atualmente há testes de equivalência que usam os arquivos TS como referência.
5. Homologar a migração na `preview` isolada e solicitar aprovação explícita antes da `main`.

## Segurança

Não executar migrações D1 remotas nem deploy de produção pela branch de migração. Não copiar login de demonstração da preview para a main. Não remover o cron de fechamento da main. Não confundir build gerado, teste estático, CI verde, preview homologada e produção publicada.

Documentos históricos de cada etapa: `docs/operations/migracao-etapa-4.md` até `migracao-etapa-18.md`; comandos em `docs/operations/comandos-nativos-migracao.md`, `docs/operations/migracao-ci-build.md` e `docs/operations/ci-runner-diagnostico.md`.
