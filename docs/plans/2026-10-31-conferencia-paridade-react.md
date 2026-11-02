# Paridade da Conferência React (31/10/2026)

## Escopo

Fechar as últimas lacunas da tela `/app` (Conferência de recebimentos) do React na
`preview`, alcançando paridade funcional com a interface operacional (`frontend/today.js`):

- Fornecedor sem agenda: criação via `POST /api/store/agenda/:date/manual`, edição e
  remoção (confirmação em duas etapas) via `PATCH/DELETE /api/store/appointments/:id/manual`.
- Observação opcional editável por agendamento (`PATCH /api/store/appointments/:id/observation`),
  com os mesmos motivos padronizados do `shared/observations.js` e "Sem observação" para limpar.
- Exportação PDF da agenda (`downloadAgendaPdf` portado para TypeScript sem dependências,
  mesmo layout e nome de arquivo da versão operacional).
- Detalhes do agendamento com histórico de alterações em dia concluído
  (`GET /api/store/appointments/:id`), substituindo o "Ver detalhes" antigo.
- Rótulo "Não compareceu" para o status automático aplicado ao concluir o dia.
- Cliente realtime da loja (`use-store-realtime.ts`) espelhando o padrão do receiving:
  quando a preview responde `mode: "off"` o hook não conecta e o polling de 30s continua.

Arquivos: `apps/web/src/features/conference/{model.ts, conference-page.tsx,
export-agenda-pdf.ts, use-store-realtime.ts}`. Sem mudanças no Worker, migrations,
wrangler ou `main`.

## Verificação

- `apps/web/tests/conference.spec.mjs` expandido para 13 testes E2E com API mockada:
  métricas/busca, status, motivo obrigatório, fornecedor manual (criar/editar/remover),
  observação opcional (definir/limpar), exportação PDF (evento de download e nome do
  arquivo), detalhes com histórico, "Não compareceu", conclusão do dia, 409, somente
  leitura, sem agenda e responsividade.
