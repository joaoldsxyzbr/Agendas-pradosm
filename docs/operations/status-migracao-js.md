# Status da conversão para JavaScript puro — 18/10/2026

Branch de trabalho: `migracao-js-puro`, derivada da `main`. Esta documentação registra progresso real e pendências, sem inferir aprovação dos testes.

## Código JS incorporado, ainda não ativado

- Os módulos de runtime de `worker/` agora possuem equivalentes `.js` (entrada, autenticação, middleware, Durable Object, rotas, repositórios, serviços e bibliotecas).
- Os arquivos `shared/` e parsers de `src/import/` têm versões JS.
- As rotas e funções de agenda foram comparadas com a `main`. A exigência de motivo do não recebimento e a coluna `observacao` da `preview` **não foram levadas**, pois alterariam contratos e exigiriam migração D1 de produção.
- O backend Node/Cloudflare **ainda usa TS no entrypoint Wrangler atual**; os `.ts` permanecem até a troca atômica, após testes.
- Um teste isolado da lógica migrada de status executado durante a preparação passou; ele não substitui os testes reais Node/Worker.

## Validações de migração

- `node scripts/check-migracao-worker.mjs`: verifica a sintaxe e os caminhos dos imports ESM dos arquivos runtime migrados.
- `node --test tests/migration/*.test.js`: verifica contratos básicos, regras de banco, status, presença, rotas e API.
- `npm run verify:production`: mantém os testes existentes da versão TypeScript enquanto ainda é o runtime ativo.

O workflow `.github/workflows/migracao-js-puro.yml` executa as três verificações, mas **segue vermelho com falha imediata e logs HTTP 404 na integração GitHub**. Não afirmar CI verde.

## Pendente para completar a missão

1. Converter fielmente o frontend React/TSX da `main`, com mesmas URLs, telas, acessibilidade, aparência, importação, PDFs e atualização incremental sem piscar.
2. Migrar todo o conjunto de testes, substituir configs e eliminar React/TypeScript/Vite do projeto final.
3. Executar e aprovar testes Node, Workers, E2E, CI e homologação com D1 isolado.
4. Apenas após validação do usuário e autorização, seguir `migracao-js-puro → preview → main`.

Não foi feito deploy nem alteração de `main`, `preview` ou bancos de dados.

## Etapas 13–15 — telas nativas adicionadas (18/10/2026)

As três telas administrativas abaixo foram portadas da implementação React da `main` para JavaScript puro, preservando layout, nomes, classes e contratos HTTP. Elas permanecem em `migration/frontend/` e **não estão ligadas ao entrypoint da aplicação**:

- **Dashboard (`dashboard.js`, `dashboard-model.js`)**: sete colunas da `main`, contadores, filtros de lojas ativas com conferente, presença, calendários, atualização por WebSocket e alteração incremental de células sem reconstruir a página. Os comandos de importação e detalhes ainda aguardam os respectivos modais.
- **Usuários (`users.js`, `user-dialog.js`, `audit-trail.js`)**: cadastro, edição, senha opcional, filtro de papel/loja/situação, ativação/desativação com confirmação e auditoria, usando os mesmos endpoints da `main`.
- **Histórico (`history.js`)**: filtros de loja/data, consulta de agenda, status e trocas dos agendamentos, reabertura de dia e trilhas de auditoria; sem alterações de esquema de banco.

Cobertura de contrato acrescentada em `tests/migration/dashboard.test.js`, `users.test.js`, `history.test.js`. Foram realizadas verificações isoladas do modelo de Dashboard, filtro/payload de Usuários e URL/renderização segura do Histórico. **Isso não equivale a testes completos E2E nem garante paridade visual.** Mais detalhes em `docs/operations/migracao-etapa-13.md`, `migracao-etapa-14.md` e `migracao-etapa-15.md`.

### Bloqueios e próximos passos reais

1. Migrar **tela do Conferente** e toda sua experiência de recebimento e atualização em tempo real.
2. Migrar **importação de agenda** e **detalhes/edição da agenda administrativa**, conectar seus modais ao Dashboard.
3. Integrar todas as páginas ao frontend nativo, manter CSS da `main`, converter testes e remover **React, TypeScript e Vite**.
4. Corrigir o **GitHub Actions** (as execuções da branch continuam falhando rapidamente e a integração não disponibiliza os logs), rodar CI/E2E completo com banco isolado.
5. Homologar na `preview`; promoção a `main` somente após validação e autorização explícita.

`main`, `preview`, Worker de produção e bases D1 não foram modificados nesta etapa.
