# Plano: Avisos e notificações in-app

Spec: docs/specs/2026-11-11-avisos-notificacoes-design.md
Branch: feat/avisos-notificacoes (base: preview)

## Tarefas

### Tarefa 1: Migration de avisos

- Arquivos: `migrations/0022_avisos.sql`
- Mudança: tabela `avisos` (id PK, `tipo` CHECK IN ('aviso','evento'), titulo, mensagem, `criado_por` FK usuarios NULL, `criado_em`, `expira_em` NULL, `inativo_em` NULL) + `avisos_lidos` (PK composta aviso_id+usuario_id, `lido_em`, FK ON DELETE CASCADE no aviso) + índice de leitura (inativo_em, expira_em, criado_em). Seguir o estilo de 0001_init.sql.
- Verificação: `npm run check:migrations`
- Critério de pronto: gate passa; migration aplicada no D1 de preview no deploy (deploy:preview aplica migrations).

### Tarefa 2: Schemas compartilhados

- Arquivos: `shared/avisos.ts`, `tests/unit/avisos.test.ts`
- Mudança: zod — `avisoSchema` (id, tipo, titulo, mensagem, criadoEm, expiraEm nullable, lido), `avisosResponseSchema` (avisos[], naoLidos), `publicarAvisoSchema` (titulo 1..200, mensagem 1..2000, expiraEm ISO opcional; limites como hardening).
- Verificação: `node --experimental-strip-types --test tests/unit/avisos.test.ts`
- Critério de pronto: casos de limite (200/201, 2000/2001, tipo inválido) vermelho→verde.

### Tarefa 3: Repositório de avisos

- Arquivos: `worker/repositories/avisos.ts`, `tests/unit/avisos.test.ts`
- Mudança: `listarAtivos(db, usuarioId, limite 50)` (LEFT JOIN avisos_lidos, conta não lidos), `marcarLido(db, avisoId, usuarioId)` (INSERT OR IGNORE), `publicar`, `inativar`, e helper `appendAvisoEventoStatement` reutilizável nos batches transacionais (padrão appendAgendaReplaceStatements).
- Verificação: testes com fake db validando arity bind×placeholders em todos os statements
- Critério de pronto: fake db rejeita bind divergente (padrão do teste de regressão do #214).

### Tarefa 4: Rotas e contratos

- Arquivos: `worker/routes/avisos.ts`, `worker/app.ts`, `worker/middleware/auth.ts`, `tests/unit/legacy-route-contracts.json`, `tests/unit/avisos.test.ts`
- Mudança: GET `/api/avisos` e POST `/api/avisos/:id/lido` (sessão; visualizador read-only via allowlist), POST `/api/admin/avisos` e POST `/api/admin/avisos/:id/inativar` (admin + auditoria). Mount no app.ts; JSON de contratos ganha as rotas novas (lição #210: rota nova exige entrada no JSON).
- Verificação: `npm test` (parity + avisos) e `node scripts/check-worker.mjs`
- Critério de pronto: 401 sem sessão, 403 conferente/visualizador nas rotas admin, auditoria gravada.

### Tarefa 5: Eventos automáticos

- Arquivos: `worker/routes/admin-agendas.ts`, `worker/routes/store-agendas.ts`, `tests/unit/avisos.test.ts`
- Mudança: importação de agenda, reabertura e conclusão de dia inserem aviso tipo `evento` NO MESMO `db.batch` da operação.
- Verificação: testes unitários estendidos (batch da importação/reabertura/conclusão contém o INSERT do aviso com bind correto)
- Critério de pronto: operação sem aviso registrado é impossível (mesma transação).

### Tarefa 6: UI do sino e painel

- Arquivos: `apps/web/src/features/avisos/api.ts`, `apps/web/src/features/avisos/model.ts`, `apps/web/src/features/avisos/avisos-bell.tsx`, `apps/web/src/features/avisos/publish-aviso-dialog.tsx`, `apps/web/src/app/layouts.tsx`
- Mudança: sino (Bell + badge) no header das duas áreas, painel `<dialog>` nativo com lista (não lidos primeiro), marcar como lido com atualização otimista, diálogo de publicação e botão inativar (só admin), polling react-query 60s + invalidação pós-ação. Textos e aria-labels em PT-BR (ex.: "Avisos, N não lidos").
- Verificação: `tsc` apps/web 0 erros + `vite build` (node_modules montados do registry; CI cobre)
- Critério de pronto: sino renderiza em ambas as áreas com contagem; visualizador sem botões de escrita.

### Tarefa 7: E2E e documentação

- Arquivos: `apps/web/tests/avisos.spec.ts`, `docs/architecture.md`, `README.md`
- Mudança: spec Playwright (badge, painel, marcar lido, admin publica, admin inativa, visualizador read-only); architecture.md volta a descrever preview como homologação ativa (reverte o texto do #223) e ganha a seção de avisos; resumo no README.
- Verificação: CI 4/4 verde no PR para preview; deploy:preview OK; health da preview OK
- Critério de pronto: homologação do João na preview; promoção para main em PR separado criado da main.

## Ordem e dependências

Sequencial: 1 → 2 → 3 → 4 → 5 → 6 → 7. Toda tarefa toca a mesma árvore de estado (worker + testes); sem paralelização.

## Validação final

1. `npm run check:migrations`
2. `npm test` (check-worker + todos os unitários)
3. `npm run test:bootstrap-admin`
4. `npm run build && node scripts/check-build.mjs && node scripts/build-modern-preview.mjs`
5. Push no PR para `preview`; CI 4/4 verde (verify, Workers Builds, quality, CodeQL)
6. Deploy preview OK + health {\"ok\":true}; homologação do João; promoção para `main` por branch criada da main
