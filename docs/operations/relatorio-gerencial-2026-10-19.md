# Relatório Gerencial — contrato funcional e apresentação

## Uso e permissões
- Rota: `/admin/reports`; administrador e visualizador podem consultar.
- O conferente não tem acesso. O visualizador possui somente GET na lista de rotas autorizadas.
- Fonte dos dados: D1 via API autenticada. Filtros, situação e indicadores são calculados a partir dos registros; não há SQL no navegador.

## Dados e regras
- Filtros: período de até 93 dias, várias lojas (ou Todas), atalhos de data e comparação opcional com período anterior.
- Visão geral: taxa de recebimento (**recebidos / total**, inclusive pendentes no denominador), total de agendamentos, recebidos, não recebidos, não compareceu, aguardando e recusados.
- **Não compareceu**: pendências classificadas pelo sistema no fechamento do dia e agendas antigas concluídas com registros que permanecem aguardando. Não é prova de ausência física; não entra em Não recebidos manuais.
- Evolução diária com Chart.js local e fallback HTML; desempenho por loja, fornecedores com não recebimentos e distribuição por dia da semana.
- Detalhamento: tabela por loja, situações, observações e origem das ocorrências; 50 por página, busca por fornecedor/protocolo.
- A seleção das lojas é aplicada a todas as consultas e preservada no navegador. O estado antigo com apenas uma loja continua compatível.

## Organização visual (branch design/relatorio-gerencial-executivo)
A interface foi reorganizada em três seções navegáveis:
1. **Visão geral:** taxa como indicador principal, quatro números operacionais destacados e dois indicadores secundários. Barra visual complementar à taxa, sem modificar o cálculo.
2. **Desempenho:** gráfico diário, comparativos e ranking de ocorrências com títulos e controles separados dos dados.
3. **Detalhamento:** tabelas com taxas visualizáveis e indicação clara de situação manual/automática, mantendo busca e paginação.

A apresentação usa `frontend/styles/manager-reports-executive.css`, carregado após os estilos globais e escopado a `.manager-report`. Nenhuma mudança de API, banco, autenticação, migração, dependências ou regras de negócio. O layout deve funcionar em desktop e dispositivos estreitos, com tabelas roláveis sem rolagem horizontal da página e navegação por teclado.

## Validação e publicação
- Verificação do código: `npm test`, `npm run test:design` e `npm run build`.
- Navegador: `npm run test:e2e` com cenários de administrador/visualizador, período, lojas, gráficos, ocorrências e layout em 390, 768 e 1440 pixels, em tema claro e escuro.
- Gate GitHub `verify` exige qualidade, navegador e CodeQL verdes.
- `main` publica automaticamente pela Cloudflare. **Não mesclar sem revisão e autorização explícita.**
- Captura/inspeção visual humana da Preview segue recomendada antes do merge; testes de geometria não substituem avaliação de legibilidade.

## Histórico
- O desenho inicial de 19/10/2026 retirou a tabela redundante Por data.
- Em 28/10/2026, foram incluídos a seleção de várias lojas e o tratamento de Não compareceu.
- A reformulação visual fica separada da produção até aprovação.

## Evolução visual fiel à referência — 29/10/2026 (branch `design/dashboard-gerencial-referencia`)
- Os 7 cartões passam à faixa de indicadores com ícones vetoriais e cores específicas: agendamentos, recebidos, não recebidos, não compareceu, aguardando, recusados e taxa.
- A visão geral apresenta **linha de taxa diária** e **rosca por situação**, calculadas dos `rows` retornados pela API. Valores da imagem não são usados nem versionados.
- O desempenho apresenta o ranking das 5 lojas por taxa e o gráfico de barras empilhadas por situação; fornecedores e padrão semanal continuam disponíveis.
- Detalhamento contém resumos de ocorrências e de últimos agendamentos, além das tabelas completas já existentes, busca, paginação, filtros e comparativo.
- **GET `/api/admin/reports/latest?start=...&end=...&storeCode=...`**: últimos 6 agendamentos ativos, mesmo intervalo de até 93 dias e mesmo filtro multiloja; status `nao_compareceu` calculado para pendências encerradas sem conferência; somente GET para administrador e visualizador. Retorno `{rows:[{date,startTime,storeCode,storeName,supplier,protocol,origin,status,classificationOrigin}]}`.
- Falha específica da consulta de recentes gera mensagem nesse painel, não bloqueia as métricas/ocorrências.
- Nenhum write D1, migration ou dependência adicionada; CSS escopado em `.manager-report` e carregado depois da camada executiva.
- Validação proposta: CI `verify`, CodeQL, Playwright 390/768/1440 em claro e escuro, mock de falha de recentes, integração e inspeção da Preview. A imagem é referência estética, não screenshot real.

