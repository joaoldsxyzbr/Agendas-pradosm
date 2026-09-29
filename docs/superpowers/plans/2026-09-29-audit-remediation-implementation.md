# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os 11 achados da auditoria de 29/09/2026 sem ampliar escopo, garantindo deploy previsível, autorização coerente na UI, integridade de dados, revogação de sessão, auditoria consistente, E2E real e documentação operacional.

**Architecture:** Executar em quatro entregas independentes e revisáveis: (A) deploy/governança, (B) frontend/CSP/E2E, (C) dados/autenticação/auditoria e (D) atualização operacional/documentação. Cada entrega deve sair em PR próprio, com testes escritos antes da correção e CI/CodeQL verdes antes do merge; migrations só entram depois de o fluxo de produção estar comprovado.

**Tech Stack:** React 19, Vite 7, TypeScript, Vitest, Hono, Cloudflare Workers, Cloudflare D1, Wrangler, GitHub Actions, Playwright Chromium e axe.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`, complementada por `docs/superpowers/specs/2026-09-28-audit-hardening-design.md`.

## Global Constraints

- Trabalhar exclusivamente no repositório `joaoldsxyzbr/Agendas-pradosm`; GitHub é a fonte de verdade.
- Consultar documentação oficial da Cloudflare antes de qualquer mudança em Workers Builds, Wrangler, D1 ou migrations.
- Não alterar PBKDF2-SHA256 nem o valor de 100.000 iterações.
- Não alterar dados operacionais de produção durante desenvolvimento ou testes.
- Não introduzir migration destrutiva; manter estratégia expand/contract.
- Não enfraquecer a CSP com `'unsafe-inline'` para scripts.
- Não introduzir polling fixo ou loops periódicos para o dashboard.
- Não criar um segundo caminho de deploy de produção.
- Toda mudança funcional deve ter teste de regressão antes da implementação.
- Cada entrega deve passar `npm test`, `npm run typecheck`, `npm run build` e os checks de PR aplicáveis antes do merge.

## Review Focus

- Visualizador abrindo agenda concluída: deve continuar somente leitura e nunca receber ação mutável.
- Loja legada gravada como `f03`: importação com `F03` deve localizar a mesma loja e impedir duplicata case-insensitive.
- Cookie emitido antes de troca de senha: deve ser rejeitado imediatamente após a alteração.
- Falha ao registrar `historico_agenda` em ajuste administrativo: a mutação correspondente deve ser revertida junto.
- Drift de configuração externa: Workers Builds e proteção da `main` devem ter requisitos documentados e verificáveis antes de qualquer release.

---

## Delivery A — Deploy e governança

### Task 1: Tornar o caminho de produção comprovável

**Files:**
- Create: `docs/operations/production-release.md`
- Modify: `README.md`
- Modify: `scripts/check-deploy-flow.mjs`
- Review external settings: Cloudflare Workers Builds e GitHub branch protection

**Interfaces:**
- Consumes: script existente `npm run deploy`.
- Produces: contrato operacional explícito de produção: `verify:production → check:migrations → D1 migrations → wrangler deploy`.

- [ ] **Step 1: Registrar o estado atual antes de mudar configuração externa**

Documentar no PR o SHA da `main`, o deploy command configurado no Workers Builds e os checks obrigatórios atuais da branch.

Expected: evidência suficiente para comparar antes/depois sem depender de memória ou dashboard informal.

- [ ] **Step 2: Escrever a documentação operacional do release**

Criar `docs/operations/production-release.md` com:
- production branch = `main`;
- Workers Builds deploy command obrigatório = `npm run deploy`;
- `npm run deploy` como único caminho de produção;
- ordem exata de verificação, migration e publicação;
- rollback compatível com migrations aditivas;
- regra expand/contract para schema incompatível;
- checklist de confirmação pós-deploy.

- [ ] **Step 3: Reforçar o teste do contrato de deploy**

Atualizar `scripts/check-deploy-flow.mjs` para validar que:
- `package.json` continua expondo apenas o fluxo nativo existente;
- a documentação de produção existe e contém `npm run deploy`;
- `.github/workflows/ci.yml` não executa `wrangler deploy`;
- não existe `.github/workflows/deploy.yml`.

- [ ] **Step 4: Rodar o guard local**

Run: `npm run test:deploy-flow`

Expected: PASS.

- [ ] **Step 5: Configurar Workers Builds**

No Cloudflare Workers Builds, definir o deploy command de produção como:

`npm run deploy`

Não adicionar um segundo deploy via GitHub Actions.

Expected: novo build de produção usa o script versionado no `package.json`.

- [ ] **Step 6: Configurar proteção da `main`**

Exigir:
- pull request antes de merge;
- check `verify`;
- check CodeQL `Analyze JavaScript/TypeScript`;
- branch atualizada quando necessário;
- sem bypass administrativo para mudanças normais, se a configuração da conta permitir.

Expected: push direto não é o fluxo normal de release.

- [ ] **Step 7: Validar um PR sem mudança funcional**

Abrir PR de documentação e confirmar que os checks obrigatórios aparecem antes do merge.

- [ ] **Step 8: Commit**

```bash
git add README.md docs/operations/production-release.md scripts/check-deploy-flow.mjs
git commit -m "docs: formalize production release flow"
```

---

## Delivery B — Frontend, CSP e E2E real

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

Run: `npm run test:ui -- --run tests/ui/dashboard-viewer.test.tsx`

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

## Delivery C — Dados, autenticação e auditoria

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

## Delivery D — Atualização operacional e documentação

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

Run: `npm run test:ui -- --run tests/ui/admin-dashboard-live.test.tsx`

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

## Merge Order

1. Delivery A — Deploy e governança.
2. Delivery B — Frontend, CSP e E2E.
3. Delivery C — Dados, autenticação e auditoria.
4. Delivery D — Atualização operacional e documentação.

Não iniciar Delivery C em produção antes de Delivery A estar comprovada, porque C adiciona migrations.

## Final Verification

Depois das quatro entregas integradas:

- [ ] `npm ci`
- [ ] `npm audit --omit=dev`
- [ ] `npm test`
- [ ] `npm run test:e2e`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:deploy-flow`
- [ ] confirmar `verify` verde no PR
- [ ] confirmar CodeQL verde no PR
- [ ] confirmar Workers Builds configurado com `npm run deploy`
- [ ] confirmar proteção da `main`
- [ ] após merge de migration, confirmar migrations aplicadas antes da nova versão do Worker
- [ ] revisar e marcar os 11 itens da issue #37 como concluídos com links para PRs/commits

## Self-Review Notes

- Cobertura da spec: os 11 achados da issue #37 estão mapeados para Tasks 1–8.
- Dependência crítica: Task 1 precede qualquer nova migration; Tasks 4 e 5 usam migrations 0014 e 0015 nessa ordem.
- Escopo evitado: não há troca de algoritmo de senha, refatoração ampla de arquitetura, reescrita de dados históricos nem novo sistema realtime.
- Ponto que exige validação oficial durante execução: semântica exata do comando usado pelo bootstrap CLI e configuração atual do Workers Builds; não assumir atomicidade fora de `D1Database.batch()`.
