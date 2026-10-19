# Migração — etapa 5: entrada do Worker

18/10/2026. Branch `migracao-js-puro`.

Adicionados `worker/app.js`, `worker/index.js`, `worker/env.js` derivados **diretamente** das fontes TypeScript da `main`, sem alterar API, regras ou infraestrutura.

A composição dos middlewares, dos endpoints e das verificações de sessão foi preservada. Não foram incluídas as rotas exclusivas de demonstração ou relatórios da `preview`. O entrypoint mantém a exportação `RealtimeHub` e o evento `scheduled` que conclui agendas de dias anteriores. As declarações TS exclusivamente de tipo de `worker/env.ts` foram omitidas em `worker/env.js` porque não fazem parte do runtime.

Verificação de contrato: `node --test tests/migration/app-contract.test.js`; execução em CI ainda pendente. A configuração Wrangler não foi modificada, e o Worker em produção **não** utiliza estes arquivos ainda. Restam as rotas complexas, o frontend, a remoção dos arquivos TypeScript e a homologação.