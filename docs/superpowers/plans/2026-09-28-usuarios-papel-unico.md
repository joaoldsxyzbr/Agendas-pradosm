# Usuários com Papel Único Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar admin, conferente e visualizador na tabela `usuarios`, usando `usuarios.papel` como fonte de autorização e removendo a tabela auxiliar `usuario_permissoes` com rollout seguro em produção.

**Architecture:** Fazer uma migração expand/contract em três checkpoints de produção. Primeiro adicionar e preencher `usuarios.papel`, com gatilhos temporários que mantêm compatibilidade com a versão antiga durante o rollout; depois trocar backend + frontend para o novo campo mantendo o esquema antigo apenas como compatibilidade; por último remover os gatilhos, o subsistema de visualizadores e a tabela auxiliar, quando o código já não depender deles. A coluna legada `perfil` permanece fisicamente nesta entrega para evitar reconstruir a tabela `usuarios` em produção, mas deixa de ser fonte de autorização.

**Tech Stack:** Cloudflare Workers, D1/SQLite migrations, Hono, React, TypeScript, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-usuarios-papel-unico-design.md`

## Global Constraints

- Produção é alterada somente pelo repositório `joaoldsxyzbr/Agendas-pradosm`, branch `main`.
- Não alterar bindings, secrets, configuração do D1 ou fluxo de deploy.
- Preservar IDs, logins, hashes de senha, estado ativo/inativo, exclusão lógica e vínculos atuais de loja.
- `papel` aceita exatamente `admin | conferente | visualizador`.
- `conferente` exige `loja_id`; `admin` e `visualizador` usam `loja_id = NULL`.
- `visualizador` continua restrito ao dashboard e somente leitura no backend.
- `conferente` continua restrito à própria loja.
- Não reconstruir a tabela `usuarios` nesta entrega; manter `perfil` apenas como coluna legada de compatibilidade, sincronizada nas escritas (`admin/visualizador -> admin`, `conferente -> loja`) e nunca usada para decidir autorização.
- O deploy atual aplica migrations remotas antes de publicar o Worker; por isso nenhuma migration pode quebrar a versão que ainda está servindo tráfego.
- Aplicar TDD: teste falhando antes de cada alteração de comportamento.
- Cada tarefa termina com um único push coerente para `main` e uma única verificação do CI correspondente ao novo HEAD; se falhar, ler logs antes de corrigir e não fazer polling repetitivo.

## Review Focus

1. **Último administrador ativo:** impedir edição que desative/demita e exclusão do último admin ativo; cobrir em `tests/worker/admin.test.ts`.
2. **Troca para conferente sem loja:** retornar 400 e não alterar o registro; cobrir em `tests/worker/admin.test.ts`.
3. **Troca para admin/visualizador com loja anterior:** limpar `loja_id`; cobrir em `tests/worker/admin.test.ts`.
4. **Visualizador tentando escrita ou cadastro administrativo:** retornar 403 mesmo com chamada direta à API; cobrir em `tests/worker/viewer-access.test.ts`.
5. **Compatibilidade durante rollout:** inserts feitos pelo código antigo entre migration e publicação do Worker recebem o papel correto; cobrir em `tests/worker/database.test.ts`.

---

### Task 1: Expandir o esquema e preencher `usuarios.papel`

**Files:**
- Create: `migrations/0010_user_papel.sql`
- Modify: `tests/worker/database.test.ts`

**Interfaces:**
- Consumes: schema atual com `usuarios.perfil` e `usuario_permissoes.dashboard_somente_leitura`.
- Produces: coluna `usuarios.papel` preenchida para todos os usuários existentes; tabela auxiliar continua intacta; gatilhos temporários mantêm o código antigo compatível até a Task 2.

- [ ] **Step 1: Write the failing migration tests**

Adicionar testes que apliquem todas as migrations e afirmem:

```ts
expect(columns).toContain("papel");
expect(admin.papel).toBe("admin");
expect(conferente.papel).toBe("conferente");
expect(visualizador.papel).toBe("visualizador");
expect(admin.senha_hash).toBe(originalAdminHash);
expect(visualizador.id).toBe(originalViewerId);
expect(usuarioPermissoesTableExists).toBe(true);
```

Adicionar também um teste que simule os writes da versão antiga:

- inserir usuário com `perfil = 'loja'` sem informar `papel` e esperar `papel = 'conferente'`;
- inserir usuário com `perfil = 'admin'` sem informar `papel` e esperar `papel = 'admin'`;
- inserir a permissão `dashboard_somente_leitura = 1` para esse admin e esperar `papel = 'visualizador'`.

Verificar ainda que `papel` rejeita valores fora de `admin | conferente | visualizador`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/worker/database.test.ts`

Expected: FAIL porque `usuarios.papel` ainda não existe.

