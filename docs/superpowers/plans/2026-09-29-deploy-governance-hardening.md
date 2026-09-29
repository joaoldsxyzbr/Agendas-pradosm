# Deploy and Governance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** GitHub issue #37 `Auditoria completa — 2026-09-29`.

## Global Constraints

- Trabalhar exclusivamente no repositório `joaoldsxyzbr/Agendas-pradosm`.
- Consultar documentação oficial da Cloudflare antes de mudanças em Workers Builds, Wrangler, D1 ou migrations.
- Não alterar PBKDF2-SHA256 nem 100.000 iterações.
- Não alterar dados operacionais de produção durante desenvolvimento/testes.
- Não introduzir migration destrutiva.
- Toda mudança funcional deve começar por teste de regressão.
- Exigir CI e CodeQL verdes antes de merge.

**Goal:** Tornar o fluxo de produção comprovável e impedir que mudanças cheguem à `main` sem os gates definidos.

**Architecture:** Manter Workers Builds como caminho nativo único de produção, fazendo-o chamar `npm run deploy`. Versionar o contrato operacional no GitHub e alinhar a proteção da `main` para PR + CI + CodeQL.

**Tech Stack:** Cloudflare Workers Builds, Wrangler, D1 migrations, GitHub Actions e branch protection.


### Task 1: Tornar o caminho de produção comprovável

**Files:**
- Create: `docs/operations/production-release.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`
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

Atualizar `.github/workflows/ci.yml` para executar em todo PR/push da `main`, inclusive alterações somente em `docs/**`; remover o `paths-ignore` que hoje pode impedir o check obrigatório `verify` de existir.

Atualizar `scripts/check-deploy-flow.mjs` para validar que:
- `package.json` continua expondo apenas o fluxo nativo existente;
- a documentação de produção existe e contém `npm run deploy`;
- `.github/workflows/ci.yml` não executa `wrangler deploy`;
- o CI não ignora `docs/**`;
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
git add README.md docs/operations/production-release.md .github/workflows/ci.yml scripts/check-deploy-flow.mjs
git commit -m "docs: formalize production release flow"
```

---
