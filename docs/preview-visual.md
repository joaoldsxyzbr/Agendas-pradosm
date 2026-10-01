# Preview visual corporativa

## Objetivo

A branch `preview` é o laboratório visual do Agenda Prado. Ela existe para testar melhorias de interface com dados sintéticos, sem consultar dados reais, sem alterar o D1 de produção e sem mudar a branch `main`.

## Regras de segurança

- `main` continua sendo a fonte da versão de produção.
- A branch `preview` usa `PREVIEW_MOCKS_ENABLED = true`.
- O frontend da preview não deve consultar endpoints reais enquanto o modo mock estiver ativo.
- O realtime da preview permanece em `off`.
- Não criar nem aplicar migrations de banco para trabalho puramente visual.
- Não publicar mudanças da preview na `main` sem revisão explícita.
- Antes de portar qualquer melhoria para produção, separar a mudança visual do código de mock.

## Dados disponíveis

A preview contém dados representativos para testar:

- lojas com agenda aberta, concluída e ausente;
- conferentes online, ausentes e offline;
- fornecedores com nomes curtos e longos;
- status Aguardando, Recebido, Não recebido e Recusado;
- registros com e sem trocas;
- fornecedor incluído sem agenda;
- usuários Admin, Conferente e Visualizador.

Sessão inicial: Administrador mock.

Para testar outro papel, use **Sair** e entre com um destes logins. A senha pode ser qualquer valor:

- `admin`
- `conferente`
- `visualizador`

## Direção visual

A meta é uma interface corporativa de operação, sóbria, clara e eficiente. Não buscar estética de landing page, dashboard conceitual ou produto de IA.

### Evitar

- excesso de cards flutuantes;
- gradientes decorativos;
- glassmorphism;
- sombras fortes;
- cantos excessivamente arredondados;
- pílulas para qualquer informação;
- ícones decorativos sem função;
- textos de marketing;
- grandes áreas vazias sem necessidade;
- animações chamativas.

### Priorizar

- hierarquia tipográfica clara;
- densidade adequada para uso em PC;
- alinhamento consistente;
- tabelas legíveis e estáveis;
- cores de status com semântica previsível;
- ações primárias e secundárias evidentes;
- estados de foco, hover, loading, vazio, erro e sucesso discretos;
- contraste e navegação por teclado;
- identidade visual da Prado sem exagero.

## Plano visual

### Fase 1 — Fundação

- consolidar escala de espaçamento;
- reduzir variações de raio e sombra;
- revisar tamanhos e pesos tipográficos;
- padronizar botões, inputs, selects, badges e estados;
- definir largura e densidade padrão de páginas administrativas;
- revisar tema claro e escuro em conjunto.

Critério: os componentes básicos devem parecer parte do mesmo sistema.

### Fase 2 — Navegação e estrutura

- profissionalizar sidebar administrativa;
- deixar identificação do usuário e papel mais discreta;
- melhorar hierarquia do cabeçalho;
- revisar alinhamento entre navegação, título, filtros e ações;
- reduzir elementos com aparência de “card por card”.

Critério: a estrutura deve lembrar software interno corporativo, não dashboard genérico.

### Fase 3 — Dashboard administrativo

- dar mais destaque à data e às ações operacionais;
- melhorar leitura das lojas sem aumentar ruído;
- tornar presença, andamento e conclusão visualmente separáveis;
- reduzir quantidade de pílulas;
- transformar métricas em informação escaneável;
- melhorar estado “sem agenda”;
- manter “Ver detalhes” evidente, mas secundário.

Critério: um ADM deve localizar problema, andamento e presença em poucos segundos.

### Fase 4 — Tela do conferente

- priorizar data, estado do dia e tabela;
- melhorar densidade da tabela para uso contínuo;
- reforçar fornecedor e horário como informação principal;
- organizar Status, Ações e Trocas sem poluição;
- tratar nomes longos sem quebrar a leitura;
- deixar busca e “Fornecedor sem agenda” mais integrados ao fluxo;
- revisar modal e tela concluída em leitura.

Critério: operar recebimentos deve exigir o mínimo de deslocamento visual.

### Fase 5 — Cadastros e importação

- padronizar formulários de Lojas e Usuários;
- separar melhor criação de consulta;
- melhorar tabelas administrativas;
- revisar modais de edição e confirmação;
- simplificar visualmente a importação sem esconder validações importantes.

Critério: telas menos usadas continuam coerentes com o núcleo operacional.

### Fase 6 — Acabamento e acessibilidade

- revisar foco visível;
- teclado;
- contraste;
- zoom;
- textos longos;
- telas vazias;
- erros;
- loading;
- estados desabilitados;
- desktop nas larguras realmente usadas pela empresa.

Critério: ausência de cortes, sobreposições, ambiguidades e regressões de acessibilidade.

### Fase 7 — Preparação para produção

- revisar diff visual;
- retirar ou isolar completamente o modo mock das mudanças que forem para produção;
- executar testes de UI, design, typecheck e build;
- testar os fluxos críticos no preview;
- criar PR específica para `main` somente após aprovação visual.

## Ordem sugerida

1. Fundação visual.
2. Dashboard ADM.
3. Tela Conferente.
4. Lojas e Usuários.
5. Importação e modais.
6. Dark mode e acessibilidade.
7. Validação final e PR de produção.

Essa ordem preserva o sistema em uso e permite aprovar a direção visual antes de espalhá-la por todas as telas.