- [ ] **Step 3: Create `migrations/0010_user_papel.sql`**

Implementar migração aditiva:

- adicionar `papel TEXT NOT NULL DEFAULT 'conferente'` com CHECK dos três valores;
- preencher `conferente` para linhas com `perfil = 'loja'`;
- preencher `visualizador` para linhas `perfil = 'admin'` presentes em `usuario_permissoes` com `dashboard_somente_leitura = 1`;
- preencher `admin` para os demais `perfil = 'admin'`;
- criar gatilho temporário `trg_usuarios_legacy_papel` para inserts da versão antiga: `perfil = 'loja' -> conferente`, `perfil = 'admin' -> admin`;
- criar gatilho temporário `trg_usuario_permissoes_legacy_visualizador` para converter para `visualizador` quando a versão antiga inserir `dashboard_somente_leitura = 1`;
- não remover `usuario_permissoes`;
- não alterar `senha_hash`, `id`, `loja_id`, `ativo`, `excluido_em` ou timestamps.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npm test -- tests/worker/database.test.ts`

Expected: PASS.

- [ ] **Step 5: Run task verification**

Run: `npm run typecheck && npm run build`

Expected: exit 0.

- [ ] **Step 6: Commit/push Task 1**

Commit message: `feat: adicionar papel aos usuários`

Push directly to `main`.

- [ ] **Step 7: Check CI once for this HEAD**

Inspect the CI run created by the Task 1 commit exactly once after it has had time to execute. If completed successfully, mark Task 1 `[x]`. If failed, inspect failed job/logs, fix only the supported cause, then validate the replacement HEAD.

---

### Task 2: Trocar aplicação inteira para `papel` e unificar CRUD

**Files:**
- Modify: `shared/auth.ts`
- Modify: `shared/api.ts`
- Modify: `worker/repositories/users.ts`
- Modify: `worker/routes/admin-users.ts`
- Modify: `worker/routes/auth.ts`
- Modify: `worker/middleware/auth.ts`
- Modify: `worker/app.ts`
- Modify: `src/admin/types.ts`
- Modify: `src/admin/UsersPage.tsx`
- Modify: `src/admin/UserEditDialog.tsx`
- Modify: `src/admin/AdminLayout.tsx`
- Modify: `src/admin/DashboardPage.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/worker/admin.test.ts`
- Modify: `tests/worker/auth.test.ts`
- Modify: `tests/worker/viewer-access.test.ts`
- Modify: `tests/ui/admin-users.test.tsx`
- Modify: `tests/ui/dashboard-viewer.test.tsx`
- Modify: `tests/ui/admin-navigation.test.tsx`

**Interfaces:**
- Consumes: `usuarios.papel: "admin" | "conferente" | "visualizador"` criado pela Task 1.
- Produces:
  - `type UserRole = "admin" | "conferente" | "visualizador"`;
  - `AuthUser.papel: UserRole`;
  - `AdminUser.papel: UserRole`;
  - `listUsers(db): Promise<UserRecord[]>`;
  - `createUser(db, input, actorUserId): Promise<UserRecord>`;
  - `updateUser(db, current, input, actorUserId): Promise<UserRecord>`;
  - `softDeleteUser(db, current, actorUserId): Promise<boolean>`;
  - `GET/POST/PATCH/DELETE /api/admin/users` como único CRUD usado pela nova interface.

- [ ] **Step 1: Write failing backend tests**

Em `tests/worker/admin.test.ts`, cobrir:

```ts
expect(list).toEqual(expect.arrayContaining([
  expect.objectContaining({ papel: "admin", lojaId: null }),
  expect.objectContaining({ papel: "conferente" }),
  expect.objectContaining({ papel: "visualizador", lojaId: null }),
]));
```

Adicionar criação dos três papéis, troca de papel, exigência de loja para conferente, limpeza de loja para admin/visualizador, proteção contra desativar/demitir/excluir o último admin ativo e preservação do hash quando a senha não é alterada.

Em `tests/worker/auth.test.ts`, login/`/me` deve retornar `papel` diretamente, sem depender de `acesso`.

Em `tests/worker/viewer-access.test.ts`, criar o visualizador via `POST /api/admin/users` com `papel: "visualizador"` e afirmar GETs permitidos + 403 para escritas e rotas administrativas proibidas.

- [ ] **Step 2: Run backend tests and verify RED**

Run: `npm test -- tests/worker/admin.test.ts tests/worker/auth.test.ts tests/worker/viewer-access.test.ts`

Expected: FAIL porque CRUD/auth ainda usam `perfil` + tabela auxiliar.

- [ ] **Step 3: Implement shared types and schemas**

Em `shared/auth.ts`:

```ts
export type UserRole = "admin" | "conferente" | "visualizador";
```

`AuthUser` passa a expor `papel: UserRole`. Remover a necessidade lógica de `UserAccess`.

Em `shared/api.ts`, os schemas de criação/edição de usuário passam a aceitar `papel`; `lojaId` é obrigatório somente para conferente.

- [ ] **Step 4: Implement unified repository**

Em `worker/repositories/users.ts`:

- incluir `papel` no `UserRecord` e `USER_COLUMNS`;
- `hasAdmin` consulta `papel = 'admin'`;
- bootstrap cria `papel = 'admin'`;
- substituir funções específicas de loja por `listUsers`, `createUser`, `updateUser`, `softDeleteUser`;
- ao gravar, manter `perfil` legado sincronizado:
  - `conferente -> loja`;
  - `admin/visualizador -> admin`;
- limpar `loja_id` para admin/visualizador;
- exigir loja válida para conferente;
- preservar hash quando senha não mudar;
- registrar `papel` antes/depois na auditoria;
- impedir exclusão, desativação ou troca de papel do último admin ativo;
- enquanto `usuario_permissoes` existir, mantê-la sincronizada apenas para compatibilidade com a rota legada: inserir/garantir linha para `visualizador` e remover a linha ao sair de `visualizador`;
- nunca ler `usuario_permissoes` para decidir autorização.

- [ ] **Step 5: Implement unified admin route**

Em `worker/routes/admin-users.ts`:

- GET lista todos os usuários não excluídos;
- POST/PATCH validam `papel`;
- conferente exige loja válida;
- admin/visualizador ignoram/limpam loja;
- DELETE usa exclusão lógica unificada;
- resposta JSON usa `papel`, não `perfil`.

Manter `/api/admin/viewers` existente neste checkpoint apenas como compatibilidade temporária; a nova interface não o utiliza.

- [ ] **Step 6: Switch authentication and middleware**

Em `worker/routes/auth.ts` e `worker/middleware/auth.ts`:

- login e `/me` retornam `papel`;
- remover consultas a `getUserAccess`;
- acesso à área administrativa aceita `admin` e `visualizador`;
- visualizador continua limitado aos GETs do dashboard;
- conferente não entra em rotas administrativas.

Em `worker/app.ts`, manter o middleware de restrição somente leitura, agora baseado em `papel === "visualizador"`.

- [ ] **Step 7: Run backend tests and verify GREEN**

Run: `npm test -- tests/worker/admin.test.ts tests/worker/auth.test.ts tests/worker/viewer-access.test.ts`

Expected: PASS.

- [ ] **Step 8: Write failing UI tests**

Em `tests/ui/admin-users.test.tsx`, afirmar:

- seletor `Papel` no cadastro;
- `Loja` aparece/é exigida somente para conferente;
- tabela única com colunas Nome, Login, Loja, Papel, Situação;
- admin, conferente e visualizador na mesma tabela;
- ausência da seção “Visualizadores do dashboard”;
- modal único permite trocar papel e loja conforme regra.

Em `tests/ui/dashboard-viewer.test.tsx` e `tests/ui/admin-navigation.test.tsx`, mocks de autenticação usam `papel: "visualizador"` e mantêm dashboard somente leitura/navegação limitada.

- [ ] **Step 9: Run UI tests and verify RED**

Run: `npm run test:ui -- tests/ui/admin-users.test.tsx tests/ui/dashboard-viewer.test.tsx tests/ui/admin-navigation.test.tsx`

Expected: FAIL porque a UI ainda possui painel separado e usa `perfil/acesso`.

- [ ] **Step 10: Implement unified Users UI**

Em `src/admin/types.ts`, `AdminUser` passa a usar `papel` e `lojaId: string | null`.

Em `src/admin/UsersPage.tsx`:

- remover import/render de `DashboardViewersPanel`;
- adicionar seletor de Papel;
- mostrar Loja somente quando papel for Conferente;
- carregar todos via `/api/admin/users`;
- renderizar coluna Papel com rótulos Administrador, Conferente, Visualizador;
- Loja = `—` para admin/visualizador.

Em `src/admin/UserEditDialog.tsx`:

- editar os três papéis;
- aplicar regra condicional de loja;
- manter alteração opcional de senha, ativo/inativo e exclusão lógica.

- [ ] **Step 11: Switch role checks in app shell**

Em `src/App.tsx`, `src/admin/AdminLayout.tsx` e `src/admin/DashboardPage.tsx`:

- `visualizador` entra no dashboard administrativo em read-only;
- `admin` mantém todas as telas;
- `conferente` mantém fluxo de loja;
- não usar `acesso` como fonte de decisão.

- [ ] **Step 12: Run UI tests and verify GREEN**

Run: `npm run test:ui -- tests/ui/admin-users.test.tsx tests/ui/dashboard-viewer.test.tsx tests/ui/admin-navigation.test.tsx`

Expected: PASS.

- [ ] **Step 13: Run Task 2 full local verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: todos os testes passam, typecheck sem erros, build exit 0.

- [ ] **Step 14: Commit/push Task 2**

Commit message: `feat: unificar usuários por papel`

Push directly to `main`.

- [ ] **Step 15: Check CI once for this HEAD**

Inspect the CI run corresponding to Task 2 once. Só avançar para a Task 3 depois de CI verde, pois a Task 3 removerá compatibilidade usada pela versão anterior.

---

### Task 3: Contrair o esquema e remover o subsistema legado de visualizadores

**Files:**
- Create: `migrations/0011_drop_usuario_permissoes.sql`
- Delete: `worker/repositories/viewers.ts`
- Delete: `worker/routes/admin-viewers.ts`
- Delete: `src/admin/DashboardViewersPanel.tsx`
- Modify: `worker/app.ts`
- Modify: `tests/worker/database.test.ts`
- Modify: `tests/worker/viewer-access.test.ts`
- Modify: `tests/ui/admin-users.test.tsx`

**Interfaces:**
- Consumes: Task 2 em produção, sem qualquer leitura de autorização em `usuario_permissoes`; a tabela e a rota legada existem apenas para compatibilidade.
- Produces: somente `usuarios.papel` representa papel/autorização; tabela, gatilhos e rotas auxiliares deixam de existir.

- [ ] **Step 1: Write failing cleanup tests**

Em `tests/worker/database.test.ts`, mudar a expectativa final para:

```ts
expect(usuarioPermissoesTableExists).toBe(false);
expect(legacyTriggersExist).toBe(false);
```

Em `tests/worker/viewer-access.test.ts`, afirmar que `/api/admin/viewers` não é mais uma superfície funcional e que todo gerenciamento usa `/api/admin/users`.

Em `tests/ui/admin-users.test.tsx`, manter a asserção de ausência do painel separado.

- [ ] **Step 2: Run cleanup tests and verify RED**

Run: `npm test -- tests/worker/database.test.ts tests/worker/viewer-access.test.ts && npm run test:ui -- tests/ui/admin-users.test.tsx`

Expected: FAIL enquanto tabela/rota/gatilhos/arquivo legado existirem.

- [ ] **Step 3: Add contract migration**

Criar `migrations/0011_drop_usuario_permissoes.sql`:

- `DROP TRIGGER IF EXISTS trg_usuarios_legacy_papel`;
- `DROP TRIGGER IF EXISTS trg_usuario_permissoes_legacy_visualizador`;
- `DROP TABLE usuario_permissoes`.

Não alterar `usuarios`, dados de agenda, lojas, auditoria ou históricos.

- [ ] **Step 4: Remove legacy code**

- remover registro de `adminViewerRoutes` de `worker/app.ts`;
- excluir `worker/routes/admin-viewers.ts`;
- excluir `worker/repositories/viewers.ts`;
- excluir `src/admin/DashboardViewersPanel.tsx`;
- remover imports remanescentes;
- remover do repositório de usuários a sincronização temporária com `usuario_permissoes`;
- confirmar por busca nativa no repositório que não há referência funcional a `usuario_permissoes`, `adminViewerRoutes`, `DashboardViewersPanel` ou `getUserAccess`.

- [ ] **Step 5: Run cleanup tests and verify GREEN**

Run: `npm test -- tests/worker/database.test.ts tests/worker/viewer-access.test.ts && npm run test:ui -- tests/ui/admin-users.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run final full verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: 0 failures, typecheck sem erros, build exit 0.

