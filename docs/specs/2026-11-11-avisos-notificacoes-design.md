# Spec de design: Avisos e notificações in-app

Data: 2026-11-11
Status: aprovado
Classificação: mudança arquitetural
Branch: feat/avisos-notificacoes

## Problema

O João não tem como avisar os conferentes dentro do sistema, nem vê registro dos eventos operacionais (importação, reabertura, conclusão). Quem não está logado no momento fica sem saber de nada. Custo atual: comunicação fora do sistema, sem histórico.

## Decisões

| # | Decisão | Alternativa rejeitada | Motivo |
| --- | --- | --- | --- |
| 1 | Avisos persistidos em D1 (`avisos` + `avisos_lidos`) com badge de não lidos por usuário | Avisos efêmeros via WebSocket/toast | Aviso do admin precisa alcançar conferente que entra depois; evento sem histórico não serve |
| 2 | Uma entidade única com coluna `tipo` (`aviso`/`evento`) | Duas tabelas separadas | Mesmo ciclo de vida (criar → exibir → ler → inativar/expirar); tabela única evita duplicar leitura e badge |
| 3 | Todos os papéis autenticados veem todos os avisos | Filtro por papel/alvo | Decisão do João: "conferentes + admin veem tudo"; visualizador (dashboard) só lê |
| 4 | Eventos automáticos do MVP: agenda importada, agenda reaberta, dia concluído | Catálogo maior de eventos | Escopo decidido pelo João; novo evento no futuro é um INSERT a mais |
| 5 | Eventos gravados na MESMA transação (`db.batch`) da operação que os gera | INSERT solto após a operação | Operação sem aviso = estado inconsistente; batch é transacional no D1 (lição do incidente #214) |
| 6 | Badge atualiza por polling (react-query, 60s) + invalidação pós-ação | WS realtime para avisos | `REALTIME_MODE` é `off` na preview; polling atende e simplifica homologação; WS fica como melhoria futura |
| 7 | Expiração por leitura (`expira_em` nullable; filtro na query) + inativação manual (soft delete) | Cron de limpeza | YAGNI: leitura filtra expirados; inativar cobre retirada manual |
| 8 | Listagem limitada aos últimos 50 avisos ativos | Lista completa paginada | Volume baixo (14 usuários); índice cobre a query |
| 9 | Sino no header das duas áreas (`layouts.tsx`), painel em `<dialog>` nativo | Página dedicada /admin/avisos | Menos navegação; segue o padrão dos diálogos existentes |

## Comportamento esperado

- Conferente, admin e visualizador veem o sino com badge de não lidos; o painel lista avisos (não lidos primeiro, depois por `criado_em` desc), com marcação de lido por aviso.
- Admin publica aviso (título + mensagem + expiração opcional) e inativa avisos; ações auditadas (`aviso_publicado`, `aviso_inativado`).
- Agenda importada, agenda reaberta e dia concluído geram aviso tipo `evento` transacional com a operação.
- 401 sem sessão em tudo; 403 para conferente/visualizador nas rotas admin; visualizador só lê (allowlist GET).

## Impacto

- **Novo**: `migrations/0022_avisos.sql`, `worker/repositories/avisos.ts`, `worker/routes/avisos.ts`, `shared/avisos.ts`, `apps/web/src/features/avisos/` (api, model, sino, painel, diálogo de publicação), `tests/unit/avisos.test.ts`, `apps/web/tests/avisos.spec.ts`, `docs/GLOSSARY.md`.
- **Alterado**: `worker/app.ts` (monta rotas), `worker/middleware/auth.ts` (allowlist GET `/api/avisos`), `worker/routes/admin-agendas.ts` e `worker/routes/store-agendas.ts` (geram eventos), `apps/web/src/app/layouts.tsx` (sino), `tests/unit/legacy-route-contracts.json` (rotas novas), `docs/architecture.md` (preview volta a ser homologação ativa).
- **NÃO muda**: contratos existentes de agendas/importação/sessão; D1 de produção (regra: nunca tocado, nem leitura); retention.

## Riscos e mitigações

| Risco | Mitigação |
| --- | --- |
| Caminho transacional esquecer o INSERT do aviso | Evento entra no mesmo `db.batch` + teste de arity bind×placeholders (padrão pós-#214) |
| Colisão de numeração no D1 de preview (0020/0021/0030 legados) | Numerar 0022; `check:migrations` compara nomes e roda na CI |
| Aviso urgente atrasar até 60s no badge | Invalidação pós-ação; atraso aceito no MVP; WS como melhoria futura |
| `avisos_lidos` crescer | PK composta; ~14 usuários; se um dia pesar, cron existente de retenção cobre |

## Fluxo de entrega

Preview é homologação ativa: PR `feat/avisos-notificacoes` → `preview`, CI verde, deploy:preview, homologação do João em preview.agendaspradosm.joaolds.xyz.br, e só então promoção para `main` por branch criada DA main com o conteúdo aprovado (lição do #205: nunca PR head=preview).


## Adendo de 12/11/2026 — melhorias aprovadas em protótipo

Decisões do João sobre o comportamento dos avisos, validadas em réplica visual
(canvas) e implementadas na migration `0023_avisos_melhorias.sql`:

| # | Decisão | Substitui |
| --- | --- | --- |
| A1 | Aviso é registro permanente: nunca é excluído, expirado ou inativado — nem pelo admin | Decisão 7 (expiração + inativação) |
| A2 | Lista única do mais recente para o mais antigo; a lista É o histórico, sem aba separada | Ordenação "não lidos primeiro" da decisão 8 |
| A3 | Urgência: aviso urgente tem chip e destaque no painel; o badge do sino pulsa em vermelho enquanto houver urgente não lido | — |
| A4 | Direcionamento por loja: publicação escolhe "Todas as lojas" ou lojas específicas (`avisos_lojas`); conferente só vê os da sua loja e os globais; admin/visualizador veem tudo | Decisão 3 (todos veem tudo) |
| A5 | Autor visível no card ("por João", "por Sistema") — coluna `autor` desnormalizada do nome no momento da publicação | — |
| A6 | "Marcar todos" como lidos: `POST /api/avisos/marcar-todos` grava a leitura de tudo que o usuário enxerga | — |
