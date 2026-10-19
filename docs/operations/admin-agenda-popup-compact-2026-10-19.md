# Popup de consulta: distribuição compacta — 19/10/2026

## Diagnóstico
Na captura após a primeira correção, o resumo e a busca continuavam muito afastados e os comandos superiores não ocupavam o espaço do popup. Regras antigas em `src/corporate.css` para `html[data-theme="dark"] .store-page > .agenda-metrics` e `.agenda-toolbar` tinham especificidade suficiente para impor colunas implícitas, mesmo após o CSS de largura integral.

## Correção
- Seletores de maior especificidade **apenas dentro de** `.agenda-preview-modal`, sem mudar o grid de conferentes.
- Contexto/data e comandos ocupam toda a largura do popup; botões alinhados à direita.
- Desktop (≥1150px): cinco indicadores com largura uniforme à esquerda e busca à direita, sem grande vão. Tabela ocupa ambas as colunas.
- Larguras intermediárias/celular: indicadores e busca em faixas empilhadas e responsivas.
- Rolagem horizontal restrita à tabela, preservando nomes e ações.
- Sem alteração de autenticação, dados reais, D1 ou regras do recebimento.

## Verificação
`tests/migracao-browser/agenda-preview-layout.spec.js` valida medidas geométricas de tabela e cabeçalho, alinhamento de indicadores/busca, modo de edição, pesquisa, fechamento e celular. Conferir CI e versão efetivamente implantada no Cloudflare após o commit.
