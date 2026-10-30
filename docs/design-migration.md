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

## Etapa 2: organização dos estilos do Conferente

- `conferente-visual.css` e `conferente-compact.css` passam a residir em `frontend/pages/conferente/visual.css` e `compact.css`.
- Conteúdo CSS e ordem de precedência preservados, sem remoção de declarações de geometria ou mudança no JavaScript.
- As três folhas desta tela (`visual.css`, `compact.css`, `style.css`) estão agora juntas, embora a cascata antiga permaneça mantida para evitar regressões.
- Remover duplicações somente depois de comparação visual e testes capazes de verificar medidas e estados.
