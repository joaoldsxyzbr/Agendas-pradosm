# Homologação: importação única e digitação por fornecedor

Escopo exclusivo da branch \`preview\` e do Worker \`agendas-pradosm-preview\`. Não aplicar na \`main\` nem no D1 de produção.

## Interface

- Importação CSV/PDF transferida de Recebimento para a aba administrativa \`/admin/import\`. O parser e a API de importação existentes são reutilizados; o arquivo é importado uma vez e alimenta Recebimento, Conferência e Agendas.
- Em \`/admin/agendas\`, a linha da loja expande para mostrar fornecedores importados. Nomes equivalentes com diferenças de maiúsculas e acentuação são agrupados; protocolos e pedidos individuais continuam consultáveis.
- Um check por fornecedor representa **somente o controle de digitação do ADM**. Ele não altera status de agendamento, presença, conclusão, auditoria operacional, fluxos do conferente ou relatórios.
- O painel detalha protocolo, horário, tipo, itens, volumes, paletes, carga batida, NF-e, pedidos e, para arquivos CSV importados após esta implantação, também todas as colunas originais do CSV.

## Banco de testes

A migration \`0021_agendas_csv_fornecedor_preview.sql\` é aditiva: cria a coluna \`agendamentos.csv_campos\` e a tabela \`agenda_digitacao_fornecedor\`. Os dados operacionais existentes são preservados.

O arquivo \`wrangler.preview-agendas-migrations.jsonc\` filtra apenas as migrations 0020 e 0021, evitando reaplicar as migrações históricas divergentes da preview. O Worker dedicado executa \`npm run deploy:preview\`, que aplica essas migrations **somente no D1 de testes** antes do deploy, e aborta a publicação se falharem.

Consultas administrativas novas:

- \`GET /api/admin/agendas/:id/digitacao\`: fornecedores e campos originais, com hash de conteúdo.
- \`PATCH /api/admin/agendas/:id/digitacao\`: marca ou desmarca fornecedor; verifica conteúdo e estado previamente lidos, persiste auditado.

O hash inclui protocolos, datas/horários, itens, NF-e, pedidos e campos do CSV. A substituição de um arquivo que altere algum desses dados invalida automaticamente o check anterior, sem alterar ou apagar os status operacionais.

## Compatibilidade e limites

- Conferência mantém as rotas e o serializador existentes, sem exposição de \`csv_campos\` nem campos de digitação.
- Arquivos CSV importados anteriormente continuam disponíveis com os campos estruturados já persistidos; **não é possível recuperar retroativamente as colunas brutas que não foram armazenadas**.
- Para preservar o CSV sem truncamento silencioso, o parser bloqueia importações cujas linhas ultrapassem 64 colunas, 2.048 caracteres por campo, 160 por título ou 16 KiB de campos JSON. Os limites são verificados antes de gravar.
- PDF preserva o comportamento anterior; a consulta detalhada usa os campos estruturados extraídos.
- Acesso a ambas as rotas de digitação é restrito ao perfil \`admin\` no Worker; visualizador e conferente recebem 403.

## Checklist antes da integração

- CI completo da PR: gate \`verify\`, testes Node, compilação, Playwright e CodeQL.
- Confirmar que a migration 0021 existe somente no D1 da preview.
- Confirmar sucesso do build + deploy no Cloudflare Worker de homologação.
- Verificar manualmente com conta ADM: importação, expansão da loja, listagem, marcação/desmarcação, substituição com mudança de pedidos.
- Não mesclar na \`main\` sem autorização explícita.