- [ ] **Step 7: Commit/push Task 3**

Commit message: `refactor: remover permissões auxiliares de usuários`

Push directly to `main`.

- [ ] **Step 8: Check CI once for final HEAD**

Inspect exactly one CI run for this HEAD. If green, mark Task 3 `[x]` and finish. If red, inspect failure evidence and correct only what the logs support.

## Final Acceptance Checklist

- [ ] Existe somente um CRUD administrativo de usuários.
- [ ] Admin, conferente e visualizador aparecem na mesma tabela da UI.
- [ ] `usuarios.papel` é a fonte de autorização.
- [ ] Visualizador continua somente leitura no backend.
- [ ] Conferente continua restrito à própria loja.
- [ ] Último administrador não pode ser removido, desativado ou demitido acidentalmente.
- [ ] IDs, hashes de senha e estado dos usuários existentes foram preservados.
- [ ] `usuario_permissoes` e os gatilhos temporários foram removidos somente depois da aplicação já estar usando `papel`.
- [ ] `/api/admin/viewers`, `worker/repositories/viewers.ts`, `worker/routes/admin-viewers.ts` e `DashboardViewersPanel.tsx` foram removidos.
- [ ] A coluna legada `perfil` não participa de autorização e permanece apenas para evitar reconstrução arriscada da tabela nesta entrega.
- [ ] CI final está verde.
