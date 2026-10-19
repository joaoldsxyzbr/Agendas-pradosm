# Release de produção

Este documento registra o contrato operacional do deploy do `agendas-pradosm`.

## Caminho oficial

A produção usa **Cloudflare Workers Builds** conectado ao repositório `joaoldsxyzbr/Agendas-pradosm`.

Configuração confirmada em 29/09/2026:

- branch de produção: `main`;
- build command: `npm run verify:production`;
- deploy command: `npm run deploy:cloudflare`;
- diretório raiz: `/`;
- previews de PR: habilitados com recursos isolados da produção.

O deploy command do Workers Builds deve permanecer **`npm run deploy:cloudflare`**. O build command já executa `npm run verify:production`, portanto o caminho Cloudflare aplica apenas o gate de migrations, as migrations remotas e a publicação, sem repetir testes e build. O comando local **`npm run deploy`** continua autocontido: primeiro verifica toda a aplicação e depois chama `deploy:cloudflare`.

Referência oficial: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## Previews de pull request

### Diagnóstico de falha na autenticação da Preview (19/10/2026)

Os PRs de auditoria #95 e #96 passaram no gate GitHub Actions `verify`, mas o Workers Builds da Preview retornou erro `Authentication error [10000]` / `Invalid access token [9109]` ao executar `npx wrangler preview`. O build do código e os testes passaram, portanto esse erro específico não comprova falha do Worker. A produção usa outra configuração de publicação.

**Causa identificada e corrigida nos PRs #95 e #96:** atualizar `previews_base_config.build_token_uuid` altera o padrão para futuras Previews, mas as Previews já criadas mantêm `settings.build_token_uuid` próprio. As antigas continuavam usando o token anterior, embora a nova Preview do PR #97 publicasse com o token correto. A correção foi atualizar **somente** o `settings.build_token_uuid` das duas Previews afetadas; ambas então publicaram com sucesso, sem tocar no token da produção.

Na próxima rotação, confira as configurações de cada Preview. A API de configuração do Worker admite `patch_existing_previews=true` para propagar mudanças globalmente; prefira a atualização individual via `PATCH /accounts/{account_id}/builds/workers/{script_tag}/previews/{preview_id}` para limitar o alcance da alteração.

Procedimento seguro:
1. No Worker `agendas-pradosm`, confirmar em **Builds → Configurações de build → Preview** o token **válido e de escopo de usuário**, com permissões exigidas pela Cloudflare para Workers e recursos da Preview. Revisar a autenticidade/validade do token real, não apenas o identificador selecionado.
2. Reexecutar uma build da branch/commit do PR e examinar o **resultado da etapa de deploy**, não somente o sucesso do comando de build ou do check GitHub `verify`.
3. Não substituir `wrangler preview` por `wrangler deploy`: a segunda opção publicaria o Worker de produção. Não suprimir checks, não inventar sucesso da Preview e não colocar tokens/segredos em commits, logs ou comentários.
4. A Preview deve usar recursos isolados, sem apontar para o D1 da produção, e sua publicação deve ser confirmada separadamente do deploy da `main`.
5. Se o erro persistir depois de confirmar a credencial, registrar logs redigidos e comparar com problemas conhecidos do `wrangler preview`; não reutilizar tokens alheios ao Worker nem ampliar permissões sem necessidade.

Documentação Cloudflare: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token e https://developers.cloudflare.com/workers/previews/get-started/.

Desde 01/10/2026, os Workers Builds podem publicar Preview de pull requests usando o bloco `previews` do `wrangler.jsonc`. A Preview é deliberadamente separada da produção:

- `DB` aponta para o D1 `agendas-pradosm-preview` (`716cc88e-7da8-400e-b4be-edc4be0c9c03`), nunca para o D1 de produção;
- `LOGIN_RATE_LIMITER` usa o namespace `2026100101`, diferente do namespace de produção;
- `REALTIME_MODE=off` por padrão em Preview;
- o binding `REALTIME_HUB` é repetido em `previews.durable_objects`; a Cloudflare cria namespace e storage de Durable Object isolados para cada Preview;
- cron triggers e rotas de produção não são declarados dentro de `previews`;
- segredos de Preview não devem ser versionados nem reutilizados da produção. Quando um fluxo de Preview precisar de `SESSION_SECRET`, configure um segredo exclusivo de Preview pela Cloudflare.

