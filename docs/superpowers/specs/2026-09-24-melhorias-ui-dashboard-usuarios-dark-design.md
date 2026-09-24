# Melhorias de UI, Dashboard e Usuários — Design / Spec

**Data:** 24/09/2026  
**Status:** Planejado  
**Repositório:** joaoldsxyzbr/Agendas-pradosm  
**Stack:** React + TypeScript + Cloudflare Workers  
**Banco:** Cloudflare D1 0a7d7d8b-e033-4644-90d4-fbc9ddc64532

## Objetivo

Modernizar o aplicativo, simplificar o fluxo principal do administrador e ampliar o gerenciamento de usuários.

O resultado deve manter a aplicação simples e rápida, mas com aparência mais moderna, fina e alinhada à identidade visual da empresa.

---

# Task 0 — Corrigir importação incompleta do PDF

## Problema observado

No PDF real da loja **F03 - CANASVIEIRAS**, com data **24/09/2026**, a prévia identifica corretamente loja e data, porém interpreta somente parte dos agendamentos.

Comportamento observado:

~~~text
Total informado no PDF: 24
Agendamentos interpretados: 9
Registros não interpretados: 15

REGISTROS_NAO_INTERPRETADOS:15
TOTAL_DIVERGENTE:24:9
~~~

O bloqueio da importação está correto. O problema a corrigir é o parser deixar de reconhecer registros válidos do formato real do PDF.

## Objetivo

Garantir que o parser interprete todos os agendamentos válidos do formato oficial utilizado pela empresa, sem enfraquecer as validações de segurança da importação.

## Requisitos

- [x] Investigar quais variações de quebra de linha, campos ou registros fazem o parser perder os 15 agendamentos.
- [x] Corrigir o parser para reconhecer esses registros válidos.
- [x] Não ignorar silenciosamente registros que continuem inválidos.
- [x] Manter `REGISTROS_NAO_INTERPRETADOS` como erro bloqueante quando houver registros realmente não reconhecidos.
- [x] Manter `TOTAL_DIVERGENTE` como erro bloqueante quando o total encontrado continuar diferente do total informado no PDF.
- [x] Não resolver o problema apenas escondendo ou removendo as mensagens de validação.
- [x] Criar teste de regressão reproduzindo a estrutura que causa a falha.
- [x] Usar fixture sintética nos testes, sem publicar dados comerciais reais no repositório.

## Caso de regressão obrigatório

Para a estrutura equivalente ao PDF observado:

- loja: **F03 - CANASVIEIRAS**;
- data: **24/09/2026**;
- total informado: **24**;

o parser deve retornar:

~~~text
24 agendamentos interpretados
0 registros não interpretados
nenhum TOTAL_DIVERGENTE
~~~

## Critérios de aceite

- [x] A prévia mostra **24 agendamentos**, e não 9, para o caso reproduzido.
- [x] Não ocorre `REGISTROS_NAO_INTERPRETADOS:15`.
- [x] Não ocorre `TOTAL_DIVERGENTE:24:9`.
- [x] Todos os registros válidos continuam com protocolo, horário, fornecedor, itens, volumes e tipo corretamente associados.
- [x] PDFs realmente incompletos ou malformados continuam sendo bloqueados.
- [x] Os testes existentes de parser e importação continuam passando.
- [x] O fluxo de confirmação da importação não é alterado além da correção do parsing.

---

# Task 1 — Mover “Importar agenda” para o Dashboard

## Objetivo

Transformar a importação em uma ação principal do Dashboard e remover esse item da navegação lateral.

## Requisitos

- [ ] Remover **Importar** do menu lateral.
- [ ] Adicionar botão **Importar agenda** no topo direito do Dashboard.
- [ ] Manter o fluxo atual de importação.
- [ ] O botão deve ficar visualmente destacado sem competir com os KPIs.
- [ ] Em telas pequenas, reposicionar o botão abaixo do título sem quebrar o layout.
- [ ] Não duplicar o fluxo de importação em dois lugares.

## Layout esperado

~~~text
Dashboard                                      [ + Importar agenda ]
Acompanhe a situação das agendas de hoje por loja.
~~~

## Critérios de aceite

