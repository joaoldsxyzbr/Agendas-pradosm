# Agenda Prado — Design da aplicação

**Data:** 24/09/2026  
**Status:** Spec para revisão  
**Repositório:** `joaoldsxyzbr/Agendas-prado`

## 1. Objetivo

Criar uma aplicação web simples para substituir a consulta diária das agendas de recebimento em PDF por uma interface clara, responsiva e separada por loja.

O administrador envia diariamente um PDF por loja. O sistema interpreta o PDF no padrão atual do Prado Supermercados, transforma os registros em agendamentos estruturados e disponibiliza cada agenda somente para a loja correspondente.

O conferente da loja deve conseguir consultar a agenda do dia e marcar cada agendamento como recebido, não chegou ou recusado.

## 2. Usuários e permissões

### Administrador

O administrador é o usuário responsável pela operação central do sistema.

Pode:
- fazer login;
- cadastrar, editar, ativar e desativar lojas;
- cadastrar, editar, ativar e desativar usuários de loja;
- enviar o PDF diário de qualquer loja;
- revisar a pré-visualização antes de importar;
- consultar agendas de todas as lojas;
- substituir uma agenda já importada para a mesma loja e data;
- consultar histórico de agendas e alterações de status.

### Usuário de loja

Cada usuário de loja fica vinculado a exatamente uma loja.

Pode:
- fazer login;
- visualizar somente dados da própria loja;
- acessar a agenda de hoje;
- acessar o histórico da própria loja;
- abrir os detalhes de um agendamento;
- alterar o status dos agendamentos da própria loja.

Não pode:
- visualizar outra loja;
- importar PDFs;
- criar lojas;
- criar usuários;
- acessar funções administrativas.

A autorização deve ser validada também no backend. Ocultar telas no frontend não é suficiente.

## 3. Status do agendamento

Todo agendamento importado pela primeira vez nasce com:

- `aguardando`

O conferente pode marcar como:

- `recebido`
- `nao_chegou`
- `recusado`

O status pode ser corrigido posteriormente. Toda mudança deve registrar usuário, status anterior, novo status e data/hora.

## 4. Fluxo diário

1. O administrador entra no sistema.
2. Seleciona a opção de importar agenda.
3. Escolhe o PDF de uma loja.
4. O sistema lê o PDF e identifica loja, data e agendamentos.
5. O sistema apresenta uma pré-visualização.
6. O administrador confirma a importação.
7. A agenda fica disponível para a loja correspondente.
8. Ao entrar, a loja vê somente a agenda referente ao dia atual.
9. Durante o recebimento, o conferente altera o status dos agendamentos.
10. Agendas de dias anteriores ficam disponíveis na tela de histórico.

## 5. Padrão oficial do PDF

A primeira versão será construída para o formato do arquivo de referência `QUINTA LOJA 03.pdf`.

O PDF possui no cabeçalho:
- empresa;
- dia;
- filial no formato código + nome, por exemplo `F03 - CANASVIEIRAS`;
- total de agendas.

Cada agendamento possui os seguintes campos:
- protocolo;
- data da agenda;
- faixa de horário;
- fornecedor;
- itens;
- volumes;
- paletes;
- carga batida;
- tipo;
- número(s) de NF-e;
- pedido(s).

O parser deve aceitar textos quebrados em múltiplas linhas, especialmente:
- nomes de fornecedores;
- `Nota fiscal`;
- `Agenda fixa`;
- listas com múltiplas NF-e;
- listas com múltiplos pedidos.

Os tipos observados no PDF de referência incluem:
- `Nota fiscal`;
- `Pedido`;
- `CNPJ`;
- `Agenda fixa`.

Valores ausentes representados por `-` devem ser tratados como ausência de informação, e não como texto de negócio.

## 6. Importação e validação

A importação deve ser dividida em duas fases: leitura/pré-visualização e confirmação.

Antes da confirmação, mostrar:
- loja identificada;
- data identificada;
- quantidade de agendamentos;
- tabela com os registros interpretados;
- erros ou linhas que não puderam ser interpretadas.

A confirmação deve ser bloqueada quando:
- a loja não puder ser identificada;
- a data não puder ser identificada;
- nenhum agendamento válido for encontrado;
- houver erro estrutural que torne a importação insegura.

