# Relatório Gerencial — divisão entre aguardando e sem conferência

Atualizado em 19/10/2026. A página `/admin/reports` (administrador e visualizador)
separa registros que continuam com status de agendamento `aguardando` conforme o estado de sua **agenda diária**.

## Regra de classificação

- **Aguardando:** `ag.status = 'aguardando'` e `a.status_dia = 'aberto'`.
- **Sem conferência:** `ag.status = 'aguardando'` e `a.status_dia = 'concluido'`.
- **Recebido**, **Não recebido**, **Recusado:** continuam classificados pelo status individual.
- Somente agendamentos ativos são contabilizados. Nenhuma alteração em `agendamentos.status` nem em `agendas.status_dia`.
- Reabrir uma agenda faz seus agendamentos ainda pendentes retornarem à categoria **Aguardando**; concluir a agenda os classifica no relatório como **Sem conferência**.
- Os dois grupos são mutuamente exclusivos e fazem parte do total de agendamentos, não são um novo resultado de recebimento. **Sem conferência não equivale a Não recebido** e não gera motivo nem histórico de mudança de status.

## Exibição

A consulta em `worker/routes/admin-reports.js` devolve `aguardando` e `semConferencia` separados por agenda e período, mediante SQL parametrizado somente de leitura. As agregações `frontend/report-model.js` propagam os números para:
- **7 KPIs**: agendamentos, recebidos, não recebidos, taxa, aguardando, sem conferência e recusados;
- evolução diária no Chart.js e fallback HTML/CSS, com cinco séries empilhadas;
- tabelas **Por loja** e **Por data**, com coluna `Sem conferência`;
- tooltips com descrição clara das duas categorias.

A taxa de recebimento continua **recebidos / total × 100**. O comparativo por loja e o período anterior mantêm o mesmo denominador, evitando distorções. Não há nova migração D1, escrita no banco nem alteração nas telas de recebimento.

## Validação

Testar dias abertos, dias concluídos, agregados de várias lojas, reabertura, soma dos cinco resultados, taxas, filtros por período e por loja, gráfico HTML/Chart.js e acesso do visualizador.
`tests/unit/reports.test.js`, `tests/unit/report-info.test.js`,
`tests/unit/vendor-libs.test.js`, `tests/browser/reports.spec.js`
e `tests/browser/report-info.spec.js`.

O GitHub `main` é fonte de verdade. Conferir CI e versão publicada do Cloudflare separadamente antes de afirmar que o site está atualizado.