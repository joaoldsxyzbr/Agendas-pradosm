# Dashboard Operations and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover polling fixo do dashboard e concluir a documentação operacional do projeto.

**Architecture:** Atualizar o dashboard por ações locais, refresh explícito e retorno de visibilidade da aba. Consolidar no README apenas o essencial e apontar o fluxo de release para o runbook dedicado.

**Tech Stack:** React, Vitest UI e documentação Markdown.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`.

## Global Constraints

- Não introduzir polling periódico.
- Não adicionar realtime novo nesta entrega.
- Preservar refresh após importação, reabertura e troca de data.
- Documentar somente o fluxo real do projeto.
- Exigir CI e CodeQL verdes antes do merge.

## Review Focus

- Dashboard não registra `setInterval`.
- Botão manual atualiza a data atualmente selecionada.
- Retorno à aba atualiza silenciosamente.
- Visualizador continua read-only.
- README aponta corretamente para o runbook de produção.

---


### Task 8: Remover polling fixo e fechar documentação

**Files:**
- Modify: `src/admin/DashboardPage.tsx`
- Modify: `tests/ui/admin-dashboard-live.test.tsx`
- Modify: `README.md`
- Review: `docs/operations/production-release.md`

**Interfaces:**
- Produces: atualização explícita por ação do usuário e ao retornar à aba; sem `setInterval`.

- [ ] **Step 1: Reescrever o teste de atualização do dashboard**

Remover expectativa de intervalo de 10s.

Adicionar cenários:
- botão `Atualizar` dispara nova leitura da data selecionada;
- evento `visibilitychange` ao voltar para `visible` dispara refresh silencioso;
- nenhum `setInterval` é registrado pelo dashboard.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm run test:ui -- tests/ui/admin-dashboard-live.test.tsx`

Expected: FAIL enquanto existir polling.

- [ ] **Step 3: Remover polling**

Eliminar `window.setInterval(..., 10_000)`.

Manter atualizações já existentes após:
- importação;
- reabertura;
- mudança de data.

- [ ] **Step 4: Adicionar atualização explícita**

Adicionar botão `Atualizar` no cabeçalho do dashboard usando `refreshAgendas()`.

Durante refresh manual, evitar clique duplicado com estado local de atualização.

- [ ] **Step 5: Atualizar ao retornar à aba**

Adicionar listener de `visibilitychange`.

Quando `document.visibilityState === "visible"`, chamar `refreshAgendas({ silent: true })`.

Remover listener no cleanup.

- [ ] **Step 6: Completar README operacional**

Documentar de forma curta:
- stack e pré-requisitos;
- setup local;
- scripts principais;
- migrations locais/remotas;
- secrets;
- papéis `admin`, `visualizador`, `conferente`;
- bootstrap inicial e break-glass;
- cron;
- testes;
- release de produção com link para `docs/operations/production-release.md`.

- [ ] **Step 7: Rodar verificação final da entrega**

Run:
- `npm test`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/admin/DashboardPage.tsx tests/ui/admin-dashboard-live.test.tsx README.md docs/operations/production-release.md
git commit -m "refactor: remove dashboard polling and document operations"
```

---
