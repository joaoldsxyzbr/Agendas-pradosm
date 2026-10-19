# Ajuda contextual no Relatório Gerencial

## Entrega (19/10/2026)
A nova interface inclui **ícone i** discreto nos seis KPIs e nos seis painéis do relatório, para administrador e visualizador. O tooltip contém explicação curta e específica de cada indicador ou gráfico.

## Interações
- **Mouse:** passar o cursor revela o tooltip.
- **Teclado:** Tab foca o botão e revela o tooltip; Escape fecha a abertura por clique.
- **Celular:** toque abre o tooltip; outro toque ou clique fora fecha.
- **Acessibilidade:** botão com `aria-label`, `aria-controls` e `aria-expanded`, texto com `role="tooltip"`.
- **Responsividade:** tooltip do KPI fica dentro da largura do card; painéis não cortam o balão.
- **Impressão:** ícones ocultos.

## Significado de duas métricas importantes
- **Comparativo por loja:** percentual de agendamentos recebidos em relação ao total da unidade; a barra mostra o percentual.
- **Fornecedores com ocorrências:** quantidade de não recebimentos por fornecedor; a barra é proporcional à quantidade do líder do ranking, não à taxa de recebimento.

## Arquivos e verificação
- `frontend/report-info.js`: textos e comportamento.
- `frontend/reports.js`: inserção nos 12 blocos.
- `frontend/styles/report-info.css`: estilo do ícone e dos tooltips.
- `index.html`, `scripts/build-native.mjs`: carregamento no build.
- `tests/unit/report-info.test.js`: conteúdo, HTML acessível e assets.
- `tests/browser/report-info.spec.js`: hover, foco, toque e fechamento com API mockada.

**Escopo:** apenas front-end; sem mudanças em APIs, Worker, cálculos, permissões ou D1. Confirmar separadamente CI e Cloudflare antes de afirmar que está publicado.