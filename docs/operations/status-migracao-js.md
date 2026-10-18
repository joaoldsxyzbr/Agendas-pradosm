# Status da conversão para JavaScript puro — 18/10/2026

Branch de trabalho: `migracao-js-puro`, derivada da `main`. Esta documentação registra progresso real e pendências, sem inferir aprovação dos testes.

## Código JS incorporado, ainda não ativado

- Os módulos de runtime de `worker/` agora possuem equivalentes `.js` (entrada, autenticação, middleware, Durable Object, rotas, repositórios, serviços e bibliotecas).
- Os arquivos `shared/` e parsers de `src/import/` têm versões JS.
- As rotas e funções de agenda foram comparadas com a `main`. A exigência de motivo do não recebimento e a coluna `observacao` da `preview` **não foram levadas**, pois alterariam contratos e exigiriam migração D1 de produção.
- O backend Node/Cloudflare **ainda usa TS no entrypoint Wrangler atual**; os `.ts` permanecem até a troca atômica, após testes.
- Um teste isolado da lógica migrada de status executado durante a preparação passou; ele não substitui os testes reais Node/Worker.

## Validações de migração

- `node scripts/check-migracao-worker.mjs`: verifica a sintaxe e os caminhos dos imports ESM dos arquivos runtime migrados.
- `node --test tests/migration/*.test.js`: verifica contratos básicos, regras de banco, status, presença, rotas e API.
- `npm run verify:production`: mantém os testes existentes da versão TypeScript enquanto ainda é o runtime ativo.

O workflow `.github/workflows/migracao-js-puro.yml` executa as três verificações, mas **segue vermelho com falha imediata e logs HTTP 404 na integração GitHub**. Não afirmar CI verde.

## Pendente para completar a missão

1. Converter fielmente o frontend React/TSX da `main`, com mesmas URLs, telas, acessibilidade, aparência, importação, PDFs e atualização incremental sem piscar.
2. Migrar todo o conjunto de testes, substituir configs e eliminar React/TypeScript/Vite do projeto final.
3. Executar e aprovar testes Node, Workers, E2E, CI e homologação com D1 isolado.
4. Apenas após validação do usuário e autorização, seguir `migracao-js-puro → preview → main`.

Não foi feito deploy nem alteração de `main`, `preview` ou bancos de dados.
