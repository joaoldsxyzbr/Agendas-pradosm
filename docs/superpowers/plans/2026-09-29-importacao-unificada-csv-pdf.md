# Importação unificada CSV/PDF

**Data:** 29/09/2026  
**Status:** concluída e validada no CI  
**Repositório:** `joaoldsxyzbr/Agendas-pradosm`

## Objetivo

Permitir que o administrador importe, em uma única operação, a exportação diária contendo todas as lojas, sem alterar o modelo de agenda já persistido nem a experiência do conferente.

## Contrato funcional

- CSV é o formato principal.
- PDF permanece como formato de reserva.
- Uma exportação consolidada é separada por `Filial` antes da persistência.
- Cada loja continua gerando sua própria agenda por `loja + data`.
- Campos apresentados ao conferente permanecem os mesmos.
- O protocolo continua sendo a chave de preservação operacional durante substituições.
- Substituições preservam status, histórico e fornecedores manuais existentes.
- O lote não pode ser parcialmente gravado.

## Validações

A confirmação é bloqueada quando:

- não existe cabeçalho compatível;
- uma linha de dados não pode ser interpretada com segurança;
- o arquivo contém mais de uma data;
- a data das linhas diverge do filtro informado no arquivo;
- existe protocolo duplicado dentro da mesma loja/data;
- uma filial do arquivo não está cadastrada/ativa;
- existe agenda para alguma loja/data e a substituição ainda não foi confirmada.

## Atomicidade

O Worker faz a validação de todas as lojas e conflitos antes da primeira escrita.

A persistência de todas as agendas e agendamentos do arquivo é enviada em um único `D1Database.batch()`. Segundo o contrato do D1, o batch é transacional: se uma instrução falhar, a sequência inteira é abortada/rollbackada.

O payload consolidado aceita até 700 agendamentos. Antes de executar o batch, o Worker também calcula as operações reais necessárias, inclusive desativações em substituições, e bloqueia lotes que excedam 800 instruções de escrita. A margem restante cobre as consultas de validação da própria requisição.

Isso evita tanto gravação parcial quanto estouro previsível do orçamento de consultas do D1.

## Compatibilidade

- CSVs exportados pelo Prado são aceitos com quebras de linha LF, CRLF ou CR isolado. A exportação real validada em 29/09/2026 usa CR isolado.
- O endpoint antigo de importação individual permanece disponível.
- PDFs individuais continuam usando o parser existente.
- PDFs consolidados são reconhecidos quando a tabela contém a coluna `Filial`.
- Nenhuma migration é necessária.
- Dashboard, histórico, fechamento do dia e telas do conferente continuam consumindo o mesmo modelo de dados.

## Cobertura automatizada

Foram adicionados testes sintéticos para:

- 121 agendamentos em 9 unidades em um único CSV;
- regressão com amostra sanitizada do CSV real do Prado usando CR isolado como quebra de linha;
- CSV com BOM e campo entre aspas contendo ponto e vírgula;
- PDF consolidado com coluna `Filial`;
- fallback para PDF individual;
- loja ausente bloqueando o lote inteiro;
- conflito em uma loja impedindo gravação das demais;
- substituição em lote preservando status existente;
- falha SQL em uma loja provocando rollback das outras;
- limite de tamanho também aplicado ao endpoint em lote.

Dados comerciais reais e arquivos exportados do Prado não são versionados.
