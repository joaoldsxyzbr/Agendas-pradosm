# Release de produção

Este documento registra o contrato operacional do deploy do `agendas-pradosm`.

## Caminho oficial

A produção usa **Cloudflare Workers Builds** conectado ao repositório `joaoldsxyzbr/Agendas-pradosm`.

Configuração confirmada em 29/09/2026:

- branch de produção: `main`;
- build command: `npm run verify:production`;
- deploy command: `npm run deploy`;
- diretório raiz: `/`;
- previews: desabilitados.

O deploy command deve permanecer **`npm run deploy`**. A documentação oficial da Cloudflare permite apontar Workers Builds para um script do `package.json`; o padrão da plataforma seria `npx wrangler deploy`, que não executaria sozinho as migrations deste projeto.

Referência oficial: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## Sequência obrigatória

O script `npm run deploy` executa, nesta ordem:

1. `npm run verify:production`;
2. `npm run check:migrations`;
3. `wrangler d1 migrations apply DB --remote`;
4. `wrangler deploy`.

O Worker só deve ser publicado depois de as migrations aditivas necessárias terem sido aplicadas.

As migrations ficam versionadas em `migrations/` e são registradas pelo D1 conforme a documentação oficial:

https://developers.cloudflare.com/d1/reference/migrations/

## Regra de schema

Novas migrations de produção devem ser aditivas.

Mudanças incompatíveis devem seguir expand/contract:

1. adicionar a nova estrutura compatível;
2. publicar código compatível com os dois formatos;
3. migrar o uso;
4. remover a estrutura antiga em uma release posterior e explicitamente revisada.

O guard `npm run check:migrations` bloqueia migrations novas classificadas como destrutivas.

## GitHub

A `main` deve operar por pull request, com os checks de CI e CodeQL concluídos antes do merge.

O workflow de CI roda inclusive para alterações somente em documentação. Isso evita que um check obrigatório fique ausente em PRs de docs.

O GitHub Actions de CI **não publica produção**. Não deve existir um segundo `wrangler deploy` em workflow GitHub.

## RealtimeHub

A infraestrutura realtime é introduzida de forma escura antes de qualquer tela depender dela.

A primeira release:
- exporta o Durable Object `RealtimeHub` com storage SQLite declarativo;
- adiciona o binding `REALTIME_HUB`;
- expõe `/api/realtime` apenas para sessões autenticadas e mesma origem;
- não altera a fonte da verdade dos dados;
- não altera o polling/fallback de presença;
- não exige migration D1.

A segunda release usa **shadow mode**:
- `REALTIME_MODE=shadow`;
- o frontend consulta `/api/realtime/config` após autenticação;
- abre um único WebSocket por sessão/aba;
- usa ping/pong leve e reconexão com backoff;
- não dirige presença nem dashboard;
- falha de config/WebSocket é ignorada pelo fluxo funcional atual.

Valor ausente ou inválido de `REALTIME_MODE` deve resultar em `off`.

A terceira release ativa **presença realtime com fallback**:
- `REALTIME_MODE=on`;
- conferente envia `presence.set` somente em transições Online/Ausente;
- heartbeat realtime a cada 20 segundos;
- inatividade visível de aproximadamente 30 segundos => Ausente;
- aba oculta => Ausente imediato;
- conexão sem heartbeat por aproximadamente 45 segundos => expirada pelo `RealtimeHub`;
- ADM/visualizador recebem `presence.snapshot` e `presence.changed`;
- múltiplas abas/conferentes da mesma loja são agregados pelo estado mais ativo;
- o polling de presença de 60 segundos fica suspenso enquanto o WebSocket está conectado;
- a tabela/endpoints D1 de presença e o heartbeat de 2 minutos permanecem ativos como fallback.

O Durable Object continua sem armazenar agendas ou mutações de negócio. Nesta fase, apenas presença visual usa o canal realtime.

Rollback da Fase 3: definir `REALTIME_MODE=off` e publicar. O dashboard volta ao fallback HTTP/D1 sem reversão de dados. Não remover a tabela `conferente_presenca` nem o namespace do Durable Object durante incidente.

O rollout completo está documentado na issue #59.

## Checklist de release

Antes do merge:

- CI verde;
- CodeQL verde;
- migration nova revisada como aditiva, quando houver;
- `npm run deploy` preservado como deploy command do Workers Builds.

Depois do merge:

- Workers Build concluído;
- migrations remotas aplicadas sem erro, quando houver;
- nova versão do Worker publicada;
- smoke funcional básico confirmado.

## Recuperação

Como o projeto usa migrations aditivas, o rollback de aplicação consiste em republicar uma versão anterior compatível do Worker.

Não executar rollback destrutivo de schema como resposta automática. Se uma estrutura antiga precisar ser removida ou restaurada, tratar isso como uma release específica e revisada.

Incidentes de perda, corrupção ou alteração indevida de dados do D1 seguem o runbook específico:

- [Recuperação de dados do D1](data-recovery.md)

O restore de dados não deve ser confundido com rollback de aplicação. Antes de qualquer Time Travel, registre o bookmark atual e valide o ponto de recuperação.


### Impacto da migration 0015

A migration `0015_user_session_version.sql` adiciona versionamento de sessão. Cookies emitidos antes dessa release não possuem `sessionVersion` e serão rejeitados após o novo Worker entrar em produção. O efeito esperado é um único novo login por usuário após o deploy.


### Impacto da migration 0016

A migration `0016_conferente_presence.sql` é aditiva e cria somente a tabela/índice usados para presença dos conferentes. Ela não altera agendas, agendamentos, lojas nem usuários existentes.

Após o deploy, lojas e docas aparecem inicialmente como **Offline** até que o conferente abra a tela e envie o primeiro sinal. O fluxo oficial `npm run deploy` aplica a migration remota antes de publicar o Worker que depende dela.

## Bootstrap administrativo de emergência

O comando `npm run bootstrap-admin` é um procedimento **break-glass**. Ele não substitui o cadastro normal de usuários nem deve ser usado para redefinir senha, promover papel ou reativar conta existente.

Pré-condições:

- não pode existir administrador ativo e não removido;
- `ADMIN_LOGIN` não pode existir, inclusive com diferença apenas de maiúsculas/minúsculas;
- `ADMIN_PASSWORD` deve ter pelo menos 12 caracteres.

O script:

1. executa um preflight remoto no D1;
2. cria uma nova conta admin somente se as pré-condições continuarem válidas;
3. registra `admin_provisionado_emergencia` na tabela `auditoria`;
4. executa uma verificação remota e só termina com sucesso se usuário e auditoria existirem.

A criação e a verificação usam `wrangler d1 execute --remote`. Não tratar o CLI como garantia de atomicidade entre comandos separados. Se o processo falhar após alguma escrita, revisar o D1 e a auditoria antes de repetir.

Nunca usar esse script em testes automatizados contra o banco remoto.
