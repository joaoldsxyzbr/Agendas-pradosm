# Migração JS puro — etapa 16: tela do Conferente

Branch: `migracao-js-puro`; referência funcional e visual: `main`, commit `7981580e102d507680b6f956d3f6059bd3a97d0d`.

## Conversão realizada

- `migration/frontend/agenda-list.js`: tabela responsiva + cartões móveis, ordenação 3 estados, busca, status/trocas e edição manual. **Clique no status já selecionado volta para aguardando**, como na main.
- `migration/frontend/agenda-details.js`: horário, fornecedor, protocolo, status, valores, NF-e, pedidos e histórico, sem modificação de dados.
- `migration/frontend/store-modals.js`: cadastro/edição/remoção com confirmação de fornecedor sem agenda e conclusão do dia, preservando os endpoints do Worker original.
- `migration/frontend/store-agenda-model.js`: cálculos de status, busca sem acentos, ordenação e endpoints de hoje/histórico.
- `migration/frontend/today.js`: tela operacional com seleção de data, métricas, pesquisa, lista, PDF, fornecedores manuais, fechamento e histórico; renderização estável e atualizações parciais sem reconstruir a página. Integração nativa do calendário e eventos de realtime.
- `tests/migration/conferente.test.js`: testes de contrato para status, ordenação, busca, métricas, endpoints, escape de HTML, PDF e modais.

## Validação e pendências

Alguns contratos da listagem e do modelo foram executados de maneira isolada na preparação; passaram. **Ainda faltam testes Node completos, integração com D1 isolado, testes E2E de fluxo e comparação visual da tela**. Os arquivos acima continuam fora do entrypoint e não estão em produção.

Próximas prioridades: migrar `ImportAgendaPage.tsx` e `AdminAgendaPreview.tsx`, conectar o runtime JS, eliminar TypeScript/React/Vite e aprovar CI/E2E antes de qualquer promoção.

Nenhuma alteração no Worker publicado, em D1 ou nas branches `main`/`preview`.
