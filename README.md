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

## Importação de agendas

A importação administrativa aceita **CSV e PDF**.

- **CSV é o formato principal**: uma exportação com `Filial: Todas` pode conter todas as lojas e é separada automaticamente por filial.
- **PDF é o formato de reserva**: PDFs individuais continuam compatíveis e PDFs consolidados com a coluna `Filial` também são agrupados por loja.
- O lote inteiro é validado antes de gravar. Loja ausente, linha não interpretada, total declarado divergente, data divergente ou conflito sem confirmação bloqueiam a operação.
- A gravação multi-loja usa um único `D1Database.batch()`, portanto uma falha em qualquer loja faz rollback do lote inteiro.
- O lote aceita até 700 agendamentos e ainda passa por uma verificação dinâmica do orçamento de operações do D1 antes da escrita atômica.
- Quando já existe agenda para alguma loja/data, a substituição precisa de confirmação explícita e preserva status, histórico e fornecedores manuais, seguindo o comportamento já existente.
- O formato interno das agendas e a interface do conferente não mudam. A alteração fica restrita à entrada administrativa dos dados.

Os arquivos reais exportados não devem ser versionados. Testes usam dados sintéticos, inclusive um lote de 121 agendamentos distribuídos em 9 unidades.

## Dashboard

Os dados de agenda do dashboard não usam polling periódico. Eles atualizam:

- na carga e troca da data selecionada;
- após ações internas como importação ou reabertura;
- quando o usuário clica em **Atualizar**;
- silenciosamente quando a aba volta a ficar visível.

A única atualização periódica é a **presença do conferente**, consultada por um endpoint pequeno e isolado a cada 60 segundos, sem recarregar agendas completas.

Todas as lojas e docas ativas exibem uma bolinha de presença:

- **verde / Online**: houve interação nos últimos 3 minutos;
- **amarelo / Ausente**: passaram mais de 3 minutos sem interação, mas existe sinal da aba nos últimos 7 minutos;
- **vermelho / Offline**: passaram mais de 7 minutos sem sinal, ou ainda não existe presença registrada.

A tela do conferente envia um heartbeat leve a cada 2 minutos. Eventos de mouse, teclado, foco e rolagem são agrupados localmente e não geram uma escrita no D1 por evento. Ao sair pelo botão **Sair**, a presença é encerrada imediatamente; queda de internet, travamento ou fechamento abrupto são tratados pela expiração de 7 minutos.

Se houver mais de um conferente vinculado à mesma loja/doca, o dashboard mostra o estado mais ativo entre eles.

### Infraestrutura realtime

A migração para atualização em tempo real está sendo feita em fases para não colocar a produção em risco.

A infraestrutura realtime usa:
- Durable Object `RealtimeHub` com WebSocket Hibernation;
- binding `REALTIME_HUB` no Worker;
- endpoint autenticado `/api/realtime`;
- validação de origem e identidade resolvida pelo servidor;
- protocolo realtime versionado;
- configuração `REALTIME_MODE` com fallback seguro para `off`.

Na fase de **shadow mode**, usuários autenticados abrem uma conexão WebSocket, com ping/pong e reconexão progressiva, mas **nenhuma informação exibida na interface depende dela**. Dashboard e presença continuam usando exatamente os fluxos HTTP/D1 atuais. O D1 permanece a fonte da verdade.

O endpoint `/api/realtime/config` informa o modo ativo apenas para sessões autenticadas. Valor ausente ou desconhecido é tratado como `off`.

O plano completo e os checkpoints de rollout estão registrados na issue #59.

## Fechamento automático

O Worker possui Cron Trigger:

```text
5 3 * * *
```

Ele executa às 03:05 UTC, equivalente a 00:05 em `America/Sao_Paulo`, para fechar agendas anteriores à data operacional. As requisições HTTP mantêm o mesmo fechamento como fallback idempotente.

## Produção

A produção usa Cloudflare Workers Builds conectado à branch `main`.

O contrato versionado de operação está em:

- [Release de produção](docs/operations/production-release.md)
- [Recuperação de dados do D1](docs/operations/data-recovery.md)

Os planos e especificações técnicas ficam em `docs/superpowers/`.

## Segurança

- `SESSION_SECRET` é segredo de runtime e não deve ser versionado.
- Cookies de sessão são `HttpOnly`, `SameSite=Strict` e seguros em HTTPS.
- Sessões são versionadas e são revogadas após troca de senha.
- Conferentes precisam estar ativos e ligados a uma loja ativa/não removida.
- O login usa rate limiter com comportamento fail-closed.
- Códigos de loja são canonicalizados e possuem unicidade case-insensitive.
- Mutações críticas usam operações atômicas no D1 quando o contrato exige.
