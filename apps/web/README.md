# Novo frontend — React/TypeScript (em migração)

**Estado:** ambiente paralelo e isolado. As telas exibem explicitamente
"Em migração" e **não executam operações reais** enquanto não forem portadas.

## Rodar no computador

No diretório raiz do repositório:

```bash
npm ci --legacy-peer-deps
npm ci --prefix apps/web
npm run dev
```

Em outro terminal:

```bash
npm run dev --prefix apps/web
```

Abrir `http://127.0.0.1:5173/login`. O Vite usa proxy de
`/api` para o Wrangler local em `http://127.0.0.1:8787`.
A aplicação antiga permanece independente na porta do Wrangler.

**Não usar credenciais de produção em ambiente local.** O D1 de desenvolvimento
é o configurado em `wrangler.local.jsonc`. Para testar sem contas, o CI usa
respostas sintéticas no Playwright, sem D1 remoto.

## Qualidade e build

```bash
npm run check --prefix apps/web
npx playwright test --config apps/web/playwright.config.mjs
```

O build novo gera `dist-modern/`, que não é publicado pela configuração
`wrangler.jsonc` ou `wrangler.preview.jsonc`. O build antigo permanece em `dist/`.

## Arquitetura

- `src/app/`: rotas, layout e integração com sessão.
- `src/features/auth/`: cliente de autenticação sem reimplementar o backend.
- `src/components/`: componentes e tokens compactos estilo shadcn/ui.
- `src/features/placeholder-page.tsx`: sinalização de tela ainda não migrada.
- `src/lib/api.ts`: fetch same-origin com cookies e respostas de erro.

A configuração `components.json` permite adicionar componentes oficiais
shadcn/ui nas próximas etapas. O Button inicial segue o padrão de composição,
mas ainda não representa migração de todas as telas.

## Segurança e limites

- Acesso de frontend é apenas navegação; o Worker é a autoridade.
- Não altera APIs, D1, WebSockets, cron, limites, sessões ou migrations.
- Sem CDN. Vite serve assets locais e o Worker antigo permanece no caminho
  oficial até aprovação de paridade funcional.
- Antes de substituir `dist/`, validar CSP, PDFs/WASM, rotas profundas,
  os três perfis e dez telas com dados sintéticos e preview isolada.
