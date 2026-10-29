# Plano — Dashboard Gerencial próximo da referência visual

Data: 29/10/2026. Base: `main` no commit `4cf51b5`. Branch: `design/dashboard-gerencial-referencia`.

## Objetivo
Evoluir `/admin/reports` para a apresentação corporativa escura da imagem fornecida: KPIs coloridos, taxa em destaque, evolução em linha, distribuição em rosca, ranking de lojas, colunas empilhadas por dia, ocorrências sinalizadas e últimos agendamentos. Preservar acesso do administrador/visualizador e dados reais. A imagem é referência, não fonte de dados nem prova de pixel-perfect.

## Limites e decisões
- JS ES Modules, CSS, Chart.js local, Hono e D1 existentes; sem framework ou dependências novas.
- Frontend: usar `report.rows`, `report.suppliers`, `occurrences.rows`. Nunca usar valores ilustrativos na aplicação.
- A nova lista **Últimos agendamentos** requer um endpoint GET leve, read-only, limitado a 6 e com os mesmos filtros de período e lojas; sem tocar em migrations e sem expor informações fora do escopo admin/visualizador.
- A categoria `Não compareceu` cobre classificações automáticas futuras e pendências legadas de dias concluídos, como no relatório atual. Não misturar com `Não recebidos` manuais.
- Em caso de falha *apenas* da consulta de últimos, a tela principal continua funcionando com estado indisponível visível; outros erros mantêm tratamento atual.
- Temas claro/escuro suportados; escuro em primeiro plano. Preservar controles nativos, fallback HTML e rolagem de tabela em mobile.
- `main`, produção Cloudflare e D1 não serão alterados sem autorização adicional.

## Execução e aceitação
1. `frontend/reports.js`: reorganizar cabeçalho, KPIs, navegação e painéis; construir rosca e barras empilhadas com dados agregados existentes e texto alternativo; conectar lista recente real e preservar filtros, comparação, busca e paginação.
2. `frontend/styles/manager-reports-reference.css` + `index.html`: camada visual isolada, cartões cromáticos, grades de 3/2 colunas, tabela compacta, responsividade em 390/768/1440px e foco visível; verificar conflito de especificidade com `enterprise-gray.css`.
3. `worker/routes/admin-reports.js` + `worker/middleware/auth.js`: endpoint de últimos registros, SQL parametrizado, validação de período/lojas e retorno enxuto. O visualizador permanece GET-only.
4. `tests/unit/reports.test.js` e `tests/browser/reports.spec.js`: confirmar isolamento por filtro, limit=6, data real, diferenças manual/automático, ausência de vazamento, estados vazios e mobile; manter regressões existentes.
5. Documentar em `docs/operations/relatorio-gerencial-2026-10-19.md`; abrir PR para `main` sem mesclar.
6. Validação obrigatória no GitHub: JavaScript/build, Playwright, CodeQL e `verify`; inspecionar Preview. Verificação visual humana da fidelidade ao screenshot permanece pendente até ser realizada.

## Riscos e reversão
- Sem migrations e sem escritas D1. Rollback da UI: não mesclar a branch ou reverter apenas o PR depois de autorização explícita.
- Não alterar permissões de conferente. O endpoint deve ser acessível somente via `requireAuth`, `requireAdmin`, `restrictDashboardViewer`.
- Conferir performance do endpoint: JOIN pelo índice de agenda existente, ordem decrescente e `LIMIT 6`.
