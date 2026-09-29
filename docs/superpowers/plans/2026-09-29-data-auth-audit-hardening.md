# Data, Authentication and Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar inconsistências de código de loja, revogar sessões após troca de senha e tornar ações privilegiadas e ajustes de dia concluído auditáveis.

**Architecture:** Usar migrations aditivas 0014 e 0015, manter compatibilidade com dados legados via `COLLATE NOCASE`, versionar tokens de sessão e mover o histórico de ajustes para o mesmo `D1Database.batch()` das mutações.

**Tech Stack:** Hono, Cloudflare D1, Wrangler, TypeScript, Zod e Vitest Workers.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`.

## Global Constraints

- Executar somente depois de o fluxo de deploy da Delivery 1 estar comprovado.
- Não introduzir migration destrutiva.
- Não reescrever códigos históricos de loja nesta entrega.
- Não alterar PBKDF2-SHA256 nem 100.000 iterações.
- Não assumir atomicidade fora de `D1Database.batch()`.
- Exigir CI e CodeQL verdes antes do merge.

## Review Focus

- Loja legada `f03` deve ser encontrada por importação `F03`.
- `F03` e `f03` não podem coexistir após a migration 0014.
- Cookie antigo deve morrer após troca de senha.
- Bootstrap de emergência não pode promover/resetar conta existente silenciosamente.
- Falha no histórico de ajuste deve reverter a mutação do dia concluído.

---


### Task 4: Canonicalizar código de loja e garantir unicidade case-insensitive

**Files:**
- Create: `shared/store.ts`
- Create: `migrations/0014_store_code_nocase.sql`
- Modify: `shared/api.ts`
- Modify: `shared/agenda.ts`
- Modify: `worker/repositories/agendas.ts`
- Modify: `worker/routes/admin-stores.ts`
- Modify: `tests/worker/database.test.ts`
- Modify: `tests/worker/admin.test.ts`
- Modify: `tests/worker/import.test.ts`

**Interfaces:**
- Produces: `normalizeStoreCode(value: string): string`.
- Produces: unicidade D1 por `codigo COLLATE NOCASE`.

- [ ] **Step 1: Escrever teste da normalização da API**

Criar caso que envia `codigo: " f03 "` e espera persistência/resposta `F03`.

- [ ] **Step 2: Escrever teste de compatibilidade legada**

Semear diretamente uma loja `f04` e importar agenda com `F04`.

Expected: a importação encontra a mesma loja.

- [ ] **Step 3: Escrever teste de unicidade case-insensitive**

No D1 local:
- inserir `F05`;
- tentar inserir `f05`;
- esperar erro de unicidade.

- [ ] **Step 4: Rodar os testes e confirmar falhas**

Run: `npm run test:worker`

Expected: os novos casos falham no estado atual.

- [ ] **Step 5: Implementar normalização compartilhada**

Criar:

`normalizeStoreCode(value: string): string`

Regra exata: `trim().toUpperCase()`.

Usar no cadastro/edição e na importação.

- [ ] **Step 6: Manter compatibilidade com códigos legados**

Em consultas por código, usar comparação `COLLATE NOCASE` para não exigir atualização imediata de dados antigos.

- [ ] **Step 7: Adicionar migration aditiva**

`0014_store_code_nocase.sql` cria índice único case-insensitive em `lojas(codigo COLLATE NOCASE)`.

Antes do deploy remoto, executar preflight de duplicatas case-insensitive e exigir zero resultados.

Não reescrever códigos históricos nesta tarefa.

- [ ] **Step 8: Ajustar mapeamento de conflito**

`isDuplicateCode()` deve reconhecer tanto a constraint legada quanto o novo índice NOCASE e continuar retornando 409.

- [ ] **Step 9: Rodar verificação**

Run:
- `npm run test:worker`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add shared/store.ts shared/api.ts shared/agenda.ts migrations/0014_store_code_nocase.sql worker/repositories/agendas.ts worker/routes/admin-stores.ts tests/worker
git commit -m "fix: canonicalize store codes"
```

### Task 5: Revogar sessões quando a senha mudar

**Files:**
- Create: `migrations/0015_user_session_version.sql`
- Modify: `worker/lib/session.ts`
- Modify: `worker/repositories/users.ts`
- Modify: `worker/middleware/auth.ts`
- Modify: `worker/routes/auth.ts`
- Modify: `tests/worker/auth.test.ts`
- Modify: `tests/worker/admin.test.ts`
- Modify test helpers that call `createSessionToken`

**Interfaces:**
- Produces: `SessionPayload = { userId: string; sessionVersion: number; exp: number }`.
- Produces: `createSessionToken(userId: string, sessionVersion: number, secret: string, nowMs?: number): Promise<string>`.

- [ ] **Step 1: Escrever teste de revogação**

Fluxo:
- criar usuário;
- autenticar e guardar cookie;
- administrador redefine a senha;
- chamar `/api/auth/me` com cookie antigo;
- esperar 401.

- [ ] **Step 2: Escrever teste de nova sessão**

Após a redefinição:
- login com nova senha retorna 200;
- novo cookie acessa `/api/auth/me`.

- [ ] **Step 3: Rodar testes e confirmar falha**

Run: `npm run test:worker`

Expected: cookie antigo ainda é aceito no estado atual.

- [ ] **Step 4: Adicionar migration de versão de sessão**

`0015_user_session_version.sql`:

- adiciona `session_version INTEGER NOT NULL DEFAULT 1` em `usuarios`;
- não altera registros operacionais além do default compatível.

