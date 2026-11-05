# Frontend React — Agenda Prado

O frontend React 19, Vite, TypeScript estrito e Tailwind CSS é a interface oficial das branches `main` (produção) e `preview` (homologação isolada). Não existem páginas provisórias de migração na interface publicada.

## Execução local

Na raiz do repositório:

```bash
npm ci --legacy-peer-deps
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev
```

O comando `npm run dev` compila o React e serve `dist/` pelo Wrangler local (normalmente `http://127.0.0.1:8787`), com API e D1 local. É necessário configurar um `SESSION_SECRET` **local** em `.dev.vars` (não versionar).

Para desenvolver a interface com atualização automática, mantenha o Wrangler local no primeiro terminal e execute, em outro:

```bash
npm ci --prefix apps/web
npm run dev --prefix apps/web
```

Acesse `http://127.0.0.1:5173/login`; o Vite encaminha `/api` ao Worker local. Nunca use credenciais ou dados reais de produção no ambiente local.

## Build e testes

```bash
npm run check --prefix apps/web
npx playwright test --config apps/web/playwright.config.mjs
npm run verify:production
```

- `apps/web` compila em `dist-modern/`; o build da raiz integra esses arquivos em `dist/`, publicado pelo Worker em produção e homologação.
- Os testes Playwright simulam o backend com dados sintéticos e verificam os três perfis.
- `src/app/`: rotas e sessão; `src/features/`: funcionalidades; `src/components/`: componentes; `src/lib/api.ts`: chamadas de mesma origem.
- A autorização efetiva e as regras de negócio ficam no Worker, não no frontend.

## Preview Cloudflare

A branch `preview` publica o React na **raiz** (`/login`, `/admin`, `/app`), não em `/modern/` ou por rotas com hash. O Worker de teste usa `wrangler.preview.jsonc` com D1 separado. Builds e testes locais não substituem a validação do deploy de homologação.
