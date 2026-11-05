# Agenda Prado

Sistema web para gestão diária das agendas de recebimento das lojas Prado Supermercados.

## Stack

- **React 19, Vite, TypeScript estrito e Tailwind CSS** na interface, publicada na raiz do Worker
- Hono em Cloudflare Workers
- Cloudflare D1
- Zod
- Testes Node.js nativos e validação do Worker
- Playwright + Chromium com APIs mockadas para os testes de navegador

## Perfis de acesso

- **admin**: administra lojas, usuários, importações, histórico e ajustes.
- **visualizador**: consulta o dashboard e os relatórios gerenciais, sempre em modo somente leitura.
- **conferente**: opera apenas a agenda da própria loja ativa.

A autorização real é aplicada no Worker. A interface também oculta ações que o perfil não pode executar.

### Ativação de usuários e visibilidade das lojas

- O administrador pode **Desativar usuário** e **Ativar usuário** sem excluir cadastro, vínculo, senha ou histórico. A ação exige confirmação.
- Um usuário desativado perde o acesso e as sessões anteriores são invalidadas; depois de reativado, entra novamente com o mesmo login e senha.
- O dashboard administrativo e do visualizador mostra apenas lojas ativas que tenham pelo menos um conferente ativo. Se houver vários, a loja permanece visível enquanto um deles estiver ativo.
- A importação CSV/PDF continua recebendo e preservando agendas de lojas cadastradas e ativas mesmo sem conferente ativo. Ao reativar o conferente, as agendas e histórico voltam a aparecer.
- Usuários inativos continuam consultáveis na tela de cadastros. Desativar **usuário** não desativa a **loja**; a importação segue exigindo que a loja esteja ativa.


## Organização do repositório

As branches `main` (produção) e `preview` (homologação) utilizam a interface React de `apps/web/`, publicada na raiz pelo fallback SPA do Worker. A `preview` mantém ambiente e D1 isolados e pode receber mudanças ainda não integradas à `main`.

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `apps/web/` | Interface React (Vite, TypeScript estrito) de produção e homologação |
| `worker/` | API, autenticação, serviços, D1 e tempo real do Cloudflare |
| `shared/` | Contratos, datas e validações usados pelo Worker e pela UI |
| `shared/import/` | Parser CSV/PDF de agendas, reaproveitado pelo React |
| `migrations/` | Histórico **imutável** de migrações do D1 |
| `public/` | Ícone e headers HTTP (CSP) |
| `tests/unit/`, `tests/fixtures/` | Testes JavaScript e dados sintéticos |
| `apps/web/tests/` | E2E Playwright do React com API mockada |
| `scripts/` | Build, testes de integridade e bootstrap administrativo |
| `docs/operations/` | Procedimentos atuais; `docs/archive/` guarda históricos de migração |
| `wrangler.jsonc`, `wrangler.local.jsonc` | Produção e ambiente local sintético |

**Branches:** `main` = produção com React; `preview` = homologação React com D1 separado, em https://previewagendaspradosm.joaolds.xyz.br. Mudanças devem ser validadas em PR com CI verde antes da mesclagem.

Leia [Arquitetura](docs/architecture.md), [Índice da documentação](docs/README.md) e [Publicação segura](docs/operations/production-release.md). Ambas as branches usam React; cada ambiente mantém suas próprias configurações e recursos Cloudflare.

## Desenvolvimento local

Pré-requisitos:

- Node.js 22 ou compatível com o CI;
- npm;
- Wrangler autenticado somente quando for necessário acessar recursos remotos.

Instale as dependências:

```bash
npm ci --legacy-peer-deps
```

Crie um arquivo local `.dev.vars`:

```text
SESSION_SECRET=defina-um-segredo-local-longo-e-aleatorio
```

Arquivos `.dev.vars*` e `.env*` são ignorados pelo Git e não devem ser versionados.

Prepare o D1 local:

```bash
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
```

Inicie a aplicação:

```bash
npm run dev
```

O Wrangler usa `.wrangler/state` para o D1 local, com banco sintético configurado em `wrangler.local.jsonc`. Esse diretório é ignorado pelo Git. `npm run dev` compila o React com Vite e publica os assets locais por meio do Wrangler.

## Comandos principais

| Comando | Função |
| --- | --- |
| `npm run dev` | Worker com D1 exclusivamente local servindo a UI React de `dist/` |
| `npm test` | Testes de contratos e funcionalidades JavaScript |
| `npm run test:bootstrap-admin` | Segurança do bootstrap emergencial |
| `npx playwright test --config apps/web/playwright.config.mjs` | UI React no Chromium com APIs mockadas |
| `npm run build` | Bundle React de produção em `dist/` |
| `npm run verify:production` | Migrations, testes, bootstrap e build íntegro |
| `npm run check:migrations` | Bloqueio de migrations destrutivas não aprovadas |
| `npm run deploy` | Validação, migrations remotas e publicação explícita |
| `npm run bootstrap-admin` | Bootstrap emergencial (somente com aprovação operacional) |

## D1 e migrations

As migrations ficam em `migrations/`.

Para desenvolvimento:

```bash
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
```

