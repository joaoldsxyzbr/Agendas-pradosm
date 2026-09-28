# Usuários com papel único

Data: 2026-09-28

## Objetivo

Simplificar o modelo de acesso do Agenda Prado para que exista uma única fonte de verdade para usuários e seus papéis.

Hoje os visualizadores do dashboard são usuários com `perfil = 'admin'` acompanhados de uma segunda tabela (`usuario_permissoes`) que marca o acesso somente leitura. Isso cria dois mecanismos paralelos para representar o tipo de usuário.

O estado desejado é:

- uma única tabela `usuarios`;
- uma coluna chamada `papel`;
- papéis suportados: `admin`, `conferente` e `visualizador`;
- `loja_id` obrigatório apenas para `conferente`;
- administração de todos os usuários em uma única tela;
- preservação integral dos usuários, senhas, estado ativo/inativo e vínculos existentes;
- nenhum aumento de privilégio durante a migração.

## Modelo de dados

A tabela `usuarios` passa a representar diretamente a autorização principal de cada pessoa.

Campos relevantes:

- `id`
- `loja_id`
- `nome`
- `login`
- `senha_hash`
- `papel`: `admin | conferente | visualizador`
- `ativo`
- `excluido_em`
- `criado_em`
- `atualizado_em`

Regras:

1. `admin`: `loja_id = NULL`.
2. `visualizador`: `loja_id = NULL`.
3. `conferente`: `loja_id IS NOT NULL`.
4. Logins continuam únicos, sem alterar o comportamento case-insensitive existente.
5. Exclusão continua lógica.
6. Senhas nunca são recalculadas durante a migração.

A tabela `usuario_permissoes` deixa de ser necessária após a migração concluída e validada.

## Migração de dados

A migração deve ser compatível com o banco de produção existente.

Mapeamento:

- usuário atual com `perfil = 'loja'` -> `papel = 'conferente'`;
- usuário atual com `perfil = 'admin'` e sem permissão de dashboard somente leitura -> `papel = 'admin'`;
- usuário atual com `perfil = 'admin'` e `usuario_permissoes.dashboard_somente_leitura = 1` -> `papel = 'visualizador'`.

A migração deve preservar:

- `id`;
- `nome`;
- `login`;
- `senha_hash`;
- `ativo`;
- `excluido_em`;
- timestamps existentes;
- `loja_id` dos conferentes.

A remoção da tabela auxiliar deve ocorrer somente depois de os dados terem sido copiados para o novo modelo dentro da própria migração.

## Autenticação e autorização

O login continua usando a tabela `usuarios`.

O usuário autenticado passa a expor diretamente `papel`, sem derivar um segundo campo de acesso a partir de outra tabela.

Permissões:

### Admin

- acesso administrativo completo;
- pode gerenciar usuários e lojas;
- pode importar, consultar e administrar agendas;
- mantém o comportamento administrativo atual.

### Conferente

- acesso apenas à loja associada;
- mantém exatamente o fluxo atual de conferente;
- pode operar os registros permitidos para a própria loja.

### Visualizador

- acesso ao dashboard administrativo em modo somente leitura;
- pode consultar as lojas/agendas necessárias para compor o dashboard;
- não pode criar, editar, excluir, importar, concluir, reabrir ou executar qualquer operação de escrita;
- não pode acessar as telas administrativas de cadastros.

A autorização deve continuar sendo aplicada no backend, não apenas escondida pela interface.

## API

A API administrativa de usuários passa a ser única.

`GET /api/admin/users`

Retorna todos os usuários administráveis, incluindo o campo `papel`.

`POST /api/admin/users`

Aceita:

- `nome`
- `login`
- `senha`
- `papel`
- `lojaId` quando o papel for `conferente`

`PATCH /api/admin/users`

Permite editar:

- nome;
- login;
- senha;
- papel;
- loja;
- situação ativo/inativo.

Ao trocar o papel:

- para `conferente`, uma loja válida é obrigatória;
- para `admin` ou `visualizador`, `loja_id` deve ser limpo.

`DELETE /api/admin/users/:id`

Continua usando exclusão lógica e auditoria.

As rotas específicas `/api/admin/viewers` deixam de ser necessárias depois que a tela e os testes estiverem migrados para a API única.

## Interface

A página de usuários será uma única área de cadastro e gerenciamento.

Formulário:

- Nome
- Login
- Senha
- Papel
- Loja, exibida e obrigatória somente quando `Papel = Conferente`
- botão de cadastro

Tabela:

- Nome
- Login
- Loja
- Papel
- Situação
- ação de edição

Comportamentos:

- admin aparece como `Administrador`;
- conferente aparece como `Conferente`;
- visualizador aparece como `Visualizador`;
- Loja mostra a loja vinculada apenas para conferentes;
- para admin e visualizador, Loja mostra `—`;
- o painel separado “Visualizadores do dashboard” é removido;
- edição usa o mesmo modal para os três papéis.

## Auditoria

Criação, edição, troca de papel, alteração de senha, ativação/inativação e exclusão lógica continuam auditadas.

Os registros de auditoria devem incluir o papel anterior e o novo papel quando houver mudança.

## Compatibilidade e segurança

A alteração não deve:

- mudar IDs de usuários;
- invalidar senhas existentes;
- ampliar acesso de visualizadores;
- dar acesso administrativo a conferentes;
- alterar lojas, agendas ou históricos;
- alterar o fluxo de deploy;
- alterar bindings, secrets ou configuração do D1;
- tocar em dados de produção manualmente fora da migração versionada.

## Testes

A implementação deve cobrir pelo menos:

1. migração de admin existente para `admin`;
2. migração de conferente atual para `conferente`;
3. migração de visualizador atual para `visualizador`;
4. login dos três papéis;
5. visualizador continua somente leitura no backend;
6. conferente continua restrito à própria loja;
7. admin mantém acesso completo;
8. criação de usuário para cada papel;
9. troca segura de papel;
10. exigência de loja para conferente;
11. limpeza de `loja_id` ao mudar para admin/visualizador;
12. lista única de usuários na interface;
13. remoção do painel separado de visualizadores;
14. edição, ativação/inativação e exclusão lógica;
15. auditoria da mudança de papel.

## Ordem de implementação

1. Adicionar testes de migração e autorização para o novo campo `papel`.
2. Criar a migração D1 que converte os registros existentes.
3. Unificar o repositório e as rotas de usuários.
4. Atualizar autenticação e middleware para usar `papel`.
5. Atualizar tipos compartilhados.
6. Unificar a tela de usuários e remover o painel separado.
7. Atualizar testes de UI e backend.
8. Remover código específico de visualizadores que ficou sem uso.
9. Rodar a validação completa e o CI uma única vez ao final da implementação.

## Critérios de aceite

A mudança está concluída quando:

- existe apenas um modelo de usuário na aplicação;
- a função/papel do usuário vem diretamente de `usuarios.papel`;
- não existe dependência funcional de `usuario_permissoes`;
- a página de usuários mostra todos os papéis na mesma tabela;
- visualizadores continuam incapazes de executar escritas;
- conferentes continuam vinculados a uma loja;
- todos os dados e senhas existentes são preservados;
- testes e CI passam.
