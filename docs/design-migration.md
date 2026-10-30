# Migração incremental do Design System — preview

## Etapa 1: Conferente

- Estilos específicos de acabamento movidos sem alteração de regras de `frontend/styles/conferente-polish.css` para `frontend/pages/conferente/style.css`.
- `index.html` mantém a mesma ordem efetiva: acabamento específico antes da fundação global, exatamente como anteriormente.
- Por enquanto, as folhas legadas `conferente-visual.css` e `conferente-compact.css` continuam carregadas; serão consolidadas após testes de regressão e capturas de referência.
- O JavaScript `today.js` e o runtime não foram alterados: rotas, autenticação, comandos e layout mantidos.
- A etapa futura poderá importar estilos por página quando houver lifecycle seguro para navegação e modais.

## Critérios de aceitação
- Sem mudança de seletores, declarações ou geometria na etapa 1.
- Build e testes de navegador aprovados.
- Validar visualmente Conferente desktop/mobile antes de migrar a próxima camada.
