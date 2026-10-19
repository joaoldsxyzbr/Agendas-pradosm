# Etapa 4 — Rotas e tempo real em JavaScript puro

Branch: `migracao-js-puro`. Data: 18/10/2026.

Convertemos as rotas `admin-audit`, `admin-stores`, `admin-users`, `presence` e `realtime`, além de `worker/middleware/auth.js` e `worker/realtime/RealtimeHub.js`.

Os endpoints e a quantidade de funções haviam sido comparados com as fontes da `main` antes da conversão. O código JavaScript usa importações ESM com extensões `.js`. A autenticação mantém as restrições por perfil; o Durable Object mantém publicação, eventos e revogação de sessões.

Teste de paridade estrutural: `node --test tests/migration/routes-parity.test.js`.

**Pendente:** validar comportamento em E2E, concluir rotas de agenda e autenticação, converter `worker/app`, `worker/index` e todo o frontend. Não copiar `worker/app.js` da preview: ela tem relatórios exclusivos. Nenhuma mudança na `main`, `preview`, Worker ativo ou D1.