O sistema não deve inventar dados ausentes.

## 7. Agenda duplicada e substituição

A combinação `loja + data` deve ser única.

Se já existir uma agenda para a mesma loja e data:
1. o sistema não duplica automaticamente;
2. informa ao administrador que já existe uma agenda;
3. oferece a ação explícita de substituir;
4. exige confirmação antes da substituição.

Na substituição:
- agendamentos com o mesmo protocolo preservam o status atual e o histórico de status;
- protocolos novos entram como `aguardando`;
- protocolos removidos deixam de aparecer na agenda ativa, mas seus registros de histórico não devem ser apagados.

## 8. Tela da loja — Hoje

A tela inicial após login de uma loja mostra exclusivamente a agenda da data atual.

### Cabeçalho

Exibir:
- nome/código da loja;
- data atual;
- ação para sair.

### Resumo

Exibir contadores:
- total;
- aguardando;
- recebidos;
- não chegaram;
- recusados.

### Lista da agenda

Ordenação padrão: horário crescente.

No desktop, usar tabela com:
- horário;
- fornecedor;
- protocolo;
- itens;
- volumes;
- paletes;
- status.

No celular, transformar cada linha em card, mantendo as mesmas informações essenciais.

O status deve ter destaque visual suficiente para identificação rápida, sem depender somente de cor.

Ao selecionar um agendamento, abrir detalhes com:
- todos os campos importados;
- NF-e;
- pedidos;
- tipo;
- status atual;
- histórico de alterações de status.

## 9. Tela da loja — Histórico

A loja pode consultar somente agendas da própria loja.

A tela deve:
- listar dias com agenda;
- permitir selecionar uma data;
- mostrar os agendamentos daquela data;
- manter os status registrados;
- permitir consultar detalhes e histórico de status.

A tela inicial não mistura dias anteriores com a agenda de hoje.

## 10. Painel do administrador

O painel administrativo terá quatro áreas principais.

### Dashboard

Mostrar as agendas do dia por loja, com:
- loja;
- quantidade de agendamentos;
- quantidade por status;
- indicação de agenda ainda não enviada para o dia, quando aplicável.

### Importar agenda

Permitir:
- selecionar PDF;
- processar;
- revisar prévia;
- confirmar;
- tratar duplicidade com substituição explícita.

### Lojas

Permitir:
- cadastrar loja;
- informar código e nome;
- editar;
- ativar/desativar.

### Usuários

Permitir:
- cadastrar usuário;
- vincular usuário a uma loja;
- definir login e senha;
- editar;
- ativar/desativar.

## 11. Arquitetura

### Frontend

- React
- TypeScript
- Vite
- interface responsiva para desktop e celular

Responsabilidades:
- autenticação visual;
- telas da loja;
- telas administrativas;
- leitura inicial do PDF para pré-visualização;
- interação de mudança de status.

### Backend

- Cloudflare Workers
- API HTTP
- validação de autenticação e autorização em todas as operações protegidas

Responsabilidades:
- login e sessão;
- controle de acesso;
- lojas;
- usuários;
- agendas;
- agendamentos;
- histórico de status;
- confirmação de importações;
- proteção contra duplicidade.

### Banco de dados

- Cloudflare D1

### Processamento do PDF

A extração de texto do PDF será realizada no fluxo administrativo usando biblioteca compatível com navegador. O parser da aplicação transforma o texto extraído em uma estrutura validada antes do envio definitivo à API.

Isso evita depender de processamento pesado de PDF dentro do Cloudflare Worker e permite mostrar a prévia antes da gravação.

O backend não confia cegamente no resultado do frontend: deve validar tipos, campos obrigatórios, loja permitida, data e duplicidade antes de persistir.

## 12. Modelo de dados

### `lojas`

- `id`
- `codigo`
- `nome`
- `ativo`
- `criado_em`
- `atualizado_em`

Regras:
- `codigo` único.

### `usuarios`

- `id`
- `loja_id` opcional para administrador
- `nome`
- `login`
- `senha_hash`
- `perfil`: `admin` ou `loja`
- `ativo`
- `criado_em`
- `atualizado_em`

Regras:
- `login` único;
- usuário com perfil `loja` exige `loja_id`;
- senha nunca é armazenada em texto puro.

### `agendas`

