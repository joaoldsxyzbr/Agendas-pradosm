# Etapa 8 — rotas administrativas e de loja, JS puro

Branch `migracao-js-puro` · 18/10/2026.

Convertidas `worker/routes/admin-agendas.js` e `worker/routes/store-agendas.js`, comparando todas as rotas e métodos HTTP diretamente com as fontes `.ts` da `main`. Imports ESM relativos usam `.js`.

**Paridade de banco e de comportamento:** removidos do código transpilado da `preview` o campo `observation` do JSON de agendamentos, a obrigatoriedade de motivo ao marcar não recebido e o argumento extra das alterações de status. Essas diferenças pertencem à `preview` e não à `main`. O status segue a validação original e o repositório grava as mesmas consultas e auditorias da produção, sem exigir migração 0017.

Novo teste estático `tests/migration/agenda-routes-parity.test.js` compara endpoints, garante ausência de campos exclusivos e valida extensões ESM. Requer execução posterior com Node no CI e E2E no D1 isolado.

Nenhum deploy ou edição de `main`, `preview`, Cloudflare ou D1.
