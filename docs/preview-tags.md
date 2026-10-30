# Tags de fornecedores — Preview (30/10/2026)

## Fluxo de uso
- O conferente abre **Tags** em `/app/tags` e cadastra nome (até 32 caracteres) e uma das seis cores.
- Em **Conferência**, clica **+ Tag** abaixo do fornecedor e seleciona até cinco etiquetas.
- A marcação vale para **aquele agendamento** e aparece abaixo do fornecedor, incluindo consulta histórica na tela do conferente.
- O catálogo é reutilizado pela **mesma loja**, não é compartilhado entre unidades e não aplica tags automaticamente a novas agendas.
- Um dia concluído permite leitura das etiquetas, mas não a alteração.
- Arquivar uma etiqueta remove-a das opções futuras, mantendo as tags já atribuídas a registros anteriores.

## Armazenamento e segurança
- `migrations/0030_supplier_tags.sql` cria `tags_loja` e `agendamento_tags` sem mudar tabelas existentes.
- API exclusiva para `conferente`; `lojaId` é obtido da sessão, e vínculos de outras lojas são rejeitados pelo servidor.
- `PUT /api/store/tags/appointments/:id` grava associação e auditoria no mesmo batch.
- Nunca aplicar migration remotamente na D1 de produção nesta etapa. Validar apenas no ambiente local/preview isolado.
- Os status, importações e PDFs continuam independentes das tags.

## Homologação pendente
- Rodar verificações JavaScript, Playwright e CI da branch `preview`.
- Aplicar a migration **somente ao D1 de teste**, após revisão das migrations já existentes neste banco e autorização operacional.
- Confirmar interface com dados sintéticos em desktop/mobile e a atualização em dias históricos.
