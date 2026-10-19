# Release da migração JS puro

A migração autorizada vai diretamente da branch **migracao-js-puro** para **main** — não incorpora a implementação antiga da preview.

**Frontend e Worker:** JavaScript puro (ES Modules), HTML, CSS e SQL. O arquivo index.html carrega apenas a entrada JS nativa. O Worker usa worker/index.js. Os 110 arquivos TS/TSX da antiga stack foram removidos; as dependências React, React Router, TypeScript, Vite e Vitest foram retiradas do package.json e package-lock.json.

**Contratos:** testes de equivalência de rotas preservados no snapshot tests/migration/legacy-route-contracts.json, sem depender dos fontes TypeScript.

**Prod:** wrangler.jsonc preserva D1 real, cron diário, rate limit, Durable Object, SESSION_SECRET e realtime existentes. Não houve alteração dos registros do banco no processo de migração. O CI executa build, auditoria de dependências, CodeQL, 82 testes de contrato, testes de interface/browser com API mockada e wrangler deploy --dry-run.

**Fluxo de publicação:** somente se todos os jobs do CI mais recente da branch estiverem verdes, abrir PR de migracao-js-puro para main e efetuar merge conforme autorização do usuário. Em Cloudflare Workers Builds, o build command é npm run verify:production e o deploy command é npm run deploy:cloudflare. O deploy aplica migrations remote apenas após gate de segurança e então publica o Worker.

**Operação:** para rollback de código, restaurar o commit anterior da main e executar um novo build/deploy validado, preservando o D1. Não reverter migrations destrutivas sem plano de recuperação. Consulte docs/operations/data-recovery.md.

## Revisão de gates antes do merge (19/10/2026)

- Confirmado no repositório: **0 arquivos `.ts`/`.tsx`/`.jsx`**; frontend HTML/CSS/ES Modules, Worker `index.js` e `package-lock.json` sem dependências diretas React/TypeScript/Vite.
- `wrangler.jsonc` preserva Worker `agendas-pradosm`, D1 produtivo, rate limit, cron `5 3 * * *`, Durable Object, sessões e realtime.
- GitHub Actions da branch de migração concluiu verde no SHA `3bcc4f9ad15958275f358f4c609bea40a9dfc2f6`: [run 39247009719](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39247009719).
- Diagnóstico Cloudflare da falha externa anterior: o build de **preview da branch temporária** passou pelos 82 testes e build, mas o comando `wrangler preview` falhou por token de build inválido para preview (`10000`/`9109`). A configuração do gatilho foi alterada para incluir apenas `main`. Essa falha externa de preview não corresponde a teste funcional nem deploy produtivo da nova versão.
- Publicação direta autorizada: `migracao-js-puro → main`, sem mesclar a implementação antiga da branch `preview`. O fluxo não cria alterações de schema ou usa a base fictícia.
- Após merge, verificar a publicação do **Cloudflare Workers Builds de main** e o Worker ativo; se o token de build também falhar no fluxo produtivo, manter a versão anterior publicada e reparar credenciais antes de afirmar conclusão do deploy.
