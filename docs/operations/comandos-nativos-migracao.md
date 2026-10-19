# Fluxo nativo JS — comandos da branch migracao-js-puro

A aplicação migrada usa **HTML + CSS + ES Modules e Worker JavaScript** quando os comandos padrão desta branch são executados. A stack React/TS/Vite original continua arquivada temporariamente como referência e testes legados; ela não é carregada pelo runtime migrado.

```bash
npm ci --legacy-peer-deps
npm run dev      # build nativo + Wrangler local, DB sintético
npm run build    # dist/index.html sem React/Vite
npm test         # contratos e validações JavaScript
npm run verify:legacy  # valida a versão anterior, como referência
```

Os comandos `npm run deploy` e `npm run deploy:cloudflare` **falham intencionalmente** nesta branch. O `wrangler.jsonc` produtivo não foi alterado. O desenvolvimento usa `wrangler.migracao.jsonc` com D1 local sintético.

### Portabilidade e limitações

Ainda é necessário executar `npm ci` e os testes num ambiente com dependências; o atual CI remoto termina antes de criar logs. A remoção das dependências React/TS/Vite do manifesto e lockfile deverá ser feita quando a nova aplicação estiver homologada no navegador: uma remoção prematura invalidaria os testes legados enquanto a produção continua em React.

O branch segue isolado, sem deploy, com todos os testes e documentação versionados. A aprovação da `preview` deve anteceder qualquer atualização da `main`.
