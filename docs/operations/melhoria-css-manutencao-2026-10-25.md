# Melhoria incremental: CSS e manutenção — 25/10/2026

**Repositório:** `joaoldsxyzbr/Agendas-pradosm`  
**Branch:** `chore/melhoria-manutencao-20261025` (base `5bd2428b533e`)  
**Objetivo:** reduzir dívida técnica sem redesenho, sem mudar regras de negócio e sem publicar em produção.

## Evidência inicial

O HTML de produção carregava 12 arquivos CSS. Verificou-se, comparando as fontes do mesmo commit, que `frontend/styles/palette-refresh.css` (11.024 caracteres) é integralmente idêntico ao sufixo de `frontend/styles/enterprise-gray.css`. As folhas eram carregadas uma após a outra, sem CSS entre elas. O segundo carregamento não alterava a cascata final. Não presumimos que outros arquivos com seletores parecidos possam ser removidos sem investigação.

## P0 — Redundância de estilos

- [x] Remover o link repetido de `palette-refresh.css` do HTML.
- [x] Remover o arquivo redundante; manter o CSS efetivo no fim de `enterprise-gray.css`.
- [x] Atualizar `scripts/check-design-system.mjs` para identificar links CSS repetidos, arquivos ausentes e folhas que duplicam integralmente o sufixo de outra.
- [x] Atualizar a documentação da arquitetura.
- [ ] CI `verify` do novo commit concluído com sucesso.
- [ ] Validação visual real na Preview antes de integrar na `main`.

**Aceitação:** 11 links de CSS carregados, sem mudança nas declarações efetivas; `npm run test:design`, build, Playwright e CodeQL verdes. Reverter caso se observe regressão visual.

## Próximas etapas

- **P1 (CSS):** identificar e reduzir outras sobreposições comprovadas, com pequenos commits e testes visuais em desktop/mobile.
- **P2 (acessibilidade):** validar teclado, foco, contraste e modais nos perfis, corrigindo apenas problemas reproduzíveis.
- **P3 (operação):** investigar `--legacy-peer-deps`, observabilidade e evidências de recuperação do D1, sem alterar a infraestrutura sem aprovação.
- **P4 (registro):** confrontar o plano `docs/operations/plano-hardening-2026-10-21.md` com PRs/CI e registrar o que foi realmente realizado.

## Segurança e publicação

Mudanças exclusivamente na branch. Nenhum deploy, consulta a D1 remoto, alteração de sessão, credenciais ou migrations. Abrir PR e aguardar CI/Preview antes de considerar integração. Não interpretar CI verde como prova de implantação na Cloudflare.
