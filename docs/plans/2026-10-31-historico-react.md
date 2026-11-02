# Modernização React — Histórico (Preview, 31/10/2026)

## Escopo

A rota administrativa `/admin/history` no frontend React substitui o placeholder por uma tela funcional, mantendo o frontend atual acessível na Preview. A mudança **não altera** o Worker, D1, migrations, variáveis, sessão ou qualquer configuração de produção.

- Consulta de agendas por loja e data (`GET /api/admin/agendas?storeCode=&date=`) somente após filtrar, como na tela legada.
- Listagem com data, loja, total, aguardando, recebidos e status do dia; cartões no celular e tabela no desktop para evitar rolagem horizontal do documento.
- Detalhe da agenda com agendamentos, horário, protocolo, fornecedor, status e trocas, reutilizando os endpoints administrativos já migrados do Recebimento.
- Alteração de status e trocas com motivo obrigatório para Não recebido (mesmos motivos de `shared/observations.js`), sem gravação antes da confirmação; erro 409 exibido sem atualização otimista.
- Reabertura de dia concluído (`PATCH /api/admin/agendas/:id/status`), histórico do dia (`GET /api/admin/agendas/:id/history`) e histórico de status por agendamento (`GET /api/admin/appointments/:id/history`) sob demanda.
- Invalidação de caches após mutações efetivas; indicadores de carregamento, erro, vazio e tentativa novamente.
- Permissão exclusiva de administrador pela sessão e no Worker.

## Verificação

Testes E2E com dados sintéticos: consulta por filtros, abertura de detalhe, motivo obrigatório e cancelamento, alteração direta de status e trocas, reabertura de dia, histórico de status, conflito 409, falha de listagem com retry, perfil visualizador bloqueado e cartões no celular sem overflow. CI completo é obrigatório para merge na `preview`. Testar manualmente login real e estilos hospedados antes de substituir o frontend anterior. Não mexer na `main`.
