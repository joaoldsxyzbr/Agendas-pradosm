# Migração — build JS puro isolado

Branch: `migracao-js-puro`. **Não é um ambiente publicado.**

## Objetivo

Testar a conversão sem mexer no build React/Vite atualmente usado por `main` e `preview`.

1. `npm ci --legacy-peer-deps`
2. `npm run migracao:build` — gera o diretório `dist/` estático a partir de JS nativo, quatro CSS originais da `main`, módulos compartilhados e PDF com pacote WASM vendorizado localmente e mapeado por importmap.
3. `npx wrangler d1 migrations apply DB --local --config wrangler.migracao.jsonc` — inicializa **somente o D1 local** da migração, nunca `--remote`.
4. Defina `SESSION_SECRET` apenas em `.dev.vars` local (não commitar) e rode `npm run migracao:dev`.
5. `npm run migracao:test` — verifica imports e contratos. Validação real no navegador ainda obrigatória.

O arquivo `wrangler.migracao.jsonc` usa nome próprio, ID D1 sintético e modo realtime `off`, para impedir interação com recursos produtivos no modo local. **Não executar `wrangler deploy --config wrangler.migracao.jsonc`**.

O `index.html` original permanece React; o build gera uma cópia com `/migration/frontend/entry.js` e CSS em `dist/index.html`. Uma futura troca de produção só deve ocorrer depois de validação de ponta a ponta e autorização explícita.

A compatibilidade do empacotamento de `@llamaindex/liteparse-wasm` com importmap/ES Modules precisa ser verificada em navegador real. Se o pacote exigir bundling, tratar isoladamente o leitor PDF antes de homologar; **não eliminar a funcionalidade de PDF**.