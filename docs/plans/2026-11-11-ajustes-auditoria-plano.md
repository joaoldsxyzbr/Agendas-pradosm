# Plano: ajustes da auditoria de 11/11/2026 (governança + hardening + DRY)

Auditoria: sessão de 11/11/2026 (main a6f689c1)
Branch: chore/ajustes-auditoria-2026-11-11
Escopo aprovado pelo João: tudo menos PBKDF2 (issue #82), num PR só, até o CI ficar verde.

## Tarefas

### Tarefa 1: Apontar o dependabot para a main

- Arquivos: `.github/dependabot.yml`
- Mudança: `target-branch: "preview"` → `"main"` nos 3 ecosystems (npm raiz, npm apps/web, github-actions)
- Verificação: `grep -c 'target-branch: "main"' .github/dependabot.yml` = 3
- Critério de pronto: nenhum ecosystem aponta para preview

### Tarefa 2: Limpar triggers do CI e dry-run honesto das duas configs

- Arquivos: `.github/workflows/ci.yml`
- Mudança: remover branch extinta `testes` dos triggers push/pull_request; renomear o step de dry-run da preview para dizer preview; adicionar dry-run do `wrangler.jsonc` de produção (comando já provado no workflow Manual Verify, linha 25)
- Verificação: `grep -c testes .github/workflows/ci.yml` = 0; `grep -c 'wrangler.jsonc' .github/workflows/ci.yml` >= 1
- Critério de pronto: CI seca as duas configs com labels corretos e sem branch fantasma

### Tarefa 3: Limite superior no NullableCount do import (TDD)

- Arquivos: `tests/unit/shared-contracts.test.ts`, `shared/agenda.ts`
- Mudança: teste vermelho primeiro (items 1.000.001 deve falhar na validação de ImportAgendaInput; 1.000.000 deve passar); depois `NullableCount` ganha `.max(1_000_000)` com mensagem PT-BR
- Verificação: teste vermelho antes da mudança, verde depois; suíte unitária completa verde
- Critério de pronto: contagem absurda do CSV rejeitada antes do bind no D1

### Tarefa 4: Helper único para a substituição de agenda (DRY)

- Arquivos: `worker/repositories/agendas.ts`
- Mudança: extrair `appendAgendaReplaceStatements` (+ statements de renome de arquivo, replace e desativação) usados tanto por `replaceAgendaImport` quanto por `importAgendaBatchAtomic`; comportamento idêntico
- Verificação: SQL de UPDATE de agendamento existe em 1 lugar só; teste de arity (agenda-import-bulk-replace.test.ts) verde nos 3 caminhos; suíte completa verde
- Critério de pronto: mudança futura de coluna toca 1 SQL, não 2 (classe do incidente 500 eliminada)

### Tarefa 5: docs/architecture.md sem preview como homologação ativa

- Arquivos: `docs/architecture.md`
- Mudança: preview descrita como congelada/histórica (última sincronia 05/11/2026), não como fluxo de homologação ativo
- Verificação: grep homologa preview → sem afirmação de homologação ativa
- Critério de pronto: docs batem com a operação real

## Ordem e dependências

Sequencial: 1 → 2 → 3 (vermelho→verde) → 4 → 5. Uma tarefa por commit, pt-BR, imperativo.

## Validação final

1. `node --experimental-strip-types --test tests/unit/*.test.ts` — 95/95 (94 + 1 novo)
2. `node_modules/typescript/bin/tsc -p worker --noEmit` — 0 erros
3. `npm run check:migrations` — gate OK
4. `npm run test:bootstrap-admin` — OK
5. CI 4/4 verde na PR (verify, Workers Builds, CodeQL, quality) antes do merge
