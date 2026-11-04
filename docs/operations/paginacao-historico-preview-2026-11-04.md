# Paginação do Histórico — verificação técnica (04/11/2026)

## Contrato e compatibilidade
A consulta `GET /api/admin/agendas` mantém o array legado quando `limit` não é informado, preservando Recebimento e consumidores existentes. O Histórico do administrador usa `limit=20&offset=N`, que retorna `{items,hasMore}`. Requisições fora dos limites (1–50, offset 0–100000) recebem HTTP 400.

A lista de identificadores é selecionada antes de agregar agendamentos; consulta usa `CROSS JOIN` para forçar o SQLite a percorrer apenas agendas selecionadas na etapa de agregação. Uma linha adicional por página detecta se existe próxima página sem consulta separada de contagem.

## Medição D1 homologação (somente SELECT / EXPLAIN)
No banco de testes (253 agendas, 3.670 agendamentos), com página de 21 IDs e sem filtros:
- `JOIN` convencional após a CTE: **2.184 rows_read**.
- `CROSS JOIN` após a CTE: **1.447 rows_read**.

Os valores são amostras de consultas agregadas equivalentes sobre dados de homologação; o endpoint completo, filtros e latência de interface devem ser validados após publicação. A seleção CTE ainda faz ordenação das agendas existentes; no volume atual, criar índice adicional é prematuro.

## Verificações
- Teste SQLite sintético compara o resultado de todas as páginas com a listagem anterior e verifica totalizações/filtros, sem duplicações.
- Teste HTTP valida formato legado, opção paginada e rejeição de parâmetros inválidos.
- Playwright cobre navegação Anterior/Próxima, última página e reinício após filtragem.
- CI e Cloudflare Workers Builds são condições para integração na `preview`.
- Nenhum dado, migração, segredo ou índice foi alterado.
