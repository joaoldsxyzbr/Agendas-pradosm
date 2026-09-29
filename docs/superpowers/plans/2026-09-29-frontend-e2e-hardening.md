# Frontend and E2E Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o contrato visual de autorização, eliminar a violação de CSP e substituir o smoke ad hoc por E2E real com acessibilidade.

**Architecture:** Propagar capacidade explícita para ações administrativas, manter a CSP estrita com bootstrap de tema externo e testar os três papéis contra Worker/D1 local usando Playwright + axe.

**Tech Stack:** React, Vite, Vitest, Playwright Chromium, axe, Cloudflare Worker local e D1 local.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`.

## Global Constraints

- Trabalhar exclusivamente no repositório `joaoldsxyzbr/Agendas-pradosm`.
- Não enfraquecer a CSP com `'unsafe-inline'`.
- Nunca usar D1 remoto nos E2E.
- Toda mudança funcional começa por teste de regressão.
- Exigir CI e CodeQL verdes antes do merge.

## Review Focus

- Visualizador em agenda concluída nunca vê ação de reabertura.
- Admin continua podendo reabrir.
- Bootstrap de tema não viola CSP.
- E2E usa Worker + D1 local, não apenas Vite interceptado.
- Login e telas dos três papéis passam axe sem violações críticas/sérias.

---


### Task 2: Corrigir autorização visual do preview e bootstrap de tema

**Files:**
- Create: `public/theme-bootstrap.js`
- Modify: `index.html`
- Modify: `src/admin/DashboardPage.tsx`
- Modify: `src/admin/AdminAgendaPreview.tsx`
- Modify: `tests/ui/dashboard-viewer.test.tsx`
- Modify: `tests/ui/admin-dashboard.test.tsx`
- Modify: `scripts/check-deploy-flow.mjs`

**Interfaces:**
- Produces: `AdminAgendaPreview({ agendaId, onClose, onAgendaChanged, canReopen })`, com `canReopen: boolean`.
- Produces: bootstrap de tema same-origin permitido pela CSP atual.

- [ ] **Step 1: Escrever teste de regressão do visualizador**

Adicionar caso em `tests/ui/dashboard-viewer.test.tsx` com agenda concluída:
- abrir `Ver detalhes`;
- afirmar `Somente leitura`;
- afirmar ausência do botão `Reabrir para conferente`.

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `npm run test:ui -- tests/ui/dashboard-viewer.test.tsx`

Expected: FAIL porque o botão de reabertura ainda aparece.

- [ ] **Step 3: Propagar capacidade de reabertura**

Adicionar prop obrigatória `canReopen: boolean` em `AdminAgendaPreview`.

`DashboardPage` deve passar `canReopen={!readOnly}`.

Renderizar a ação de reabertura somente quando:
- `canReopen === true`; e
- `dayStatus === "concluido"`.

- [ ] **Step 4: Preservar teste do administrador**

Em `tests/ui/admin-dashboard.test.tsx`, manter cenário concluído confirmando que administrador ainda vê e executa `Reabrir para conferente`.

- [ ] **Step 5: Externalizar o bootstrap de tema**

Mover apenas a lógica antecipada de tema de `index.html` para `public/theme-bootstrap.js`.

O HTML deve usar:

`<script src="/theme-bootstrap.js"></script>`

Não adicionar `unsafe-inline` ao `script-src`.

- [ ] **Step 6: Adicionar guard de CSP/bootstrap**

Em `scripts/check-deploy-flow.mjs`, afirmar:
- `index.html` referencia `/theme-bootstrap.js`;
- o HTML não contém o código inline de `localStorage.getItem("theme")`;
- `public/_headers` continua sem `'unsafe-inline'` em `script-src`.

- [ ] **Step 7: Rodar testes focados**

Run:
- `npm run test:ui`
- `npm run test:deploy-flow`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/theme-bootstrap.js index.html src/admin/DashboardPage.tsx src/admin/AdminAgendaPreview.tsx tests/ui/dashboard-viewer.test.tsx tests/ui/admin-dashboard.test.tsx scripts/check-deploy-flow.mjs
git commit -m "fix: align dashboard permissions and csp"
```

### Task 3: Substituir smoke ad hoc por Playwright + axe contra Worker local

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/seed.sql`
- Create: `tests/e2e/login-accessibility.spec.ts`
- Create: `tests/e2e/roles.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/check-deploy-flow.mjs`
- Delete: `scripts/check-lighthouse-report.mjs`

**Interfaces:**
- Produces: `npm run test:e2e`.
- Produces: ambiente E2E isolado usando D1 local, nunca o banco remoto.
- Produces: navegador real exercitando Worker + assets + headers.

- [ ] **Step 1: Adicionar dependências de teste**

Adicionar devDependencies:
- `@playwright/test`;
- `@axe-core/playwright`.

Atualizar lockfile via npm.

- [ ] **Step 2: Configurar ambiente E2E isolado**

`playwright.config.ts` deve:
- usar Chromium;
- servir o Worker local em porta fixa de teste;
- usar diretório de persistência D1 exclusivo de E2E;
- nunca usar `--remote`;
- executar migrations locais e `tests/e2e/seed.sql` antes da suíte.

- [ ] **Step 3: Criar fixture de dados E2E**

`tests/e2e/seed.sql` deve criar:
- um admin;
- um visualizador;
- um conferente;
- uma loja;
- uma agenda concluída com pelo menos um agendamento.

Usar somente credenciais de teste conhecidas e hash já usado nas suítes locais.

- [ ] **Step 4: Escrever E2E do login e acessibilidade**

`login-accessibility.spec.ts` deve:
- abrir `/login`;
- confirmar campos e botão;
- confirmar CSP sem erro de inline script;
- rodar axe e exigir zero violações configuradas como críticas/sérias.

- [ ] **Step 5: Escrever E2E dos três papéis**

`roles.spec.ts` deve comprovar:
- admin entra em `/admin` e vê ação de reabertura em agenda concluída;
- visualizador entra em `/admin`, vê detalhes e não vê ação mutável;
- conferente entra em `/app` e só acessa sua loja.

- [ ] **Step 6: Rodar a suíte local**

Run: `npm run test:e2e`

Expected: PASS no Chromium.

- [ ] **Step 7: Trocar o passo browser do CI**

Em `.github/workflows/ci.yml`:
- instalar Chromium do Playwright;
- executar `npm run test:e2e`;
- remover shell manual de Chrome/Lighthouse.

- [ ] **Step 8: Atualizar o guard de produção**

`scripts/check-deploy-flow.mjs` deve validar a presença de Playwright/axe no CI em vez de Lighthouse.

- [ ] **Step 9: Rodar verificação completa**

Run:
- `npm test`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run build`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e .github/workflows/ci.yml scripts/check-deploy-flow.mjs
git rm scripts/check-lighthouse-report.mjs
git commit -m "test: add real browser role coverage"
```

---
