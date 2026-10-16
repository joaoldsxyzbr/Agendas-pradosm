# Visual Prado Enterprise — preview

**Escopo:** somente branch `preview`, 15/10/2026. Sem alterações à `main`.

## Direção
Layout aprovado mantido, com acabamento inspirado nos princípios de sobriedade do Linear e densidade operacional do IBM Carbon. Identidade própria, sem copiar componentes.

- Fundo grafite `#14161b`, cartões `#202329`, superfícies `#252930`.
- Azul `#79afff` apenas em ações principais, foco e seleção.
- Navegação e campos neutros, divisórias suaves, tipografia coerente.
- KPIs sem barras decorativas coloridas; cores semânticas reservadas aos estados de operação.
- Tabelas compactas, cabeçalhos discretos, modais e formulários consistentes.
- CSS com versão explícita para evitar cache, suporte a responsividade, foco, impressão e movimento reduzido.

## Preservado
HTML/CSS/JavaScript puro; sidebar e disposição das telas; popups; perfis e permissões; endpoints, Worker, D1, regras e dados.

## Refinamento do painel de recebimento (15/10/2026)

- Mantidos JavaScript puro, HTML e CSS, sem novas bibliotecas e sem alteração no Worker ou D1.
- Título, indicadores, filtros e tabela reequilibrados para reduzir áreas vazias e melhorar a hierarquia.
- Quatro KPIs preservados, com marcadores semânticos discretos; navegação e botão Sair refinados.
- Tabela agora distingue **Não recebidos** (não chegaram + recusados) de **Aguardando** (apenas aguardando). A coluna antiga "Pendentes" misturava os conceitos.
- Situação da agenda mostra **Em andamento** ou **Concluída** a partir do estado real do dia; antes o rótulo "Aguardando" podia aparecer com zero agendamentos aguardando.
- Ambiente preview continua explicitamente identificado na barra superior, removendo texto lateral repetido.
- A responsividade e o fluxo dos popups de importação e consulta foram preservados.

## Validação manual pendente
Visualizar os perfis fictícios admin, visualizador e conferente; relatórios, lojas e usuários; abrir popups de importação e agenda; avaliar desktop e celular; validar publicação da preview. CI e deploy devem ser reportados separadamente do commit. Produção exige autorização explícita.
