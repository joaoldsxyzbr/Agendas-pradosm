# Etapa 9 — verificações de integração do backend JS

Branch `migracao-js-puro`, 18/10/2026.

Agora todos os módulos originais do diretório `worker/` e os seis módulos `shared/` possuem correspondentes `.js` versionados, sem alterar os arquivos TypeScript originais. O backend **ainda não foi ativado**: configuração `wrangler.jsonc` e `main` permanecem intocadas.

Verificadores adicionados:
- `node scripts/check-migracao-worker.mjs`: confere a presença dos 35 módulos JS, executa `node --check`, proíbe sintaxe TypeScript e garante que imports relativos `.js` apontem para arquivos existentes.
- `node --test tests/migration/agenda-status.test.js`: valida que mudança de status grava os mesmos 3 statements que a `main`, e que status inalterado não escreve.
- Contratos e rotas anteriores continuam em `tests/migration/`.

Houve execução isolada, independente de Node/Cloudflare, da função de status no ambiente de preparação do commit: passou as verificações de status inalterado, alteração, auditoria e ausência de coluna extra.

**Pendente:** rodar todos os testes com Node e integração D1 mockada, pois GitHub Actions continua falhando antes de fornecer logs. Falta conversão do frontend, PDF e testes TS, remoção da stack antiga e homologação. Nenhum deploy, alteração de banco, `preview` ou `main`.
