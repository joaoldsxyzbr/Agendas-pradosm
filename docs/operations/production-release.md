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
