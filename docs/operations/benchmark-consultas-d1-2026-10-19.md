# Diagnóstico reproduzível das consultas D1 — 19/10/2026

## Motivação
Issue [#102](https://github.com/joaoldsxyzbr/Agendas-pradosm/issues/102).
A `main` utiliza `listAdminAgendas` e `listStoreAgendas` em `worker/repositories/agendas.js`, ambas com agregações e sem paginação. A auditoria anterior constatou 162 agendas, 2390 agendamentos e 10 lojas ativas no D1, além dos índices `idx_agendas_loja_data` e `idx_agendamentos_agenda_horario`. Isso **não prova lentidão**.

## Ferramenta (nenhum acesso remoto)
`npm run benchmark:agendas` cria um SQLite **em memória**, com 10 lojas, 15 recebimentos por agenda e cenários crescentes de 162, 1000 e 5000 agendas. Executa as **próprias funções JavaScript de repositório** contra um adaptador com a mesma interface de consulta do D1. Mede mediana de cinco leituras após aquecimento e coleta `EXPLAIN QUERY PLAN` de cada cenário. Não copia SQL, não precisa de secrets nem escreve no Cloudflare.

`node scripts/benchmark-agendas.mjs --quick` usa 40 agendas e serve para smoke automatizado. É usado pelo teste `tests/unit/benchmark-agendas.test.js` no CI. Requer Node 22+; `node:sqlite` pode emitir aviso de recurso experimental em certas versões.

**Limitações:** SQLite no Node NÃO mede latência de rede, quota de CPU, execução remota ou índices internos da Cloudflare D1. Números locais não podem justificar por si só migrations, índices adicionais ou parâmetros de paginação em produção.

## Critérios para uma mudança futura
1. Medir `rows_read`, duração e volume retornado em Preview/D1 sintético, nos filtros comuns e no histórico completo.
2. Verificar se a interface e os endpoints realmente precisam listar todas as agendas ao mesmo tempo.
3. Se houver gargalo demonstrado, propor paginação incremental preservando compatibilidade e filtragem; testar perfil ADM, visualizador e conferente, histórico e ordenação.
4. Qualquer índice novo deve ser justificado por plano real e query; testar com dados sintéticos antes de migration aditiva.
5. Alterações por PR e CI, Preview isolada, smoke e deploy confirmado.

Este diagnóstico não altera o schema nem endpoints de produção.
