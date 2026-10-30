# Agenda Prado — Fundação visual (preview)

## Direção
Referência: Atlassian Design System (tokens semânticos e consistência), com paleta Agenda Prado azul-grafite. Não copiamos componentes, fontes proprietárias ou layout da Atlassian.

## Regras
- A fundação em `frontend/styles/design-foundation.css` é a última folha de estilo. Evitar novas cores arbitrárias nas páginas.
- Preferir tokens `--prado-*` para fundo, superfícies, textos, ações, bordas, foco e sombras.
- Não alterar grid, medidas de coluna, ordem dos elementos, comportamento dos controles nem permissões nesta fase.
- As cores de status continuam semânticas e devem ser verificadas em modo escuro.
- Padronizar gradualmente componentes compartilhados; não apagar folhas legadas sem regressões automatizadas e homologação visual.
- Verificar desktop, mobile, teclado, contraste e o CI antes de promover.
- Apenas branch `preview`; produção e D1 permanecem intactos.

Referência pública: https://atlassian.design/foundations/design-tokens