- [ ] **Step 5: Versionar o token**

Adicionar `sessionVersion` ao payload e assinatura de criação.

Atualizar todos os helpers de teste explicitamente; não criar fallback silencioso para versão ausente.

- [ ] **Step 6: Validar versão no middleware**

A sessão só é válida quando:
- assinatura e expiração são válidas;
- usuário continua válido;
- `payload.sessionVersion === user.session_version`.

- [ ] **Step 7: Incrementar versão em troca de senha**

Toda alteração real de `senha_hash` via repositório deve incrementar `session_version` no mesmo update/batch.

Mudança apenas de nome, login, papel, loja ou status não precisa invalidar por versão porque o middleware relê essas propriedades a cada request.

- [ ] **Step 8: Rodar testes**

Run:
- `npm run test:worker`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add migrations/0015_user_session_version.sql worker/lib/session.ts worker/repositories/users.ts worker/middleware/auth.ts worker/routes/auth.ts tests/worker
git commit -m "security: revoke sessions after password changes"
```

### Task 6: Restringir e tornar auditável o bootstrap administrativo de emergência

**Files:**
- Modify: `scripts/bootstrap-admin.mjs`
- Modify: `README.md`
- Modify: `docs/operations/production-release.md`
- Add focused script test if the current structure permits deterministic CLI stubbing

**Interfaces:**
- Produces: bootstrap CLI create-only, sem promoção/upsert silencioso de conta existente.
- Produces: ação de auditoria `admin_provisionado_emergencia`.

- [ ] **Step 1: Remover semântica de upsert**

O script deve abortar quando `ADMIN_LOGIN` já existir.

Não pode:
- redefinir senha de usuário existente;
- promover papel existente;
- reativar conta existente.

- [ ] **Step 2: Restringir uso**

Antes de criar, verificar que não existe administrador ativo e não removido.

Se existir, abortar e orientar uso do CRUD normal.

- [ ] **Step 3: Registrar auditoria**

Depois da criação bem-sucedida, inserir `auditoria` com:
- `acao = 'admin_provisionado_emergencia'`;
- `entidade = 'usuario'`;
- `entidade_id = novo id`;
- detalhes explícitos de operação break-glass.

Não afirmar atomicidade para o CLI se a documentação oficial do comando usado não a garantir.

- [ ] **Step 4: Verificar a auditoria**

O script só termina com sucesso depois de confirmar que o registro correspondente existe.

- [ ] **Step 5: Documentar limitação e uso**

README/runbook deve deixar claro:
- é break-glass;
- não é fluxo normal de gestão de usuários;
- não substitui o bootstrap web inicial nem o CRUD autenticado;
- deve ser executado somente quando não houver admin ativo.

- [ ] **Step 6: Rodar validações**

Run:
- `node scripts/bootstrap-admin.mjs` apenas contra ambiente local/teste controlado;
- `npm test`;
- `npm run typecheck`.

Expected: nenhuma escrita em D1 remoto durante teste.

- [ ] **Step 7: Commit**

```bash
git add scripts/bootstrap-admin.mjs README.md docs/operations/production-release.md
git commit -m "security: restrict emergency admin bootstrap"
```

### Task 7: Tornar ajustes de dia concluído atomicamente auditáveis

**Files:**
- Modify: `worker/repositories/agendas.ts`
- Modify: `worker/routes/admin-agendas.ts`
- Modify: `tests/worker/import.test.ts` or the focused admin agenda test file
- Remove: helper de rota `recordClosedDayAdjustment` when no longer needed

**Interfaces:**
- Produces: mutação operacional + `historico_agenda.ajuste_admin` no mesmo `db.batch()` quando feita por admin em agenda concluída.

- [ ] **Step 1: Escrever teste de rollback para status**

Criar trigger de teste que falha em `historico_agenda` para `ajuste_admin`.

Alterar status de agendamento em agenda concluída como admin.

Expected:
- resposta de erro;
- status original preservado;
- auditoria principal não fica parcial.

- [ ] **Step 2: Escrever o mesmo contrato para trocas e fornecedor manual**

Cobrir:
- alteração de trocas;
- edição de fornecedor manual;
- remoção de fornecedor manual.

- [ ] **Step 3: Rodar testes e confirmar a falha atual**

Run: `npm run test:worker`

Expected: pelo menos o cenário de status/trocas demonstra mutação antes do histórico secundário.

- [ ] **Step 4: Criar statement reutilizável de ajuste**

Em `worker/repositories/agendas.ts`, criar helper interno que retorna `D1PreparedStatement` para `historico_agenda` com `acao = 'ajuste_admin'`.

- [ ] **Step 5: Incluir o statement no batch da mutação**

Status, trocas e operações manuais de admin devem acrescentar o statement ao mesmo `db.batch()` apenas quando a agenda já estiver concluída.

Rotas de conferente continuam sem esse evento.

- [ ] **Step 6: Remover gravação posterior da rota**

Eliminar `recordClosedDayAdjustment()` e chamadas separadas em `admin-agendas.ts`.

- [ ] **Step 7: Rodar testes**

Run:
- `npm run test:worker`
- `npm run typecheck`

Expected: PASS, incluindo rollback forçado.

- [ ] **Step 8: Commit**

```bash
git add worker/repositories/agendas.ts worker/routes/admin-agendas.ts tests/worker
git commit -m "fix: make closed-day adjustments atomic"
```

---
