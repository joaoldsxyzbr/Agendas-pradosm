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
4. observar pelo menos uma release estável;
5. executar a etapa contract somente em release posterior e explicitamente revisada.

O guard `npm run check:migrations` bloqueia por padrão toda migration nova classificada como destrutiva.

Quando uma etapa **contract** for realmente necessária, ela só pode passar pelo caminho oficial se existir uma entrada correspondente em `migrations/contract-approvals.json` contendo:

- nome exato do arquivo;
- operação destrutiva detectada;
- SHA-256 exato do conteúdo SQL;
- issue GitHub de aprovação;
- responsável pela aprovação;
- data/hora da aprovação;
- justificativa operacional.

Qualquer alteração posterior no SQL muda o SHA-256 e invalida automaticamente a aprovação. O manifesto é versionado junto do código, portanto a exceção fica explícita e auditável no PR e no histórico Git.

## GitHub

A `main` deve operar por pull request.

O workflow **CI** publica um único gate obrigatório chamado `verify`. Esse gate só passa depois de:

- testes, typecheck, build e E2E;
- auditoria de dependências de produção;
- análise CodeQL JavaScript/TypeScript.

Assim, o contexto `verify` não fica ambíguo e representa o conjunto completo de qualidade + segurança. O workflow manual foi renomeado para **Manual Verify** e usa o contexto separado `agenda-prado/manual-verify`.

O workflow de CI roda inclusive para alterações somente em documentação. Isso evita que um check obrigatório fique ausente em PRs de docs.

A proteção administrativa esperada no GitHub é:

- exigir pull request para `main`;
- exigir o check `verify`;
- impedir bypass administrativo, salvo procedimento break-glass explicitamente registrado.

A integração GitHub usada pelo projeto não possui permissão de administração para alterar branch protection. Essa configuração deve ser mantida na área administrativa do repositório e revisada durante auditorias.

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
- ping/pong hibernável do WebSocket também conta como sinal de liveness;
- inatividade visível de aproximadamente 30 segundos => Ausente;
- aba oculta => Ausente imediato;
- conexão sem heartbeat nem ping válido por aproximadamente 2 minutos => expirada pelo `RealtimeHub`;
- fechamento normal/logout continuam refletindo Offline sem aguardar a expiração;
- ADM/visualizador recebem `presence.snapshot` e `presence.changed`;
- múltiplas abas/conferentes da mesma loja são agregados pelo estado mais ativo;
- a tabela/endpoints D1 de presença e o heartbeat de 2 minutos permanecem ativos como fallback.

O Durable Object continua sem armazenar agendas ou mutações de negócio. Nesta fase, apenas presença visual usa o canal realtime.

Rollback da Fase 3: definir `REALTIME_MODE=off` e publicar. O dashboard volta ao fallback HTTP/D1 sem reversão de dados. Não remover a tabela `conferente_presenca` nem o namespace do Durable Object durante incidente.

A quarta release ativa **eventos realtime do dashboard**:
- mutações continuam sendo concluídas no D1 antes de qualquer publicação;
- após sucesso, o Worker envia `agenda.changed` ao `RealtimeHub`;
- o evento contém somente `agendaId`, `storeId`, `date` e `reason`;
- ADM e visualizador recebem a invalidação pelo WebSocket;
- o dashboard recarrega somente a data atualmente visível;
- eventos em rajada são coalescidos no frontend;
- o modal de detalhes recarrega somente quando o `agendaId` aberto é afetado;
- falha de publicação é best-effort, registrada em log e nunca reverte a escrita D1;
- reconexão, retorno de foco e atualização manual continuam como reconciliação.

Mutações cobertas:
- status de agendamento;
- trocas;
- fornecedor manual criado/editado/removido;
- conclusão/reabertura;
- ajustes administrativos;
- importação individual/substituição;
- importação em lote.

Rollback da Fase 4: definir `REALTIME_MODE=off` e publicar, ou republicar a versão anterior. Os dados permanecem corretos no D1; apenas a atualização instantânea é desativada.

A quinta release encerra a migração principal:
- remove o polling periódico de presença de 60 segundos do ADM;
- mantém leitura HTTP/D1 na carga, transição da conexão realtime, retorno de foco e atualização manual;
- preserva o heartbeat D1 de 2 minutos no conferente como fallback de rollback;
- usa `getWebSocketAutoResponseTimestamp()` do Hibernation API para considerar o ping/pong automático na liveness;
- amplia a expiração de segurança para aproximadamente 2 minutos, evitando reconexões falsas em abas em segundo plano;
- usa código de fechamento de aplicação `4002` no cliente em vez de código reservado de servidor.

A limpeza destrutiva da tabela/endpoints D1 de presença **não faz parte do encerramento**. Eles permanecem deliberadamente disponíveis como fallback operacional e podem ser removidos apenas em uma release futura explicitamente revisada.

O rollout completo está documentado na issue #59.

## Checklist de release

Antes do merge:

- gate `verify` verde, o que inclui qualidade + CodeQL;
- migration nova revisada como aditiva, quando houver;
- qualquer contract migration acompanhada de aprovação versionada com SHA-256 exato;
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


## Decisões de manutenção da auditoria de 30/09/2026

- A regra de data operacional de produção foi centralizada em `shared/time.ts` e reutilizada por Worker, ADM e conferente.
- O preparo E2E mantém uma implementação independente da data como oráculo de integração entre runtime Node e aplicação; a divergência é detectável pelos testes de virada do dia.
- A antiga `src/agenda/HistoryPage.tsx` foi removida porque não possuía rota utilizável. O redirect legado de `/app/history` para `/app` permanece para compatibilidade.
- O axe agora cobre login, ADM, visualizador e conferente em E2E.
- O CI compila o bundle uma única vez; a etapa Playwright usa `test:e2e:ci` e reaproveita esse build.
- Stack traces de falhas **esperadas** em testes de rollback foram mantidos intencionalmente porque validam observabilidade dos caminhos de erro. Eles são ruído conhecido de teste, não erro de produção.
