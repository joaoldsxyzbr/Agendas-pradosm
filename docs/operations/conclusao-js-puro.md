# Release da migração JS puro

A migração autorizada vai diretamente da branch **migracao-js-puro** para **main** — não incorpora a implementação antiga da preview.

**Frontend e Worker:** JavaScript puro (ES Modules), HTML, CSS e SQL. O arquivo index.html carrega apenas a entrada JS nativa. O Worker usa worker/index.js. Os 110 arquivos TS/TSX da antiga stack foram removidos; as dependências React, React Router, TypeScript, Vite e Vitest foram retiradas do package.json e package-lock.json.

**Contratos:** testes de equivalência de rotas preservados no snapshot tests/migration/legacy-route-contracts.json, sem depender dos fontes TypeScript.

**Prod:** wrangler.jsonc preserva D1 real, cron diário, rate limit, Durable Object, SESSION_SECRET e realtime existentes. Não houve alteração dos registros do banco no processo de migração. O CI executa build, auditoria de dependências, CodeQL, 82 testes de contrato, testes de interface/browser com API mockada e wrangler deploy --dry-run.

**Fluxo de publicação:** somente se todos os jobs do CI mais recente da branch estiverem verdes, abrir PR de migracao-js-puro para main e efetuar merge conforme autorização do usuário. Em Cloudflare Workers Builds, o build command é npm run verify:production e o deploy command é npm run deploy:cloudflare. O deploy aplica migrations remote apenas após gate de segurança e então publica o Worker.

**Operação:** para rollback de código, restaurar o commit anterior da main e executar um novo build/deploy validado, preservando o D1. Não reverter migrations destrutivas sem plano de recuperação. Consulte docs/operations/data-recovery.md.
