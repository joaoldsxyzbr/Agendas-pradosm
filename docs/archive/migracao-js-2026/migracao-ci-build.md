## Build de migração — atualização

Comandos de migração disponíveis na branch:
- `npm run migracao:build`: gera `dist/` com JS puro, HTML, quatro CSS originais e os artefatos locais da biblioteca PDF/WebAssembly.
- `node scripts/check-migracao-build.mjs`: valida os arquivos emitidos, a ausência do entrypoint React, as folhas CSS e os arquivos PDF importados.
- `npm run migracao:dev`: utiliza o Wrangler local de migração e não o banco real.
- `npm run migracao:test`: verifica código JS e testes de contratos. Requer Node 22.

O CI agora inclui as verificações de build nativo, sem substituir `npm run verify:production` enquanto o frontend React continuar publicado.

**Restrições:** todos os testes e o build ainda precisam ser executados em ambiente real. O GitHub Actions encerra os jobs com 0 milissegundos faturáveis; a API de logs retorna 404. É necessário diagnosticar o runner na interface GitHub antes de atribuir a falha ao código.

Nenhuma promoção para `preview` ou `main`; nenhuma operação remota no D1.