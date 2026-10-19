# Relatório Gerencial — main, 19/10/2026

## Público / permissão
Nova aba **Relatório Gerencial**, em /admin/reports, para administrador e visualizador. O conferente não tem acesso. O visualizador usa apenas métodos GET na allowlist já existente em worker/middleware/auth.js; não é autorizado a cadastrar, editar, importar ou excluir.

## Dados e funcionalidades
Tela nativa em JS puro, HTML e CSS, reaproveitando a API/agrupamentos da preview sem React ou Vite; usa Chart.js local sob demanda, com fallback HTML/CSS. Filtros por data (1–93 dias), loja e comparação com período anterior. KPIs (agendamentos, recebidos, não recebidos, taxa, aguardando em agendas abertas, sem conferência em agendas concluídas, recusados); evolução diária em Chart.js local com alternativa HTML/CSS acessível, comparativo por loja, fornecedores com mais ocorrências; tabelas por loja e ocorrências com observações. Paginação de 50 por página, dados D1 reais.

## API / D1
- GET /api/admin/reports?start=AAAA-MM-DD&end=AAAA-MM-DD&storeCode=...
- GET /api/admin/reports/occurrences?...&limit=50&offset=...
Validação Zod, SQL parametrizado; nenhuma alteração ou migração de schema específica deste relatório. A consulta de motivos usa agendamentos.observacao da migração 0017. A separação entre aguardando e sem conferência é feita em SQL somente de leitura, sem alterar o D1. Veja relatorio-gerencial-sem-conferencia.md para a regra.

## Validação/implantação
Testes: tests/unit/reports.test.js, frontend-core.test.js, visual-shell.test.js, app-contract.test.js. Build copia frontend/styles/manager-reports.css e as bibliotecas locais Lucide/Chart.js. Executar verify:production e confirmar CI + Cloudflare separados.
**Atenção:** erro recorrente 9109 (Cloudflare token inválido) impediu os últimos deploys. Não considerar produção atualizada enquanto o Cloudflare não confirmar que a migração 0017 foi aplicada e o novo Worker entrou no ar. Não mexer em D1 manualmente sem validação.
## Simplificação da interface — 19/10/2026
A tabela detalhada **Por data** foi retirada do Relatório Gerencial por repetir informações operacionais já disponíveis nas agendas. Permanecem os KPIs, a evolução diária, comparativos, indicadores consolidados por loja e ocorrências/observações. O gráfico diário mantém dados por status; endpoints, consultas, agrupamentos, permissões e dados no D1 não foram alterados. O texto alternativo do gráfico, a ajuda contextual e os testes de interface foram atualizados.
