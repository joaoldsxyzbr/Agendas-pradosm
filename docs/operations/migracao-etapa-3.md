# Etapa 3 — Repositórios e serviços do Worker

Branch: `migracao-js-puro` · 18/10/2026.

Conversão isolada, **sem alterar a aplicação executada**:

- `worker/repositories/audit.js`: 5 funções mantidas, conferidos 7/7 termos SQL da main/JS.
- `worker/repositories/presence.js`: 3 funções mantidas, conferidos 7/7 termos SQL da main/JS.
- `worker/repositories/stores.js`: 7 funções mantidas, conferidos 15/15 termos SQL da main/JS.
- `worker/repositories/users.js`: 9 funções mantidas, conferidos 25/25 termos SQL da main/JS.
- `worker/services/agenda-maintenance.js`: 1 funções mantidas, conferidos 7/7 termos SQL da main/JS.
- `worker/services/realtime.js`: 2 funções mantidas, conferidos 0/0 termos SQL da main/JS.

Origem das implementações JS: módulos transpilados existentes na `preview`, verificados contra o código-fonte correspondente da `main`; imports relativos agora usam extensão explícita `.js`. Os módulos `.ts` originais continuam intactos até que as rotas e a UI estejam plenamente portadas. **O repositório de agendas está fora desta etapa porque a `preview` tem diferenças no campo observação e schema D1**.

Adicionado `tests/migration/repositories-services.test.js` usando D1 falso para verificar parametrização, paginação de auditoria, sessão/usuário, fechamento automático, reabertura e inibição de tempo real desativado.

Status: sintaxe verificada estaticamente, testes de Node e regressão completos dependem do CI (falha do runner GitHub que ainda precisa ser diagnosticada); nenhum deploy ou acesso de gravação a D1 feito.
