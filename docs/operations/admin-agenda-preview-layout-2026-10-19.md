# Popup administrativo de agenda — correção visual em 19/10/2026

## Problema
O popup de consulta administrativa reutiliza a classe `store-page` do conferente. Regras antigas de `src/corporate.css` posicionavam indicadores na coluna 1 e a busca na coluna 2. O `[data-preview-list]` ficava automaticamente na primeira coluna, reduzindo a tabela a cerca de metade da largura e criando vazio na lateral direita.

## Solução
Somente seletores CSS específicos de `.agenda-preview-modal` em `src/preview-visual.css`:
- Grid interno de coluna única, com contexto, indicadores, busca e lista ocupando a largura integral.
- Busca alinhada à direita no desktop e em largura integral no celular.
- Tabela com largura de 100%, rolagem horizontal em telas estreitas e coluna de fornecedor usando espaço útil.
- Modal responsivo com padding compacto.
- Não alterar o componente JS, regras de autorização, modo edição, status, APIs, D1 ou dados reais.

## Validação
- `tests/migracao-browser/agenda-preview-layout.spec.js`: largura da tabela, busca, modo de edição, fechamento e responsividade via API mockada.
- CI de `main`: `npm test`, build, CodeQL, Playwright e dry-run.
- O GitHub integra o código; o resultado de Workers Builds/versão ativa do Cloudflare precisa de verificação separada.
