# Migração React — Conferência (etapa operacional inicial)

Data 2026-10-30 · Branch `modernizacao-react-vite`.

## Implementado
- `/app` renderiza interface React funcional para o conferente, via `/api/store/today` e `/api/store/history/:date`, sem alterar contratos ou schema D1.
- Filtros de data com `America/Sao_Paulo`, pesquisa de fornecedor/protocolo ignorando acentos, ordenação por horário e cinco indicadores iguais aos da interface atual.
- Alteração de status Recebido/Não recebido/voltar para Aguardando, motivo obrigatório ao marcar Não recebido, e Trocas.
- Cada mudança aguarda a API e revalida o cache da agenda. Falha HTTP 409 é exibida sem atualização otimista.
- Conclusão do dia requer confirmação; dia concluído não oferece controles de mutação.
- Layout responsivo com cards compactos e testes E2E de leitura, busca, mutações, conflito, conclusão, ausência de agenda e celular.
- Backend, Workers, autenticação, Tag API, D1 real, `main` e `preview` operacional intactos.

## Limitações intencionais
- `/app/tags` ainda é placeholder no React; as tags associadas a fornecedores não são editáveis nesta etapa.
- Cadastro/renomeação/exclusão de fornecedores manuais, observações editáveis, PDF exportado e detalhes históricos enriquecidos permanecem na interface operacional existente.
- Polling de 30 segundos e atualização ao foco; eventos de WebSocket específicos do Conferente requerem integração e homologação.
- A nova interface é desenvolvida em `apps/web` e ainda não foi implantada na preview operacional.

## Critérios para próximo passo
1. CI de React e sistema legado verde no SHA final.
2. Migrar tags e fornecedores manuais com os contratos reais da API e auditabilidade.
3. Migrar observações, eventos WebSocket e exportação PDF.
4. Comparar screenshots do Conferente em 390, 768, 1366 e 1920 pixels.
5. Validar PDF real sanitizado: o repositório contém CSV e texto sanitizados, mas não há PDF real sanitizado versionado; sem esse arquivo não declarar homologação do PDF.
