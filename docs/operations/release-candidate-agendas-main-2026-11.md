# Release candidata: Agendas e Importação — novembro/2026

**Status:** candidata, sem autorização para produção. Esta branch é uma preparação técnica, **não** um deploy.
**Destino futuro:** `main`, somente após nova autorização explícita.
**Origem:** `main` no commit `101f71111d1295374cb26b4ec3817cafdaa11673`, incorporando as funcionalidades comprovadas da `preview` (`3cc6bafc1818c1a7ccdb06ed45429f370ded62c7`).

## Escopo

- Nova aba de Importação (CSV/PDF uma única vez), com o mesmo parser e persistência que abastecem Recebimento e Conferência.
- Agendas administrativas por loja, com lista compacta de fornecedores, NF-e, pedidos, protocolos, dados originais do CSV e check individual para digitação.
- Resumo `x/y digitadas` por loja com controle de estado e auditoria do usuário; checks não alteram status operacional, conferência, recebimento ou relatórios.
- Testes de importação, autorização, segurança, reimportação, concorrência e navegador.

**Fora do escopo:** Tags, Cross Docking, migração de dados do banco de homologação, novas permissões para conferente/visualizador, configurações da Cloudflare, credenciais, login, realtime e refatorações gerais.

## Diferenças entre ambientes

- A `main` atual já executa React e inclui a correção de realtime do conferente do PR #176. Os arquivos desta correção ficam **intocados** na branch de release.
- `wrangler.jsonc`, `wrangler.preview.jsonc`, `wrangler.preview-migrations.jsonc`, `package.json`, a pasta de CI e o comando `npm run deploy:cloudflare` permanecem os da `main`.
- O novo parser grava `agendamentos.csv_campos` somente para **novas importações**; campos brutos descartados em importações antigas não são recuperáveis retroativamente.
- A `preview` possui histórico divergente e migrações antigas de Tags/Cross Docking. Essas migrações **não são transportadas** para a `main` e seus dados não são copiados.
- As duas migrations da funcionalidade usam nomes históricos da `preview`; não devem ser reescritas ou renomeadas porque já foram aplicadas no D1 de testes.

## Banco de produção: somente análise, sem escrita

Verificado em 04/11/2026 por consultas **read-only** no D1 de produção:

- Existem as migrações `0001` a `0019`, inclusive `0017_observacao_recebimento.sql`.
- Não existem a coluna `agendamentos.csv_campos`, a tabela `agenda_digitacao_fornecedor` nem `0020_agenda_digitado_para_conferente.sql` / `0021_agendas_csv_fornecedor_preview.sql` no histórico de migrations.
- `0020` adiciona apenas os campos opcionais `agendas.digitado_em` e `digitado_por` (legado da primeira versão administrativa da funcionalidade).
- `0021` adiciona a coluna opcional `agendamentos.csv_campos` e a tabela de marcações de fornecedor (FKs para agendas e usuários). As migrations são aditivas e **devem ser validadas num banco sintético com o esquema exato da produção antes da publicação**.

Não executar `wrangler d1 migrations apply --remote` ou qualquer consulta de escrita no D1 de produção para testar esta PR.

## Gate obrigatório antes da autorização

- [ ] CI de PR da branch de release: `npm run verify:production`, CodeQL, `verify`, Playwright.
- [ ] Testes de imports CSV/PDF (com e sem pedidos/NF-e), substituição de agendas, check/descheck, concorrência, hash de fornecedor, datas e permissão por perfil.
- [ ] Teste de migrações `0020`/`0021` num D1 **local/sintético** com migrations `0001`–`0019`.
  - Teste reproduzível: `tests/unit/release-agendas-migrations.test.ts` executa 0001–0021 com SQLite em memória e verifica compatibilidade de tabelas e FKs.
- [ ] Verificar a paridade do conferente com a correção de realtime mantida, dos relatórios e da rota de recebimento.
- [ ] Validar visualmente com login real na `preview`; confirmar tamanho dos arquivos e desempenho das consultas em dia movimentado.
- [ ] Confirmar plano de backup do D1 de produção (export/Time Travel) e anotar identificador do ponto de recuperação, sem executá-lo antes de aprovação.
- [ ] Revalidar o diff da PR e as configurações de Worker/D1 da produção imediatamente antes do merge.
- [ ] Receber **autorização explícita** do usuário para merge/publicação na `main`, com janela operacional e contato de rollback.

## Publicação — somente após autorização

O merge na `main` dispara Workers Builds de produção com:

1. `npm run verify:production`;
2. `npm run deploy:cloudflare` — valida migrations, aplica pendências de produção e publica `agendas-pradosm`.

Não duplicar deploy manual, não trocar D1 de produção pelo de teste e não alterar secrets ou `REALTIME_MODE`.

**Pós-deploy:** verificar D1 migrations e Worker, autorização administrativa, nova Importação, Agendas, conferente/realtime e relatórios. Observar logs/erros e preservar registro da release.

**Rollback:** se o Worker falhar após migrações aditivas, republicar código anterior sem derrubar colunas ou apagar dados; restauração de banco e intervenção operacional exigem aprovação específica e o procedimento de recuperação.
