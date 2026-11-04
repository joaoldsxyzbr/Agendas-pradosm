# Pacote final de engenharia para homologação — novembro de 2026

## Escopo entregue na Preview
- Resumo de fornecedores com SQL indexado (PR #184).
- Histórico administrativo com paginação de 20 agendas (PR #185).
- Listagem da API de histórico do conferente com paginação **opcional** (`limit` 1–50, `offset` 0–100000), mantendo `GET /api/store/history` sem parâmetros como array legado. A tela do conferente continua consultando agendas por data; não há nova paginação visual no fluxo operacional.
- Carregamento sob demanda das telas React e do gerador PDF.
- Separação de componentes e textos explicativos do relatório gerencial.
- Monitoramento de dependências do `apps/web` e limpeza de workflows antigos.
- Teste integrado realista: aplica toda a sequência de migrations SQL no SQLite em memória, verifica integridade/FK e usa o Worker Hono com sessões sintéticas para testar permissões, paginação e contrato legado. **Não é teste com D1 remoto**.

## Isolamento e governança
- Não alterar as credenciais, usuários, papéis, dados ou schema do D1 remoto.
- Não aplicar migrations nem fazer deploy na `main`.
- As consultas administrativas sem paginação continuam respondendo com array; somente chamadas explicitamente paginadas respondem `{items,hasMore}`.
- O PR da `main` permanece em rascunho até a avaliação conjunta.

## Gates de qualidade
- [ ] GitHub Actions `verify`, CodeQL, testes Node e integração, Playwright e build verde.
- [ ] Workers Builds de `agendas-pradosm-preview` publicado e implantação confirmada.
- [ ] Teste manual de fluxo no ambiente publicado: Login, Agendas, Importação, Conferência, Histórico, Relatório, PDF.
- [ ] Desempenho após publicação: repetir amostras `rows_read` do D1 e confirmar operações sem regressão.

## Limites assumidos
A redução de leituras das queries foi medida no banco de homologação em consultas isoladas; não é um benchmark completo de interação do navegador. Não foram feitas mudanças de schema, autenticação, permissões, liberação de produção nem restauração de backup.
