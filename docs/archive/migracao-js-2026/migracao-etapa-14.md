# Migração JS puro — etapa 14: Usuários

Data: 18/10/2026. Branch `migracao-js-puro`.

Implementação de `src/admin/UsersPage.tsx` e `src/admin/UserEditDialog.tsx` da `main`, mantendo a mesma ordem de campos, classes CSS e regras:

- `migration/frontend/users.js`: usuários, lojas, filtro por nome/login/loja, papel, situação, ordenação original da API, contadores e tabela Nome → Login → Loja → Papel → Situação → Ações.
- `migration/frontend/user-dialog.js`: cadastro de usuário, edição de nome/login/papel/loja, senha inicial de ao menos 12 caracteres, senha opcional na edição e confirmação ao ativar ou desativar. Formulários continuam usando `POST/PATCH /api/admin/users`. Nenhuma exclusão destrutiva.
- `migration/frontend/audit-trail.js`: histórico de alterações reutilizável (API `/api/admin/audit`), nomes e detalhes escapados com segurança, carregamento sob demanda.
- `tests/migration/users.test.js`: contratos de filtros, payloads, status, ordem das colunas e auditoria.

Verificações isoladas da filtragem e da geração de payloads passaram. **Testes Node/E2E, comparação visual e ativação do frontend completo continuam pendentes**. O componente não é servido pelo entrypoint da aplicação. Nenhuma mudança de banco, Worker em produção, `main` ou `preview`.