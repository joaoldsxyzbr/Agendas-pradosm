# Revisão visual e estrutura — preview

## Padrão comum
- A fundação de design permanece em `frontend/styles/design-foundation.css`.
- Cores, bordas, foco, sombras, tabelas, estados vazios e mensagens reutilizam `--prado-*`.
- O acabamento dos componentes é escopado aos shells administrativo e do conferente. Nenhum grid, coluna, área clicável ou posição foi alterado nesta entrega.
- Os arquivos específicos já agrupados em `frontend/pages/` preservam cascata, e seguem sendo carregados pelo HTML para não quebrar modais.
- Verificação do build agora percorre todos os links CSS e falha se algum asset migrado estiver faltando ou duplicado.

## Trabalho residual exigindo evidência visual
- Folhas antigas transversais `styles.css`, `store-desktop.css`, `corporate.css`, `preview-visual.css`, `enterprise-gray.css` e `palette-refresh.css` ainda contêm regras compartilhadas. Uma separação mecânica mudaria prioridade de cascata; não removê-las sem visual regression snapshots das telas.
- Homologar capturas reais: login, admin, relatórios, histórico, lojas, usuários, importação, diagnósticos, conferente e tags, nas larguras desktop/mobile, incluindo modais e estados.
- CI não constitui prova de equivalência visual pixel a pixel.
