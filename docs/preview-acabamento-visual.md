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

## Relatórios completos em HTML, CSS e JavaScript puro — 16/10/2026

- Recuperados os **seis KPIs** da antiga preview: agendamentos, recebidos, não recebidos, taxa de recebimento, aguardando e recusados.
- Recuperada a **evolução diária empilhada** com os quatro status e a **comparação por loja** com taxa, barras e quantidades.
- Ranking de fornecedores com barras proporcionais, comparação com período anterior ativada inicialmente e aviso de agendas em aberto.
- Mantidas e enriquecidas tabelas por loja, por data, observações e paginação de ocorrências.
- A API existente já fornece esses valores: **nenhuma alteração de API, Worker, dados ou migração D1**.
- Agregações extraídas para `public/vanilla/reports.js` (ES Module nativo), com testes em `tests/ui/reports.test.js`.
- Mantidos filtros por loja/data (máximo 93 dias), popups, autenticação e tema grafite.
- Publicação na Cloudflare, resultado do CI e inspeção no navegador devem ser confirmados separadamente; não confundir commit com deploy.

## Remoção da exportação dos relatórios — 16/10/2026

- Por solicitação, removido o botão **Exportar CSV** exclusivamente da página Relatórios na `preview`.
- Retirados o manipulador e a função de exportação sem uso, mantendo a importação CSV/PDF de agendas e todos os gráficos, filtros e tabelas de relatório.
- Testes E2E alinhados à ausência do botão; entrada JS versionada para evitar cache antigo. Produção não alterada.

## Avisos temporários — 16/10/2026

- Todos os avisos da interface (`tell`, em `public/vanilla/live.js`) desaparecem automaticamente: **3 segundos** para sucesso e **5 segundos** para erro.
- Um novo aviso cancela o temporizador anterior e reinicia o prazo, evitando que um alerta antigo esconda o atual.
- O conteúdo e a classe do toast são removidos quando o prazo termina; layout, login, Worker, D1 e produção não foram modificados.
- O arquivo de entrada recebeu versão para evitar carregar JavaScript em cache após a publicação na `preview`.
