# Recebimento — atualização visual da preview
A página `/admin` recebeu um acabamento azul-grafite baseado no mockup aprovado em outubro/2026.

## Implementação
- `frontend/pages/dashboard/style.css`: estilos escopados apenas à `.receiving-page`, com regras para cabeçalho, seletor de data, ações, indicadores, tabela, pendências, estados e responsividade.
- `frontend/dashboard.js`: os cinco números do resumo mantêm as mesmas chaves `data-count`, mas agora têm ícones decorativos locais e legendas em coluna.
- `index.html`: a folha local é carregada depois da fundação global para evitar novos overrides transversais.
- `tests/browser/recebimento-refino.spec.js`: cobre a estrutura, indicadores e aparência proposta; o teste de cor da tabela acompanha a paleta aprovada.

## Contratos mantidos
- Dashboard e Visualizador usam o mesmo componente, com importação apenas para administrador.
- Nenhuma mudança nas APIs, dados D1, regras de presença, contagem, navegação, importação, abertura de detalhes e eventos de tempo real.
- Tabela continua com seis colunas, sem colunas sticky, e rolagem horizontal no celular.
- Ícones são decorativos; textos e estados continuam presentes para leitura e acessibilidade.

## Limites
- O resultado visual precisa ser comparado na preview renderizada para confirmar a proximidade com o mockup; CI funcional não comprova equivalência pixel a pixel.
- Esta alteração é restrita à página Recebimento; não redesenha as demais telas.
