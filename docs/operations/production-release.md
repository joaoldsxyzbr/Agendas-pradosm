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
