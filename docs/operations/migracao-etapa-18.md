# Etapa 18 — modal administrativo "Ver detalhes"

Branch `migracao-js-puro`, referência `src/admin/AdminAgendaPreview.tsx` da `main`.

- `migration/frontend/admin-agenda-preview.js`: popup modal com estado inicial somente leitura, resumo, busca, lista responsiva e integração WebSocket. Editar exige clicar em **Editar agenda**, preservando permissões de admin/visualizador.
- Atualização de status/trocas usa as rotas originais de `/api/admin/appointments` apenas em modo edição.
- Reabertura de agenda concluída exige `canReopen` e modo edição, com PATCH de status `aberto`.
- `migration/frontend/admin-manual-dialog.js`: adição/edição/exclusão de fornecedores sem agenda, com exclusão direta mediante confirmação; sem mudanças de esquema ou campos exclusivos da preview.
- `tests/migration/admin-preview.test.js`: testes estáticos das salvaguardas do modo edição e dos endpoints.

Os componentes estão **convertidos mas isolados**, não são executados pelo entrypoint publicado. Faltam validar comportamento real, E2E e integração com o roteador da versão JS. Nenhuma alteração em `main`, `preview`, D1 ou produção.
