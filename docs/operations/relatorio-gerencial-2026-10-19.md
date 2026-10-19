# Relatório Gerencial — main, 19/10/2026

## Público / permissão
Nova aba **Relatório Gerencial**, em /admin/reports, para administrador e visualizador. O conferente não tem acesso. O visualizador usa apenas métodos GET na allowlist já existente em worker/middleware/auth.js; não é autorizado a cadastrar, editar, importar ou excluir.

## Dados e funcionalidades
Tela nativa em JS puro, HTML e CSS, reaproveitando a API/agrupamentos da preview sem dependência React, Vite ou Chart.js. Filtros por data (1–93 dias), loja e comparação com período anterior. KPIs (agendamentos, recebidos, não recebidos, taxa, aguardando, recusados); evolução diária com gráfico HTML/CSS acessível, comparativo por loja, fornecedores com mais ocorrências; tabelas por loja, por data e ocorrências com observações. Paginação de 50 por página, dados D1 reais.

## API / D1
- GET /api/admin/reports?start=AAAA-MM-DD&end=AAAA-MM-DD&storeCode=...
- GET /api/admin/reports/occurrences?...&limit=50&offset=...
Validação Zod, SQL parametrizado; nenhuma alteração ou migração de schema específica deste relatório. A consulta de motivos usa agendamentos.observacao introduzido na migração 0017 (pendente do deploy anterior).

## Validação/implantação
Testes: tests/migration/reports.test.js, frontend-core.test.js, visual-shell.test.js, app-contract.test.js. Build copia src/manager-reports.css. Executar verify:production e confirmar CI + Cloudflare separados.
**Atenção:** erro recorrente 9109 (Cloudflare token inválido) impediu os últimos deploys. Não considerar produção atualizada enquanto o Cloudflare não confirmar que a migração 0017 foi aplicada e o novo Worker entrou no ar. Não mexer em D1 manualmente sem validação.
