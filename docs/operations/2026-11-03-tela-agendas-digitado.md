# Tela de Agendas (administração) — marcação "digitado para o conferente"

Data: 2026-11-03.

## Objetivo

Oferecer aos administradores uma tela dedicada às agendas importadas, organizadas por loja,
com uma marcação interna que indica que a agenda da loja já foi digitada/repassada para o conferente.
A tela é exclusiva do papel admin e não muda nada para o conferente.

## Regras

- Rota da tela: `/admin/agendas` (menu "Agendas", visível apenas para admin). Visualizador é redirecionado.
- Dados: `GET /api/admin/agendas?date=...` (mesma consulta do Recebimento), agora com `digitadoEm` e `digitadoPor`.
- Marcação: `PATCH /api/admin/agendas/:id/digitado` com corpo `{ "digitado": true | false }`.
  Persistência em `agendas.digitado_em`/`agendas.digitado_por` (migration 0020).
- Auditoria: ações `agenda_digitada_para_conferente` e `agenda_digitacao_removida` na tabela auditoria.
- Concorrência: atualização com guarda (`digitado_em IS NULL`/`IS NOT NULL`); sem alteração responde 409 CONFLITO_ESTADO.
- A marcação NÃO publica eventos de tempo real e não altera status do dia: invisível para o conferente.
- "Ver agendamentos" reabre o diálogo de detalhe usado no Recebimento (mesma consulta, mesma permissão).

## Histórico

- 2026-11-03: criação da tela com a marcação interna de digitação.
