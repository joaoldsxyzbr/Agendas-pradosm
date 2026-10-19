# Migração JS puro — etapa 17: Importação CSV/PDF

Branch `migracao-js-puro`. Referência `src/admin/ImportAgendaPage.tsx` da `main`.

- `migration/frontend/import-agenda.js` reproduz seleção CSV/PDF (limite 10 MB), extração local, interpretação com os parsers JS já migrados, prévia de todas as lojas e fornecedores e mensagens de erro/aviso.
- Dados só seguem ao endpoint `POST /api/admin/agendas/import/bulk` depois de confirmação. A construção do payload elimina o status inicial do arquivo, conforme a `main`, e impede importação parcial por falta de loja/data.
- Conflito 409 mostra o aviso e exige confirmação separada para substituição (`replace: true`), preservando as regras no backend.
- Modal/rota de importação usam o mesmo renderer; clique fora fecha o modal se não houver gravação em andamento.
- `tests/migration/import-agenda.test.js` cobre identificação de tipo, payload e mensagens.

A interface **ainda não foi conectada ao entrypoint**. Execução real dos testes Node e E2E aguarda resolução do CI; testes de parser/integração com D1 são necessários antes de homologar.

Produção, `main`, `preview` e D1 não foram alterados.