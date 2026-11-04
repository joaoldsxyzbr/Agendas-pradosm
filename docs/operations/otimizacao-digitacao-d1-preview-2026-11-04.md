# Medição e ajuste da consulta de digitação — 04/11/2026

## Objetivo
Reduzir as leituras no D1 da **preview** quando o administrador abre a tela de Agendas e o resumo de digitações é atualizado. Nenhuma escrita no D1 foi executada nesta análise; nenhum SQL de produção foi modificado.

## Evidência antes da mudança
Consultas somente de leitura via API D1 no banco de homologação, em 04/11/2026:

- 253 agendas, 3.670 agendamentos e 9 marcações de fornecedor (contagens no instante da consulta).
- Filtro de data `2026-11-04`, com 124 agendamentos ativos.
- Consulta de referência: `SELECT COUNT(*) ... FROM agendamentos ag JOIN agendas a ON a.id = ag.agenda_id WHERE a.data_agenda = ? AND ag.ativo = 1`.
- Plano anterior: `SCAN ag` + busca da agenda pela PK; `rows_read = 7.329`.
- Alternativa: `FROM agendas a CROSS JOIN agendamentos ag ON ag.agenda_id = a.id` com o mesmo filtro.
- Plano da alternativa: `SCAN a` + `SEARCH ag USING INDEX idx_agendamentos_agenda_horario (agenda_id=?)`; `rows_read = 387`.
- As duas consultas retornaram **124** registros. Redução de leituras na **consulta COUNT de referência** de cerca de 94,7%, sem adicionar índices.

`duration` foi coletado apenas em execuções isoladas e pode variar conforme cache e carga; não há evidência suficiente para afirmar aumento percentual de velocidade para toda a tela.

## Implementação
O ajuste é **apenas** na consulta de registros do dia em `worker/services/agenda-digitacao.ts`, usada por `listDigitacaoProgressByDate()`. A reordenação via `CROSS JOIN` controla o plano do SQLite, preservando o filtro e as linhas retornadas. A tabela de fornecedores, hashes, concorrência, auditoria, importação e estado operacional permanecem iguais.

O teste em `tests/unit/agenda-digitacao-fornecedor.test.ts` confere equivalência de resultado da consulta antiga e nova, além do uso do índice com `EXPLAIN QUERY PLAN` no SQLite sintético.

## Verificação
- [ ] GitHub CI: Worker TypeScript, testes unitários, Playwright e CodeQL.
- [ ] Testar a tela administrativa na preview publicada e a marcação de fornecedor.
- [ ] Medir novamente `rows_read` e latência do Worker sob carga comparável.
- [ ] Não transportar índices nem dados do D1 de testes para o D1 de produção; avaliar nova medição antes do merge na main.

Referência: https://developers.cloudflare.com/d1/observability/find-expensive-queries/
