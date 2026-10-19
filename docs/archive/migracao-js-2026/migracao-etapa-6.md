# Migração — etapa 6: autenticação nativa

Branch `migracao-js-puro` · 18/10/2026.

A rota `worker/routes/auth.js` foi convertida **diretamente** de `worker/routes/auth.ts` da `main` (remoção de anotações puramente TypeScript e imports ESM explícitos). Não foi copiada a implementação da `preview`, que contém login de demonstração fora do escopo de produção.

Rotas preservadas: `get /bootstrap-status`, `post /bootstrap-register`, `post /login`, `post /logout`, `get /me`.

Preservados rate-limit, verificação/upgrade de hash da senha, cookies seguros, validade de sessão, perfil de conferente, revogação de acesso em logout e retorno do usuário autenticado. Teste de paridade estática: `tests/migration/auth-contract.test.js`. CI/E2E ainda pendentes; nenhuma alteração ao Worker ativo.