# Correção: filtros de data do Relatório Gerencial — 26/10/2026

## Sintoma
Na tela **Relatório Gerencial**, os filtros `De` e `Até` aparentavam conter a data, mas não permitiam edição manual visível nem abertura consistente do calendário ao clicar.

## Causa identificada
O template `frontend/reports.js` sobrepunha uma entrada `<input type="date">` a uma data simulada por `<span>`. O arquivo `frontend/styles/enterprise-gray.css` aplicava `opacity: 0` à entrada nativa na modalidade escura; o indicador decorativo de calendário não era um controle funcional.

## Alteração realizada
- Removidos os `span` de data e ícone decorativo, deixando a entrada nativa visível e clicável.
- Mantidos `type=date`, `lang=pt-BR`, nomes dos campos, submissão via `FormData`, filtros e validação existente de até 93 dias.
- Retirados manipuladores de sincronização da representação de data que deixou de existir.
- Ajustado o CSS do tema grafite para não ocultar o campo de data e respeitar foco/indicador nativo; campos de seleção fora do escopo preservados.
- Adicionado teste Playwright em `tests/browser/reports.spec.js` para ambos os temas, interação com o campo, teclado/foco, clique na região do indicador e aplicação dos filtros.

## Testes e liberação
CI do GitHub é a validação principal de build, testes, navegador e segurança. Além dos testes automatizados, antes de promover à produção confirmar em desktop real a **digitação manual** e a **abertura do seletor de datas** clicando no ícone, inclusive em navegador sem interface pt-BR (a apresentação da data nativa depende do navegador).

**Sem alteração de API, banco D1, migrações ou deploy automático realizado por esta correção.** Branch de trabalho isolada; merge requer revisão dos checks e autorização separada.
