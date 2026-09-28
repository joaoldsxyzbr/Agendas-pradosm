# Plano de execução — Hardening pós-auditoria

Spec: `docs/superpowers/specs/2026-09-28-audit-hardening-design.md`

## Restrições globais

- Trabalhar somente no GitHub para código.
- Não alterar PBKDF2 de 100.000 iterações.
- Não alterar dados operacionais de produção.
- Uma tarefa por vez.
- Uma validação CI por tarefa.
- Mudanças destrutivas de D1 são proibidas neste plano.

## Task 1 — Deploy seguro

Arquivos:
- `package.json`
- `scripts/check-deploy-flow.mjs`
- novo `scripts/check-migration-safety.mjs`
- novos testes do script, se necessário.

Implementação:
- `deploy` começa por `verify:production`.
- adicionar `check:migrations`.
- bloquear novas migrations > 0012 contendo operações destrutivas.
- manter migrations aditivas antes do `wrangler deploy`.

Verificação:
- `npm test`
- `npm run typecheck`
- `npm run build`

## Task 2 — Cron de fechamento automático

Arquivos:
- novo `worker/services/agenda-maintenance.ts`
- `worker/app.ts`
- `worker/index.ts`
- `wrangler.jsonc`
- `tests/worker/auto-close.test.ts`

Implementação:
- extrair `closePastOpenAgendas`.
- manter fallback HTTP.
- adicionar `scheduled()`.
- cron `5 3 * * *`.
- teste chama handler agendado e confirma fechamento + auditoria.

Verificação completa uma vez ao final da tarefa.

## Task 3 — Integridade de admin e loja

Arquivos:
- nova migration `0013_admin_integrity.sql`
- `worker/repositories/users.ts`
- `worker/repositories/stores.ts`
- `worker/middleware/auth.ts`
- `worker/routes/auth.ts`
- testes Worker/D1.

Implementação:
- triggers D1 impedem remoção/desativação/rebaixamento do último admin.
- remover check de contagem não atômico da aplicação.
- conferente exige loja ativa em login e sessão.

Verificação completa uma vez ao final da tarefa.

## Task 4 — Bootstrap atômico e limiter fail-closed

Arquivos:
- `worker/repositories/users.ts`
- `worker/lib/login-rate-limit.ts`
- `worker/routes/auth.ts`
- `tests/worker/auth.test.ts`
- `tests/worker/login-rate-limit.test.ts`

Implementação:
- bootstrap + auditoria no mesmo batch.
- limiter retorna estado explícito.
- indisponibilidade retorna 503 + Retry-After.

Verificação completa uma vez ao final da tarefa.

## Task 5 — E2E e acessibilidade

Arquivos:
- `package.json`, `package-lock.json`
- novo `playwright.config.ts`
- novo `tests/e2e/login-accessibility.spec.ts`
- `.github/workflows/ci.yml`

Implementação:
- Playwright Chromium.
- axe na tela de login.
- smoke de renderização/controles principais.
- CI instala Chromium e roda `test:e2e`.

Verificação completa uma vez ao final da tarefa.

## Task 6 — GitHub policy e revisão final

- verificar disponibilidade de escrita em rulesets.
- se suportado, exigir CI e CodeQL na main sem bloquear o fluxo normal de PR.
- se não suportado pelo conector, registrar bloqueio de permissão e não simular sucesso.
- revisar diff completo, rodar CI final uma vez e só então integrar.
