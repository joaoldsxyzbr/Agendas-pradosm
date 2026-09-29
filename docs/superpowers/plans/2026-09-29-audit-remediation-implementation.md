# Audit Remediation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use the delivery-specific plan below with superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Do not implement this roadmap as one giant change.

**Goal:** Fechar os 11 achados da auditoria de 29/09/2026 em entregas independentes, pequenas e verificáveis.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`.

## Delivery Plans

1. **Deploy e governança** — `docs/superpowers/plans/2026-09-29-deploy-governance-hardening.md`
   - Achados #1 e #2.
   - Executar primeiro.

2. **Frontend, CSP e E2E** — `docs/superpowers/plans/2026-09-29-frontend-e2e-hardening.md`
   - Achados #3, #4 e #7.

3. **Dados, autenticação e auditoria** — `docs/superpowers/plans/2026-09-29-data-auth-audit-hardening.md`
   - Achados #5, #6, #9 e #11.
   - Só liberar migrations depois da Delivery 1.
   - Ordem: `0014_store_code_nocase.sql` e depois `0015_user_session_version.sql`.

4. **Dashboard e documentação operacional** — `docs/superpowers/plans/2026-09-29-dashboard-operations-docs.md`
   - Achados #8 e #10.

## Merge Order

1. Deploy e governança.
2. Frontend, CSP e E2E.
3. Dados, autenticação e auditoria.
4. Dashboard e documentação.

## Global Verification

Ao final das quatro entregas:

- [ ] `npm ci`
- [ ] `npm audit --omit=dev`
- [ ] `npm test`
- [ ] `npm run test:e2e`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:deploy-flow`
- [ ] `verify` verde
- [ ] CodeQL verde
- [ ] Workers Builds confirmado com deploy command `npm run deploy`
- [ ] proteção da `main` confirmada
- [ ] issue #37 atualizada com links dos PRs/commits

## Scope Guard

Não incluir:
- troca de algoritmo de senha;
- refatoração ampla fora dos achados;
- novo sistema realtime;
- reescrita de dados históricos de lojas;
- segundo pipeline de deploy;
- mudanças destrutivas de schema.
