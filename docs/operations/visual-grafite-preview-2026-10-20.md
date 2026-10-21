# Padronização visual grafite — Preview (20/10/2026)

## Objetivo
Retirar o aspecto visual decorativo/inconsistente e aproximar o Agenda Prado de um sistema operacional empresarial: prioridade aos dados, controles previsíveis, distinção clara entre ações e estados e tema cinza-escuro. Exclusivamente na branch `testes`.

## Superfícies revisadas
- Navegação administrativa e do conferente: sidebar e cabeçalho discretos, item selecionado em cinza, ícones locais preservados.
- Recebimento administrativo: resumo e tabela densos, legíveis e com bordas e estados uniformes.
- Conferência: indicadores mais compactos, agenda e observações com prioridade visual.
- Lojas e usuários: formulários, filtros, tabela e modais seguem a mesma escala de espaçamento, cores e botões.
- Relatório gerencial: redução de gradientes, destaque seletivo de KPIs, painéis e filtros planos.
- Login e diálogos: componentes mais sóbrios.

## Implementação
- Arquivo `frontend/styles/enterprise-gray.css` ao fim da cascata, isolado por `html[data-theme="dark"]` quando possível.
- Paleta de superfície neutra com texto contrastante e cores semânticas apenas para sucesso, atenção e erro.
- Nenhuma alteração nos endpoints, regras, autenticação, SQL ou bindings D1.
- Não foram adicionadas dependências. JavaScript/HTML/CSS puro, preservando as bibliotecas já presentes.
- Recomendação de UX: cores por função, hierarquia visual definida por tipografia/estrutura, estados explícitos e contraste; inspirada em documentação de Material 3 (Google) e Atlassian Design System.

## Validação antes de promover
- CI do commit em `testes` deve passar (testes JS, design, browser, build e CodeQL).
- Conferir desktop e celular para Recebimento, Relatório Gerencial, Lojas, Usuários e Conferente.
- Preview usa D1 `agendas-pradosm-teste` separado, e `SESSION_SECRET` específico do Preview.
- Não realizar merge para `main` sem aprovação explícita do usuário.
