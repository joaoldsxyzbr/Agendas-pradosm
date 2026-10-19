# Etapa 11 — frontend nativo: tempo real, presença e Lojas

Data: 18/10/2026. Branch de trabalho: `migracao-js-puro` (produção intacta).

## Módulos implementados

- `migration/frontend/realtime.js`: WebSocket da `main` em JS puro; eventos versionados, handshake, ping/pong, reconexão e revogação por código 4003.
- `migration/frontend/presence.js`: presença D1 do conferente, heartbeat de 2 minutos, inatividade de 30 segundos, comunicação via WebSocket e desconexão explícita.
- `migration/frontend/stores.js`: primeira tela administrativa convertida, com busca, filtro, contadores e colunas Código → Nome → Situação → Ações, utilizando as classes CSS da `main`.
- `migration/frontend/store-dialog.js`: cadastro, edição, ativação/desativação, exclusão com confirmação e histórico de auditoria, mantendo as mesmas chamadas HTTP.
- Testes `tests/migration/realtime-client.test.js` e `tests/migration/stores-page-contract.test.js` adicionados para os contratos dessas operações.
- `scripts/check-migracao-frontend.mjs`: valida sintaxe JavaScript, resoluções ESM e ausência de imports React.

## Evidências e limitações

Testes isolados durante o desenvolvimento verificaram handshake WebSocket, envio de evento, encerramento de timers, presença D1 com DELETE no logout, navegação por papel, autenticação e assinatura do PDF. **Não equivalem a E2E nem a aprovação de CI.**

O backend JS e este frontend continuam separados e ainda não são os entrypoints publicados. O `index.html` da `main` segue em React/TSX. **Não ativar esta interface antes da migração total das telas.**

Pendentes: dashboard, conferente, usuários, importação, histórico, paridade pixel/fluxos, remoção final de React/TypeScript/Vite e homologação. O GitHub Actions continua falhando precocemente e seus logs não estão disponíveis pela integração.

A `main`, a `preview`, o Worker de produção e os bancos D1 não sofreram alteração.