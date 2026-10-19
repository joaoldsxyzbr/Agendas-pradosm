# Gate de publicação na main — migração JS puro

Data: 19/10/2026. Autorização do usuário: publicar **somente após** a migração estar inteiramente em JavaScript puro e todos os testes/homologações passarem. Fluxo: `preview → validar → main`.

## Evidência de testes já concluídos

- CI da `migracao-js-puro` aprovado: [run 39235509332](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39235509332), 82 testes JS e Playwright com APIs mockadas.
- CI da `preview` aprovado: [run 39241547975](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39241547975), testes com D1 **local isolado**, Chromium, CodeQL, verificações JS e build. A `preview` não contém fontes TypeScript, React ou Vite na stack instalada.
- Candidato de produção gerado **sem deploy**: [dry-run 39242435308](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39242435308), preservando no artefato os IDs produtivos, cron e realtime da `main`, e removendo rótulos de demonstração.
- PR [#91](https://github.com/joaoldsxyzbr/Agendas-pradosm/pull/91) permanece **draft** e **não pode ser mesclado diretamente**: o código da `preview` usa um `wrangler.jsonc` com D1 de testes, sem cron real, além de UI e conteúdo de demonstração.

## Pendências reais antes de tocar em dados/produção

1. **Paridade de tela:** a branch `migracao-js-puro` converte a interface existente da `main`, mas ainda guarda fontes e dependências React/TS/Vite como legado de referência. Já a `preview` tem uma interface nativa própria (com design e funções extras). Precisa definir a versão final preservando os fluxos da `main` e validá-la visualmente. CI verde isolado não prova equivalência visual.
2. **Esquema D1:** leitura de metadados via Cloudflare confirmou que o banco produtivo **não tem** `agendamentos.observacao`. A `preview` adicionou a migration `0017_appointment_observation.sql`, que é aditiva e precisa de backup/controle antes da implantação do Worker dependente desse campo. Nenhuma SQL de escrita foi executada na produção nesta revisão.
3. **Configuração de produção:** publicação deve acontecer em uma única revisão/commit final com Worker `agendas-pradosm`, binding D1 de produção, rate limit produtivo, cron `5 3 * * *`, realtime `on`, HTML sem badges de teste e sem login rápido mockado. Nunca copiar diretamente o `wrangler.jsonc` da `preview`.
4. **Homologação de release:** verificar regressões de login real, status reversível, importação CSV/PDF, relatórios, fornecedores manuais, observações, permissões, tempo real e leitura/gravação após a migration. Testar migração sobre cópia do esquema e realizar rollback de código se necessário.
5. **Repositório agora público:** conferir versões e histórico de commits por segredos antes de promover; nunca escrever tokens nem conteúdo do D1 em PR, Actions ou docs.

## Status de publicação

**BLOQUEADA POR SEGURANÇA**, não por falta de autorização do usuário. Houve validação do JS nativo e dry-run sem falhas, mas os itens de paridade, migration D1 e corte de produção ainda não estão homologados. **Não foi feito merge na main, deploy produtivo ou escrita no D1 real.**