- [ ] O menu lateral não mostra mais “Importar”.
- [ ] O Dashboard mostra o botão no topo.
- [ ] A importação continua funcionando como antes.
- [ ] Desktop e mobile permanecem responsivos.

---

# Task 2 — Redesign azul + amarelo

## Objetivo

Atualizar a identidade visual do aplicativo para as cores da empresa e deixar a interface mais moderna, limpa e refinada.

## Direção visual

### Paleta

- **Azul:** cor principal da interface.
- **Amarelo:** cor de destaque.
- **Off-white / cinza muito claro:** fundo do tema claro.
- **Cinzas neutros:** textos secundários, bordas e elementos de apoio.

### Uso das cores

**Azul**
- navegação ativa;
- botões principais;
- títulos e elementos de identidade;
- foco de formulários;
- links e ações principais.

**Amarelo**
- detalhes de destaque;
- alertas visuais;
- chips ou indicadores quando fizer sentido;
- ações que precisam chamar atenção sem parecer destrutivas.

## Componentes a revisar

- [ ] Sidebar.
- [ ] Cabeçalho das páginas.
- [ ] Cards de KPI.
- [ ] Botões.
- [ ] Inputs e selects.
- [ ] Tabelas.
- [ ] Modais.
- [ ] Badges/status.
- [ ] Estados de hover, foco e disabled.
- [ ] Espaçamentos e bordas.
- [ ] Tipografia e hierarquia visual.

## Estilo desejado

- [ ] Visual mais fino e corporativo.
- [ ] Menos peso visual desnecessário.
- [ ] Bordas discretas.
- [ ] Sombras leves.
- [ ] Cantos consistentes.
- [ ] Espaçamento mais respirado.
- [ ] Hierarquia clara entre título, descrição, ação e conteúdo.
- [ ] Evitar excesso de amarelo.
- [ ] Manter contraste e acessibilidade.

## Critérios de aceite

- [ ] Todas as telas principais usam a nova identidade.
- [ ] Não restam cores antigas conflitantes.
- [ ] Estados de interação continuam claros.
- [ ] Layout permanece consistente em desktop e mobile.

---

# Task 3 — Gerenciamento completo de usuários

## Objetivo

Permitir ao administrador controlar completamente os usuários das lojas.

## Funcionalidades

Cada usuário deve permitir:

- [ ] Editar nome.
- [ ] Editar login.
- [ ] Alterar loja vinculada.
- [ ] Ativar ou desativar.
- [ ] Alterar senha.
- [ ] Excluir usuário.

## Tela de usuários

A listagem deve ter ações claras por usuário, preferencialmente através de:

- botão **Editar**;
- ação **Alterar senha** dentro da edição;
- ação **Excluir** com tratamento visual destrutivo.

## Edição

O formulário de edição deve permitir alterar:

~~~text
Nome
Login
Loja
Status
Nova senha (opcional)
~~~

A senha atual não deve ser exibida.

Se o campo de nova senha ficar vazio, a senha existente deve permanecer.

## Exclusão

- [ ] Solicitar confirmação antes de excluir.
- [ ] Informar claramente qual usuário será removido.
- [ ] Não permitir exclusão acidental do próprio administrador logado.
- [ ] Atualizar a listagem imediatamente após sucesso.
- [ ] Exibir erro amigável em caso de falha.

## Validações

- [ ] Login obrigatório.
- [ ] Login único.
- [ ] Nome obrigatório.
- [ ] Usuário de loja deve possuir uma loja válida.
- [ ] Nova senha deve respeitar as regras existentes do sistema.
- [ ] Não retornar senha_hash para o frontend.

## Backend

A API deve suportar:

- [ ] consultar usuários;
- [ ] editar usuário;
- [ ] atualizar senha;
- [ ] alterar status;
- [ ] excluir usuário.

Quando possível, reutilizar o endpoint de edição para nome, login, loja, status e senha, evitando endpoints desnecessários.

## Segurança

- [ ] Apenas administrador pode executar essas ações.
- [ ] Hash da senha deve continuar sendo gerado somente no backend.
- [ ] Nunca armazenar senha em texto puro.
- [ ] Nunca retornar senha/hash em respostas da API.
- [ ] Validar usuário e loja antes de atualizar.
- [ ] Tratar login duplicado corretamente.

