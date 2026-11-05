# Tela de Agendas (administração) — marcação "digitado para o conferente"

Data: 2026-11-03.

## Objetivo

Oferecer aos administradores uma tela dedicada às agendas importadas, organizadas por loja,
com uma marcação interna que indica que a agenda da loja já foi digitada/repassada para o conferente.
A tela é exclusiva do papel admin e não muda nada para o conferente.

## Regras

- Rota da tela: `/admin/agendas` (menu "Agendas", visível apenas para admin). Visualizador é redirecionado.
- Dados: `GET /api/admin/agendas?date=...` (mesma consulta do Recebimento), agora com `digitadoEm` e `digitadoPor`.
- Marcação: `PATCH /api/admin/agendas/:id/digitado` com corpo `{ "digitado": true | false }`.
  Persistência em `agendas.digitado_em`/`agendas.digitado_por` (migration 0020).
- Auditoria: ações `agenda_digitada_para_conferente` e `agenda_digitacao_removida` na tabela auditoria.
- Concorrência: atualização com guarda (`digitado_em IS NULL`/`IS NOT NULL`); sem alteração responde 409 CONFLITO_ESTADO.
- A marcação NÃO publica eventos de tempo real e não altera status do dia: invisível para o conferente.
- "Ver agendamentos" reabre o diálogo de detalhe usado no Recebimento (mesma consulta, mesma permissão).

## Histórico

- 2026-11-03: criação da tela com a marcação interna de digitação.

## Migração somente na Preview

O D1 de homologação contém migrations históricas adicionais que não existem mais no histórico atual do repositório. Para evitar a reaplicação de migrações antigas e preservar o banco de teste, o arquivo `wrangler.preview-agendas-migrations.jsonc` seleciona **somente** a migration aditiva `0020_agenda_digitado_para_conferente.sql`, com o ID explícito do D1 de testes.

No **Cloudflare Workers Builds** do Worker dedicado `agendas-pradosm-preview`, manter o comando de build `npm run verify:production` e configurar o comando de publicação para `npm run deploy:preview`. Esse script aplica apenas a migration `0020` no D1 de testes e, **somente após sucesso**, publica o Worker. É necessário que o token do build possua permissão de edição no D1 de testes.

Para executar manualmente o mesmo fluxo, se necessário:

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.preview-agendas-migrations.jsonc
npx wrangler deploy --config wrangler.preview.jsonc
```

Não utilizar `wrangler.jsonc` nem aplicar migrations no D1 de produção para validar esta tela. A migration deve constar em `d1_migrations` antes de o Worker novo ser publicado. Em homologação, Tags e Cross Docking permanecem fora do escopo desta alteração; seus dados históricos não são apagados.

**Observação:** a configuração atual do Workers Builds ainda executa apenas `npx wrangler deploy --config wrangler.preview.jsonc`. O commit deste script **não** altera sozinho esse comando salvo no painel Cloudflare. Após a atualização da configuração de implantação do Worker `agendas-pradosm-preview`, a integração na branch `preview` dispara a migração automaticamente. Nunca utilizar este script na `main` ou alterar a configuração do Worker de produção.
