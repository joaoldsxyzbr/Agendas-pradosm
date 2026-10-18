# Etapa 7 — repositório de agendas em JavaScript puro

Branch `migracao-js-puro`, 18/10/2026.

`worker/repositories/agendas.js` adicionado a partir do módulo transpilado, comparando funções e SQL de `worker/repositories/agendas.ts` da `main`. O contrato das 22 funções foi preservado e os imports relativos utilizam `.js`.

**Correção indispensável para equivalência com a produção:** a `preview` tem a coluna adicional `observacao` no D1 (migração 0017), mas a `main` não. Portanto a lista `APPOINTMENT_COLUMNS` foi copiada exatamente da `main` e `changeAppointmentStatus` foi convertida diretamente da função TypeScript da `main`: não exige motivo, não grava observação; se o status não muda, não escreve; quando muda, grava histórico, auditoria e ajuste administrativo conforme a lógica original.

Não houve mudanças de schema, migrações remotas, deploy nem modificação das branches `main`/`preview`. Testes de comportamento e integração com D1 isolado ainda necessários.
