# Plano de remediação da auditoria — 19/10/2026

## Escopo e segurança
- Repositório de referência: `joaoldsxyzbr/Agendas-pradosm`; ponto inicial: main `b5afd5f`.
- Ambiente produtivo: Cloudflare Workers + D1. Sem alterações de produção antes de PR + check `verify` e homologação.
- Manter JS ES Modules, HTML e CSS nativos; sem React, Vite, TypeScript ou dependências novas.
- Evitar migrations desnecessárias; não apagar dados, backups, histórico, logs ou branches sem conferência.
- `main` é produção, `preview` é homologação; branches temporárias de PR são removidas após merge.
- Manter fluxo oficial Workers Builds (ver `production-release.md`).

## Plano por fases

### Fase 1 — Proteção e monitoramento (alta)
- [x] Ruleset 25434998 ativo na main: PR obrigatório, check `verify`, proteção contra exclusão e force push, sem bypass.
- [x] Alterar o CI para rodar em push/PR também para `preview`.
- [x] Permitir sugestões de atualização do Dependabot em PRs de `preview`, limitadas, sem auto-merge.
- [ ] Habilitar Dependabot Alerts na página Security do GitHub, quando disponível. API de alertas retornou 403 (recurso desativado); não considerar a lista vazia.
- [ ] Conferir ruleset e deploy novamente após o primeiro merge.

### Fase 2 — Observações e histórico (alta)
- [x] Centralizar motivos do evento `agenda.changed` compartilhados entre Durable Object e frontend, incluindo `observation`.
- [x] Incluir observação no payload do histórico administrativo, quando disponível.
- [x] Exibir observação antiga com escape de HTML no histórico administrativo.
- [x] Adicionar testes de regressão para o novo evento, motivo inválido, API e XSS.
- [ ] PR aprovado, CI verde, deploy da `main` confirmado e smoke pós-deploy.

### Fase 3 — Segurança de autenticação e qualidade (média)
- [ ] Medir custo de PBKDF2 no Cloudflare Worker; elevar parâmetro em migração gradual, mantendo hashes anteriores funcionais.
- [ ] Auditar revogação de sessão ao mudar senha, papel, loja ou status e cobrir em testes.
- [ ] Garantir que mudanças de usuário, importação e status sejam atômicas e auditáveis; manter teste com banco sintético.
- [ ] Revisar paginação/índices das consultas extensas e medir performance antes de modificar D1.

### Fase 4 — Dependências e limpeza (média/baixa)
- [ ] Inventariar funções/risco de Hono, Zod, Chart.js, Lucide e LiteParse; manter Wrangler/Playwright oficiais.
- [ ] Substituir terceiros apenas quando alternativa nativa validada oferecer equivalência real.
- [ ] Leitura de PDF/WASM: **não remover** sem solução alternativa equivalente testada com fixtures e layout de arquivos reais saneados.
- [ ] Atualizar documentação antiga apontando para JS atual, mantendo histórico arquivado.
- [ ] Avaliar branches `chore-organizacao-js-puro` e `migracao-js-puro` antes de excluí-las.
- [ ] Conferir diferenças de `main` e `preview` para evitar perda de mocks e configurações isoladas.

## Critérios de aceite
1. PR revisado com CI `verify` e CodeQL verdes, testes de regressão e build reproduzível.
2. Nenhum acesso ou escrita ao D1 produtivo durante testes.
3. Se houver migration, aplicar de forma aditiva, com validação do histórico de migrations.
4. Só considerar produção atualizada após build/deploy Cloudflare do SHA esperado e smoke HTTP.
5. Reverter via release anterior compatível com schema, não com rollback destrutivo do D1.

## Rastreabilidade
- Execução inicial em `fix/auditoria-2026-10-19-etapa1`.
- Proteção da main configurada diretamente na área administrativa do GitHub.
- Correções de código vão por PR; demais fases exigem PRs independentes depois de concluída esta etapa.
