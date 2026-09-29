# Agenda Prado

Sistema web para gestão diária das agendas de recebimento das lojas Prado Supermercados.

## Stack

- React 19 + TypeScript + Vite
- Hono em Cloudflare Workers
- Cloudflare D1
- Zod
- Vitest
- Playwright + axe para E2E e acessibilidade

## Perfis de acesso

- **admin**: administra lojas, usuários, importações, histórico e ajustes.
- **visualizador**: acompanha o dashboard administrativo em modo somente leitura.
- **conferente**: opera apenas a agenda da própria loja ativa.

A autorização real é aplicada no Worker. A interface também oculta ações que o perfil não pode executar.

## Desenvolvimento local

Pré-requisitos:

- Node.js 22 ou compatível com o CI;
- npm;
- Wrangler autenticado somente quando for necessário acessar recursos remotos.

Instale as dependências:

```bash
npm ci
```

Crie um arquivo local `.dev.vars`:

```text
SESSION_SECRET=defina-um-segredo-local-longo-e-aleatorio
```

Arquivos `.dev.vars*` e `.env*` são ignorados pelo Git e não devem ser versionados.

Prepare o D1 local:

```bash
npx wrangler d1 migrations apply DB --local
```

Inicie a aplicação:

```bash
npm run dev
```

Por padrão, Wrangler e o plugin Vite da Cloudflare usam `.wrangler/state` para o estado local. Esse diretório também é ignorado pelo Git.

## Comandos principais

| Comando | Função |
| --- | --- |
| `npm run dev` | Ambiente local com Vite + Worker |
| `npm test` | Testes Worker/UI e guards do projeto |
| `npm run test:worker` | Testes do Worker e D1 local |
| `npm run test:ui` | Testes da interface |
| `npm run test:e2e` | Build + D1 local isolado + Playwright Chromium + axe |
| `npm run typecheck` | TypeScript sem emissão |
| `npm run build` | Build de produção |
| `npm run verify:production` | Testes + typecheck + build |
| `npm run check:migrations` | Bloqueia migrations novas classificadas como destrutivas |
| `npm run deploy` | Verifica, aplica migrations remotas e publica o Worker |
| `npm run bootstrap-admin` | Bootstrap administrativo de emergência, somente break-glass |

## D1 e migrations

As migrations ficam em `migrations/`.

Para desenvolvimento:

```bash
npx wrangler d1 migrations apply DB --local
```

No fluxo normal de produção, **não aplique migrations remotas separadamente**. O comando oficial é `npm run deploy`, executado pelo Cloudflare Workers Builds, que segue esta ordem:

1. verificação completa da aplicação;
2. gate de segurança das migrations;
3. `wrangler d1 migrations apply DB --remote`;
4. `wrangler deploy`.

Mudanças incompatíveis de schema devem seguir expand/contract. Consulte [Release de produção](docs/operations/production-release.md).

## Primeiro administrador

Quando ainda não existe administrador, a tela de login oferece **Preparar primeiro administrador**.

Esse fluxo cria a conta inicialmente inativa e registra auditoria. A própria interface informa que a conta ainda precisa passar pela etapa operacional de ativação no D1. Não trate essa preparação como acesso imediatamente liberado.

O script `npm run bootstrap-admin` é um caminho separado de emergência. Ele é **create-only**, exige que não exista administrador ativo e rejeita um login já existente. Portanto, não deve ser usado para promover, reativar, trocar senha nem ativar uma conta previamente preparada pela interface.

Para o procedimento break-glass, consulte [Release de produção](docs/operations/production-release.md).

## Dashboard

O dashboard não usa polling periódico.

Ele atualiza:

- na carga e troca da data selecionada;
- após ações internas como importação ou reabertura;
- quando o usuário clica em **Atualizar**;
- silenciosamente quando a aba volta a ficar visível.

Isso evita consultas repetitivas ao D1 quando não há interação.

## Fechamento automático

O Worker possui Cron Trigger:

```text
5 3 * * *
```

Ele executa às 03:05 UTC, equivalente a 00:05 em `America/Sao_Paulo`, para fechar agendas anteriores à data operacional. As requisições HTTP mantêm o mesmo fechamento como fallback idempotente.

## Produção

A produção usa Cloudflare Workers Builds conectado à branch `main`.

O contrato versionado do release, migrations, rollback e bootstrap de emergência está em:

- [Release de produção](docs/operations/production-release.md)

Os planos e especificações técnicas ficam em `docs/superpowers/`.

## Segurança

- `SESSION_SECRET` é segredo de runtime e não deve ser versionado.
- Cookies de sessão são `HttpOnly`, `SameSite=Strict` e seguros em HTTPS.
- Sessões são versionadas e são revogadas após troca de senha.
- Conferentes precisam estar ativos e ligados a uma loja ativa/não removida.
- O login usa rate limiter com comportamento fail-closed.
- Códigos de loja são canonicalizados e possuem unicidade case-insensitive.
- Mutações críticas usam operações atômicas no D1 quando o contrato exige.
