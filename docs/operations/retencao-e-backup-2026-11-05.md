# Retenção de dados, export para R2 e treino de restore (preview)

Data: 05/11/2026. Escopo: Onda 2 do plano de crescimento, homologação na branch `preview`.

## Política de retenção

Executada pelo Cron Trigger diário às 03:05 UTC (00:05 `America/Sao_Paulo`) pelo worker, junto do fechamento de agendas e do prune de diagnósticos.

| Tabela | Janela de retenção | Export antes do purge |
| --- | --- | --- |
| `historico_status` | 12 meses | JSON no bucket R2 |
| `historico_agenda` | 12 meses | JSON no bucket R2 |
| `auditoria` | 24 meses | JSON no bucket R2 |
| `diagnosticos` | 30 dias (pruneDiagnostics, já existente) | sem export |

Invariante de segurança: nenhum registro é purgado sem antes ser exportado. Sem binding `RETENTION_BUCKET` disponível, a execução apenas contabiliza registros expirados, emite o alerta `retention_export_skipped` e não purga nada.

## Export para R2

- Bucket da preview (a criar após habilitar R2 na conta): `agendas-pradosm-preview-retention`.
- Formato do objeto: `retencao/<tabela>/<runId>/<lote-4-digitos>.json`.
- Conteúdo: `{ tabela, corte, executadoEm, runId, lote, quantidade, registros }` — `registros` contém as linhas completas exportadas naquele lote (até 500 por objeto).
- O `runId` (UUID) agrupa todos os lotes de uma execução; `corte` é o timestamp limite usado no purge.

Ativação em dois passos (necessário porque o R2 exige habilitação manual no dashboard):

1. Habilitar o R2 na conta Cloudflare (dashboard → R2 → ativar).
2. Criar o bucket `agendas-pradosm-preview-retention` e adicionar ao `wrangler.preview.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "RETENTION_BUCKET", "bucket_name": "agendas-pradosm-preview-retention" }
]
```

Sem esse binding, tudo continua funcionando; apenas o purge fica inerte (contabilizado como pendente).

## Execução e acompanhamento

- Cron: dispara às 03:05 UTC. O resumo aparece nos logs do worker (Workers Observability) como `retention_summary`, e a contagem de linhas como `db_size_report`.
- Execução manual (admin, com cookie de sessão válido):

```bash
curl -X POST https://preview.agendaspradosm.joaolds.xyz.br/api/admin/retention/run
curl https://preview.agendaspradosm.joaolds.xyz.br/api/admin/retention/status
```

- Cada execução manual grava uma entrada `retencao_dados_executada` na tabela `auditoria` com o resumo em `detalhes`.
- Alerta de tamanho: se a soma de linhas das tabelas monitoradas (`agendamentos`, `historico_status`, `historico_agenda`, `auditoria`, `agenda_digitacao_fornecedor`, `diagnosticos`) atingir o limite da variável `RETENTION_ROW_LIMIT_WARNING` (padrão 500000), o log emite `db_size_warning`. A rota `/status` mostra a contagem por tabela para acompanhar a evolução.

## Treino de restore — Time Travel na preview

Contagem aproximada não substitui backup operacional. O D1 mantém Time Travel (janela de recuperação limitada pela Cloudflare). Treinar o restore na preview valida o runbook sem tocar produção. Adaptado de `docs/operations/data-recovery.md` (produção), usando o banco `agendas-pradosm-preview`.

Pré-requisito: Wrangler autenticado com permissão no D1 da preview (`npx wrangler login` ou `CLOUDFLARE_API_TOKEN`).

1. Coletar o bookmark atual e registrar no incidente/treino:

```bash
npx wrangler d1 time-travel info agendas-pradosm-preview
```

2. Marcar o banco para o treino: criar um registro sintético visível e registrar o horário (UTC) — por exemplo, uma linha de auditoria com `acao='treino_restore'`.

3. Escolher um timestamp imediatamente anterior ao passo 2 e restaurar:

```bash
npx wrangler d1 time-travel restore agendas-pradosm-preview --timestamp="<TIMESTAMP_UTC>"
```

O Wrangler devolve o bookmark anterior ao restore; guardá-lo permite desfazer.

4. Validar após o restore, nesta ordem:
   - `GET /api/health` responde 200 com D1 ok;
   - o registro sintético do passo 2 NÃO existe mais (o restore funcionou);
   - login e telas da preview funcionam normalmente;
   - migrations continuam aplicadas (`npx wrangler d1 migrations list DB --config wrangler.preview.jsonc`).

5. Encerrar o treino: registrar bookmark restaurado, bookmark de retorno e resultado das validações. Se algo restar errado, restaurar o bookmark do passo 1.

O que este treino não autoriza: executar restore no banco de produção (`agendas-prado`) fora de um incidente real, seguindo `data-recovery.md`.

## Promoção para main

Ao promover esta onda: criar o bucket de produção (ex. `agendas-pradosm-retention`), adicionar o binding ao `wrangler.jsonc` e manter a mesma política. O cron de produção (03:05 UTC) passa a executar a retenção com export.