## Critérios de aceite

- [ ] Administrador consegue editar todas as informações permitidas.
- [ ] Alteração de senha funciona.
- [ ] Usuário excluído deixa de aparecer e não consegue autenticar.
- [ ] Usuário desativado não consegue autenticar.
- [ ] Login duplicado é rejeitado sem erro 500.
- [ ] Ações destrutivas possuem confirmação.

---

# Task 4 — Modo dark

## Objetivo

Adicionar tema escuro mantendo a mesma identidade azul + amarelo.

## Requisitos

- [ ] Criar tema claro.
- [ ] Criar tema escuro.
- [ ] Adicionar controle para alternar o tema.
- [ ] Salvar a preferência do usuário.
- [ ] Restaurar a preferência na próxima visita.
- [ ] Evitar flash forte do tema errado durante o carregamento.

## Tema claro

Direção:

- fundo off-white/cinza muito claro;
- superfícies brancas;
- azul como cor principal;
- amarelo como destaque;
- textos em tons escuros.

## Tema escuro

Direção:

- fundo azul-marinho/grafite;
- superfícies levemente mais claras;
- azul vivo nos elementos interativos;
- amarelo/dourado nos destaques;
- textos claros;
- bordas discretas.

Evitar preto puro em grandes áreas.

## Componentes obrigatórios no dark

- [ ] Sidebar.
- [ ] Dashboard.
- [ ] Cards.
- [ ] Tabelas.
- [ ] Formulários.
- [ ] Modais.
- [ ] Dropdowns.
- [ ] Badges.
- [ ] Tooltips.
- [ ] Estados de hover/foco.
- [ ] Tela de login.
- [ ] Tela de histórico.
- [ ] Tela de lojas.
- [ ] Tela de usuários.
- [ ] Fluxo de importação.

## Preferência

Pode ser persistida localmente no navegador.

Valor sugerido:

~~~text
theme = light | dark
~~~

## Critérios de aceite

- [ ] Alternância ocorre sem recarregar a página.
- [ ] Preferência é mantida.
- [ ] Contraste permanece legível.
- [ ] Nenhum componente fica com fundo/texto incompatível.
- [ ] Azul + amarelo continuam reconhecíveis nos dois temas.

---

# Navegação final esperada

Após a Task 1, a sidebar deve ficar mais enxuta:

~~~text
Dashboard
Histórico
Lojas
Usuários
~~~

A importação passa a ser uma ação contextual do Dashboard.

---

# Regras de implementação

- Executar **uma task por vez**.
- Fazer todas as alterações necessárias da task antes da validação final.
- Usar TDD para comportamentos novos ou alterados quando aplicável.
- Evitar refatorações sem relação com a task atual.
- Não alterar funcionalidades existentes sem necessidade.
- Não alterar nem apagar dados existentes do D1 sem necessidade.
- Após concluir cada task:
  - revisar o diff;
  - executar o CI uma única vez;
  - corrigir apenas o necessário se falhar;
  - marcar a task como [x] somente após validação.
- Após três falhas na mesma task, mudar de estratégia ou registrar o bloqueio.

---

# Ordem de execução

1. [x] **Task 0 — Corrigir importação incompleta do PDF**
2. [ ] **Task 1 — Mover Importar agenda**
3. [ ] **Task 2 — Redesign azul + amarelo**
4. [ ] **Task 3 — Gerenciamento completo de usuários**
5. [ ] **Task 4 — Modo dark**

---

# Definição de pronto

A melhoria estará concluída quando:

- [ ] todas as cinco tasks estiverem marcadas como concluídas;
- [ ] o CI estiver passando;
- [ ] o fluxo de login continuar funcional;
- [ ] o parser interpretar integralmente o formato real validado, sem perda de registros;
- [ ] o fluxo de importação continuar funcional;
- [ ] gerenciamento de usuários estiver completo;
- [ ] temas claro e escuro estiverem consistentes;
- [ ] desktop e mobile estiverem funcionais;
- [ ] a documentação/checklist estiver atualizada no repositório.