No Cloudflare Workers Builds, o **build command** é `npm run verify:production` (migrations, testes, segurança e build) e o **deploy command** é `npm run deploy:cloudflare` (gate de migrations, aplicação remota do D1 e publicação do Worker). O comando local `npm run deploy` executa as duas etapas em sequência. **Não aplique migrations remotas separadamente nem execute deploy sem autorização operacional.**

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

A tela de Recebimento consulta agendas e presença a cada **30 segundos**, além de atualizar ao receber eventos WebSocket, ao retomar o foco e quando o usuário seleciona outra data ou clica em **Atualizar**. As lojas são consultadas a cada 60 segundos. O polling HTTP/D1 continua ativo como reconciliação quando o WebSocket falha.

A presença do conferente usa dois canais complementares:

- **WebSocket**, com status `online` enquanto a aba está visível e houve interação nos últimos 3 minutos; `away` quando a aba está oculta ou sem atividade recente; e `offline` quando não há conexão válida.
- **HTTP/D1**, com sinal enviado a cada 30 segundos: Online até 3 minutos desde a última interação, Ausente com sinal recente sem interação e Offline após 7 minutos sem sinal.

O cliente mantém ping/pong WebSocket a cada 30 segundos, e o Durable Object descarta conexões sem atividade válida depois de cerca de 2 minutos. Se houver várias sessões na mesma loja, o painel prioriza a condição mais ativa. O D1 permanece a fonte de verdade dos dados de agenda.

### Infraestrutura realtime

A infraestrutura de atualização em tempo real está ativa na produção e possui fallback HTTP.

A infraestrutura realtime usa:
- Durable Object `RealtimeHub` com WebSocket Hibernation;
- binding `REALTIME_HUB` no Worker;
- endpoint autenticado `/api/realtime`;
- validação de origem e identidade resolvida pelo servidor;
- protocolo realtime versionado;
- configuração `REALTIME_MODE` com fallback seguro para `off`.

A produção usa `REALTIME_MODE=on` e a configuração de homologação usa `off`. O Durable Object mantém apenas estado efêmero de conexão/presença; o D1 permanece a fonte da verdade dos dados de negócio.

O endpoint `/api/realtime/config` informa o modo ativo apenas para sessões autenticadas. Valores desconhecidos são tratados como `off`. O endpoint HTTP/D1 permanece como fallback e reconciliação periódica.

### Dashboard em tempo real

Depois da presença, o mesmo canal realtime passa a sinalizar mudanças operacionais do dashboard:

- status Recebido/Não recebido/Aguardando;
- Trocas;
- fornecedor sem agenda criado, editado ou removido;
- concluir e reabrir dia;
- ajustes administrativos;
- importação individual, substituição e importação em lote.

A regra é sempre **D1 primeiro, evento depois**. O Durable Object não replica agenda nem agendamento. Ele transmite apenas um evento `agenda.changed` com identificadores, data e motivo da invalidação.

O ADM/visualizador:
- recarrega somente quando a data do evento é a data atualmente selecionada;
- invalida consultas relevantes quando recebe eventos, mantendo o polling como mecanismo de reconciliação;
- o modal **Ver detalhes** (tela de Conferência do admin) não usa realtime: atualiza por polling de 30 segundos, ao voltar para a aba e pelo botão **Atualizar**;
- mantém reconciliação ao voltar para a aba e o botão **Atualizar** como fallback.

Falha ao publicar um evento realtime é registrada, mas **não desfaz nem invalida a mutação que já foi confirmada no D1**.

O plano completo e os checkpoints de rollout estão registrados na issue #59.

## Fechamento automático

O Worker possui Cron Trigger:

```text
5 3 * * *
```

Ele executa às 03:05 UTC, equivalente a 00:05 em `America/Sao_Paulo`, para fechar agendas anteriores à data operacional. As requisições HTTP mantêm o mesmo fechamento como fallback idempotente. Na mesma execução, o job de retenção exporta para o R2 e depois purga `historico_status`/`historico_agenda` com mais de 12 meses e `auditoria` com mais de 24 meses; sem o bucket de retenção configurado, nada é purgado (política e endpoints em `docs/operations/retencao-e-backup-2026-11-05.md`).

## Produção

A produção usa Cloudflare Workers Builds conectado à branch `main`.

O contrato versionado de operação está em:

- [Release de produção](docs/operations/production-release.md)
- [Recuperação de dados do D1](docs/operations/data-recovery.md)

Os planos e especificações técnicas ficam em `docs/superpowers/`.

## Segurança

- `SESSION_SECRET` é segredo de runtime e não deve ser versionado.
- Cookies de sessão são `HttpOnly`, `SameSite=Strict` e seguros em HTTPS.
- Sessões usam janela de 30 dias e são renovadas automaticamente durante o uso, no máximo uma vez por dia, evitando login diário sem criar uma credencial eterna.
- Sessões são versionadas e são revogadas após troca de senha ou mudança do status ativo/inativo do usuário.
- Conferentes precisam estar ativos e ligados a uma loja ativa/não removida.
- O login usa rate limiter com comportamento fail-closed.
- Códigos de loja são canonicalizados e possuem unicidade case-insensitive.
- Mutações críticas usam operações atômicas no D1 quando o contrato exige.
