# Recebimento — compactação visual (preview)

Ajuste solicitado após revisão da tela renderizada em 1287×683.

## Objetivo
Manter o tema azul-grafite e a hierarquia visual, reduzindo espaço ocupado sem alterar dados, funcionalidade ou navegação.

## Dimensões de referência
- Indicadores em desktop: de aproximadamente 104 px para 76 px de altura.
- Ícones do resumo: de 48 px para 36 px (33 px em notebook).
- Valores: de 27 px para 22 px.
- Cabeçalho da tabela: de 49 px para 39 px.
- Linhas da tabela: de 82 px para 60 px (62 px no celular).
- Botões de ação: de 44 px para 37 px.
- Cabeçalho da página: mínimo de 90 px para 64 px; título até 28 px.
- Redução proporcional de espaços internos, badges, progresso e intervalos.

## Limites
- A folha continua isolada em `frontend/pages/dashboard/style.css`, sem estilos transversais novos.
- Indicadores e tabela continuam dinâmicos; seis colunas, status, operações e rolagem horizontal móvel foram preservados.
- Testes de navegador verificam os limites das dimensões e a ausência de rolagem horizontal da página.
- Uma comparação visual de todas as condições de produção ainda não é substituída pelo CI.