O arquivo `wrangler.preview-migrations.jsonc` aponta para o mesmo D1 isolado e existe apenas para aplicar migrations nesse banco quando uma Preview funcional precisar de schema. Nunca trocar esse arquivo para o UUID do banco de produção.

O `wrangler.jsonc` preserva IDs independentes para D1 e rate limit de previews; o CI principal usa D1 local sintético.

Referências oficiais:

- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/previews/resources/


## Sequência obrigatória

O comando local `npm run deploy` executa, nesta ordem:

1. `npm run verify:production`;
2. `npm run deploy:cloudflare`.

O caminho `deploy:cloudflare`, usado pelo Workers Builds depois do build command já validado, executa:

1. `npm run check:migrations`;
2. `wrangler d1 migrations apply DB --remote`;
3. `wrangler deploy`.

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

- testes JavaScript e validação de importações, build nativo e E2E Playwright;
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
- `npm run verify:production` preservado como build command do Workers Builds;
- `npm run deploy:cloudflare` preservado como deploy command do Workers Builds;
- `npm run deploy` preservado como caminho local seguro e autocontido.

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

- A regra de data operacional de produção está em `shared/time.js` e é reutilizada por Worker, ADM e conferente.
- O preparo E2E mantém uma implementação independente da data como oráculo de integração entre runtime Node e aplicação; a regra de produção centralizada possui testes próprios de virada do dia.
- A antiga `src/agenda/HistoryPage.tsx` foi removida porque não possuía rota utilizável. O redirect legado de `/app/history` para `/app` permanece para compatibilidade.
- O axe agora cobre login, ADM, visualizador e conferente em E2E.
- O CI executa `npm run build` e `npm run test:e2e` (com `playwright.config.js`); não existe script `test:e2e:ci` no `package.json` atual.
- Stack traces de falhas **esperadas** em testes de rollback foram mantidos intencionalmente porque validam observabilidade dos caminhos de erro. Eles são ruído conhecido de teste, não erro de produção.


## Ajuste visual de cadastros em 01/10/2026

Após validação na branch `preview`, as telas administrativas de **Lojas** e **Usuários** foram promovidas para produção com:

- cadastro em modal;
- busca e filtros de listagem;
- contadores de registros ativos;
- indicadores visuais de situação;
- tabelas mais compactas;
- preservação das APIs, regras de negócio e dados de produção.

A promoção foi seletiva: recursos exclusivos da Preview não foram levados para a `main`.


## Configuração atual do Workers Builds após a remediação de 02/10/2026

A produção usa:

- build command: `npm run verify:production`;
- deploy command: `npm run deploy:cloudflare`.

O comando local `npm run deploy` continua autocontido e executa a verificação completa antes de chamar o caminho de publicação.

## Regras operacionais adicionais da auditoria de 02/10/2026

- A branch `preview` deve permanecer baseada na `main` atual; diferenças são permitidas apenas para mocks, isolamento de dados e experiências visuais ainda não promovidas.
- O CI deve executar o mesmo gate completo em `preview` e `main`.
- A proteção da `main` deve exigir pull request + check `verify` também para administradores. A integração GitHub atual não possui permissão administrativa para impor essa configuração; revisar no painel sempre que houver auditoria de governança.
- Produção deve manter pelo menos dois administradores ativos quando houver um segundo responsável disponível. Nunca criar credenciais automaticamente ou registrar senha no GitHub.
- A auditoria operacional deve ser preservada. Não executar limpeza automática de `auditoria`, `historico_status` ou `historico_agenda`; revisar volume e retenção quando o banco atingir crescimento material.
- A visibilidade pública/privada do repositório é uma decisão operacional. Não alterar automaticamente, pois pode afetar integrações, previews e acesso de manutenção.