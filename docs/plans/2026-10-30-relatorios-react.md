# Relatório Gerencial React — Preview (30/10/2026)

## Escopo implementado

- Rota `/admin/reports` substitui o placeholder somente na interface React `/modern/` da Preview; a interface legada `/login` permanece disponível.
- Consome exclusivamente os endpoints existentes `/api/admin/reports`, `/latest`, `/occurrences` e `/api/admin/stores`; dados consolidados vêm do Worker e não de fixtures na aplicação.
- Períodos rápidos de 7, 30, 90 dias e mês atual; datas de negócio em `America/Sao_Paulo`; intervalo máximo de 93 dias; múltiplas lojas; comparação com período anterior equivalente.
- Indicadores: taxa, agendamentos, recebidos, não recebidos, não compareceu, aguardando, recusados e sem agenda.
- Evolução diária com alternância volume/taxa, distribuição por status, ranking e detalhamento por loja, fornecedores com ocorrências.
- Ocorrências com busca por fornecedor/protocolo e paginação; agendamentos recentes por data de entrega e paginação.
- Estados de carregamento, erro, período vazio, retry, navegação por teclado e tabela com rolagem horizontal contida.
- Somente leitura para administrador e visualizador; autorização definitiva continua no Worker.

## Verificações e limites

- Testes Playwright com respostas sintéticas da API validam filtros, métricas, navegação, erro/retry, paginação e layout móvel.
- Não alterar Worker, schema, migrations, D1, autenticação, sessões, WebSocket ou config de produção.
- A versão React usa a estrutura visual compacta já implantada na Preview, e não deve ser declarada visualmente equivalente antes de homologação humana.
- Permanecem para a modernização completa: Histórico, Lojas, Usuários, Diagnósticos e Tags; fluxos complementares do Conferente e revisão visual final.
- A publicação depende do CI do PR para `preview`, do merge controlado e do build automatizado da Cloudflare. Não propor `main`.