- `id`
- `loja_id`
- `data_agenda`
- `arquivo_original`
- `criado_por`
- `criado_em`
- `atualizado_em`

Regras:
- chave única em `loja_id + data_agenda`.

### `agendamentos`

- `id`
- `agenda_id`
- `protocolo`
- `horario_inicio`
- `horario_fim`
- `fornecedor`
- `itens`
- `volumes`
- `paletes`
- `carga_batida`
- `tipo`
- `nfe`
- `pedidos`
- `status`
- `ativo`
- `criado_em`
- `atualizado_em`

Regras:
- protocolo deve ser único dentro da agenda;
- `nfe` e `pedidos` devem suportar múltiplos valores;
- status inicial `aguardando`.

### `historico_status`

- `id`
- `agendamento_id`
- `usuario_id`
- `status_anterior`
- `status_novo`
- `alterado_em`

O histórico não deve ser apagado quando uma agenda for substituída.

## 13. Autenticação e segurança

- login por usuário e senha;
- senha armazenada com hash adequado;
- sessão autenticada por cookie seguro e HTTP-only;
- sessão expira e pode ser encerrada por logout;
- rotas administrativas exigem perfil `admin`;
- rotas da loja devem sempre filtrar pelo `loja_id` da sessão;
- usuário inativo não pode iniciar nova sessão;
- entradas da API devem ser validadas;
- mensagens de erro de login não devem revelar se um usuário específico existe.

## 14. Tratamento de erros

### PDF inválido

Mostrar erro claro e não persistir agenda parcial.

### Loja não cadastrada

A prévia deve informar a filial encontrada e impedir confirmação até que exista uma loja correspondente.

### PDF fora do padrão

Mostrar que o arquivo não pôde ser interpretado com segurança. Não tentar preencher campos por adivinhação.

### Falha de rede ou banco

A interface informa que a operação não foi concluída e mantém o usuário em posição segura para tentar novamente sem criar duplicidade.

### Alteração de status

O frontend só considera a mudança concluída após confirmação da API.

## 15. Testes essenciais

A implementação deve possuir testes para:
- parser do PDF de referência;
- fornecedor quebrado em múltiplas linhas;
- múltiplas NF-e;
- múltiplos pedidos;
- tipos `Nota fiscal`, `Pedido`, `CNPJ` e `Agenda fixa`;
- rejeição de PDF inválido;
- duplicidade por loja + data;
- substituição preservando status por protocolo;
- autorização entre lojas;
- bloqueio de rotas administrativas para usuário de loja;
- mudança de status e gravação do histórico;
- agenda de hoje;
- histórico por loja.

O PDF `QUINTA LOJA 03.pdf` será a referência real de aceitação do parser.

## 16. Fora do escopo da primeira versão

Para manter o projeto simples, a primeira versão não inclui:
- integração automática com o sistema que gera o PDF;
- notificações push;
- aplicativo nativo;
- edição manual dos campos de um agendamento importado;
- relatórios avançados;
- exportação para Excel;
- armazenamento obrigatório do arquivo PDF bruto.

O nome original do arquivo fica registrado na importação.

## 17. Critérios de aceite

A primeira versão é considerada funcional quando:

1. O administrador consegue entrar no sistema.
2. O administrador consegue cadastrar uma loja e um usuário vinculado.
3. O PDF no padrão de referência é lido e exibido em uma prévia coerente.
4. O sistema identifica filial e data do PDF.
5. O administrador confirma a importação.
6. A loja entra com seu usuário e vê somente a própria agenda do dia.
7. Os registros aparecem ordenados por horário.
8. O conferente consegue marcar `recebido`, `nao_chegou` ou `recusado`.
9. A alteração fica salva e auditada.
10. A loja consegue consultar agendas anteriores no histórico.
11. Uma loja não consegue acessar dados de outra.
12. Um PDF repetido para a mesma loja e data não cria duplicidade.
13. O layout funciona bem em desktop e celular.

## 18. Princípios da primeira versão

- Simplicidade operacional.
- Segurança de acesso por loja.
- Nenhuma informação inventada pelo parser.
- Pré-visualização antes da importação.
- Histórico auditável de status.
- Interface rápida para o conferente.
- YAGNI: não adicionar funcionalidades que não estejam necessárias para o fluxo diário definido.
