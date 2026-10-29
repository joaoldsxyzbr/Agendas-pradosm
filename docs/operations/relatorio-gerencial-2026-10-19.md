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
