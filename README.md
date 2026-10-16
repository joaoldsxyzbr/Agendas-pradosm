# Agenda Prado

Sistema web de gestão das agendas de recebimento das lojas Prado Supermercados.

## Organização na raiz

| Pasta | Responsabilidade |
| --- | --- |
| `public/` | Interface HTML, CSS e JavaScript puro (telas em `public/vanilla/pages/`) |
| `worker/` | Backend Cloudflare Workers e APIs |
| `src/` | Fontes auxiliares de importação e exportação |
| `shared/` | Funções e contratos compartilhados |
| `migrations/` | Evolução do D1 |
| `tests/` | Testes automatizados |
| `scripts/` | Scripts de build e validação |
| `docs/` | Documentação e decisões |
| `.github/` | Automação e CI |

**Configurações na raiz:** `package.json`, `package-lock.json`, `wrangler.jsonc`, `wrangler.preview-migrations.jsonc`, `playwright.config.js` e `vitest*.config.js` permanecem no local esperado pelas ferramentas.

A divisão completa e as regras de organização estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Stack

- **Interface:** HTML, CSS e JavaScript puro (Vanilla JS, ES Modules), sem React, Vue ou Vite como ferramenta de build da aplicação.
- **API:** JavaScript com Hono no Cloudflare Workers.
- **Banco:** Cloudflare D1; `preview` isolada da produção.
- **Validação:** Zod. Preparação do extrator PDF com esbuild.
- **Testes:** Vitest e Playwright.

## Ambientes

- **`preview`:** desenvolvimento e testes com dados fictícios, antes de qualquer promoção.
- **`main`:** produção, dados reais.

Fluxo obrigatório: **preview → validar → main**. A promoção para `main` exige autorização explícita.

## Desenvolvimento

Pré-requisitos: Node.js 22, npm e Wrangler.

```bash
npm ci --legacy-peer-deps
npx wrangler d1 migrations apply DB --local
npm run dev
```

Para o desenvolvimento local, configure `SESSION_SECRET` em um arquivo `.dev.vars` não versionado. Não registre credenciais no Git.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Interface + Worker local |
| `npm test` | Testes e verificações do projeto |
| `npm run check:javascript` | Sintaxe JS e ausência de arquivos TypeScript |
| `npm run test:e2e` | E2E no Chromium com ambiente local |
| `npm run build` | Preparação do PDF e build de verificação |
| `npm run check:migrations` | Segurança das migrations |

A publicação e as migrations remotas devem seguir o [procedimento de release](docs/operations/production-release.md); não use comandos de produção para testar a `preview`.

## Documentação

- [Arquitetura e organização](docs/ARQUITETURA.md)
- [Guia operacional completo](docs/GUIA-OPERACIONAL.md) — perfis, usuários, dashboard, importação, presença, segurança e D1
- [Migração para JavaScript puro na preview](docs/preview-migracao-vanilla.md)
- [Acabamento visual da preview](docs/preview-acabamento-visual.md)
- [Release de produção](docs/operations/production-release.md)
- [Recuperação do D1](docs/operations/data-recovery.md)

As decisões e o histórico técnico permanecem no GitHub; tarefas pendentes devem ser acompanhadas nas Issues.
