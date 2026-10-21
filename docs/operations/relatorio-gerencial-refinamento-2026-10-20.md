# Refinamento visual do Relatório Gerencial — 20/10/2026

## Escopo e decisões
Alterações exclusivamente na branch `testes` do repositório `joaoldsxyzbr/Agendas-pradosm`.

- Estrutura em três partes: **Visão geral**, **Desempenho** e **Detalhamento**.
- Bloco de filtros com períodos rápidos, datas, loja e comparação.
- Hierarquia dos sete KPIs e aprimoramento de painéis, tabelas e responsividade.
- Atalhos rápidos ancorados na data operacional atual, mesmo após consulta a datas antigas.
- Preservados contratos da API, permissões, métricas, gráficos, tooltips, busca e paginação.

## Ambientes
- `main`: Worker `agendas-pradosm` e D1 de produção.
- `testes`: Preview do mesmo Worker e D1 `agendas-pradosm-teste`.
- URL atual de testes: https://testes.agendaspradosm.joaolds.xyz.br
- `SESSION_SECRET` exclusivo do Preview `testes` foi configurado na Cloudflare em 20/10/2026, sem armazenar o valor no GitHub nem compartilhar o segredo de produção.
- Worker `agendas-pradosm-preview` e build associado à antiga branch `preview` foram excluídos na Cloudflare; bancos antigos foram preservados. URL antiga `preview.agendaspradosm.joaolds.xyz.br` não é mais utilizada.

## Verificações
Os testes de navegador verificam os títulos das novas seções, a presença dos sete KPIs, os recursos existentes e o retorno dos atalhos rápidos à data atual após filtro antigo. Os dois fluxos de CI do commit `bd42c2e` e o deploy do Preview passaram. Confirmação via API: D1 isolado e binding `SESSION_SECRET` disponível. O login com usuários existentes ainda precisa ser validado manualmente antes de promover à produção.