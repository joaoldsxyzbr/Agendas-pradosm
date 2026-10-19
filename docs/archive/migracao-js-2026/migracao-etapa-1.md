# Migração para JS puro — etapa 1 (18/10/2026)

**Escopo:** contratos JavaScript e parsers de agendas, exclusivamente na branch `migracao-js-puro`.

Arquivos convertidos de fontes da `main`:

- `shared/agenda.js` (equivalente ao arquivo `.ts`)
- `shared/api.js` (equivalente ao arquivo `.ts`)
- `shared/realtime.js` (equivalente ao arquivo `.ts`)
- `shared/store.js` (equivalente ao arquivo `.ts`)
- `shared/time.js` (equivalente ao arquivo `.ts`)
- `src/import/extractPdfText.js` (equivalente ao arquivo `.ts`)
- `src/import/parseAgendaBatch.js` (equivalente ao arquivo `.ts`)
- `src/import/parseAgendaText.js` (equivalente ao arquivo `.ts`)
- `shared/auth.js` (equivalente ao arquivo `.ts`)

Estes módulos usam a versão JavaScript já transpilada no histórico do próprio repositório (branch `preview`) quando o código corresponde à lógica da `main`. Imports relativos foram ajustados para `.js`. `shared/auth.js` está vazio porque a origem continha somente tipos e nenhum comportamento.

**Nota de segurança:** os `.ts` antigos continuam neste momento para manter a aplicação `main` funcional enquanto a conversão do restante é realizada. Esta etapa ainda não substitui o runtime nem remove dependências. Nenhum arquivo de configuração de produção, banco, Workers publicados ou branch `main` foi modificado.

Validação inicial: sintaxe JavaScript dos novos módulos verificada antes de adicionar. Testes nativos com Node em `tests/migration/shared-contracts.test.js` (**execução e E2E pendentes**).

Próximas etapas: converter backend/Worker mantendo contratos e cron; converter frontend fielmente à `main` (sem mudar visual ou comportamento); converter testes; remover TS/React/Vite; CI + paridade; homologar na `preview`.