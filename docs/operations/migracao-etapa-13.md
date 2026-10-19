# Migração JS puro — etapa 13: Dashboard administrativo

Data: 18/10/2026. Branch `migracao-js-puro`.

## Conversão

- `migration/frontend/dashboard-model.js`: modelo derivado de `src/admin/DashboardPage.tsx` da `main`, incluindo filtros de lojas com conferente ativo, contadores, presença, colunas e estados.
- `migration/frontend/dashboard.js`: tela nativa com **as mesmas sete colunas**, cabeçalhos e classes CSS da `main`, calendário nativo já migrado, atualização manual, retorno do navegador ao foco e atualização via WebSocket.
- O realtime de agenda aguarda 75 ms antes da consulta; eventos de presença alteram somente os elementos afetados. As linhas têm chaves estáveis e apenas células com HTML diferente são substituídas. O contêiner da página, datas, scroll e outras linhas permanecem.
- Modal de importação e detalhes da agenda são invocados por callbacks `openImport` e `openAgenda`, **ainda não conectados** porque esses modais precisam ser migrados fielmente da `main`. O runtime nativo também segue desacoplado da aplicação publicada.
- `tests/migration/dashboard.test.js` verifica indicadores, filtros, campos, saída segura de texto, datas e sinais de atualização incremental.

## Validação

Verificação isolada do modelo e de sintaxe passou na preparação; os novos testes Node e E2E ainda dependem da execução do CI. **Não considerar Dashboard plenamente homologado até converter os modais e testar no navegador.**

Nenhum deploy, D1, `main` ou `preview` foram alterados.
