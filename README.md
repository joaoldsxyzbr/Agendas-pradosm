# Agenda Prado

Sistema web para gestão diária das agendas de recebimento das lojas Prado Supermercados.

## Stack

- **JavaScript puro (ES Modules), HTML e CSS** — sem React, Vite ou TypeScript
- Hono em Cloudflare Workers
- Cloudflare D1
- Zod
- Testes Node.js nativos e validação do Worker
- Playwright + Chromium com APIs mockadas para os testes de navegador

## Perfis de acesso

- **admin**: administra lojas, usuários, importações, histórico e ajustes.
- **visualizador**: consulta o dashboard e os relatórios gerenciais, sempre em modo somente leitura.
- **conferente**: opera apenas a agenda da própria loja ativa.

A autorização real é aplicada no Worker. A interface também oculta ações que o perfil não pode executar.

### Ativação de usuários e visibilidade das lojas

- O administrador pode **Desativar usuário** e **Ativar usuário** sem excluir cadastro, vínculo, senha ou histórico. A ação exige confirmação.
- Um usuário desativado perde o acesso e as sessões anteriores são invalidadas; depois de reativado, entra novamente com o mesmo login e senha.
- O dashboard administrativo e do visualizador mostra apenas lojas ativas que tenham pelo menos um conferente ativo. Se houver vários, a loja permanece visível enquanto um deles estiver ativo.
- A importação CSV/PDF continua recebendo e preservando agendas de lojas cadastradas e ativas mesmo sem conferente ativo. Ao reativar o conferente, as agendas e histórico voltam a aparecer.
- Usuários inativos continuam consultáveis na tela de cadastros. Desativar **usuário** não desativa a **loja**; a importação segue exigindo que a loja esteja ativa.


## Organização do repositório

O código em produção está em JavaScript puro (ES Modules); a antiga etapa `migration/frontend` foi consolidada na pasta definitiva `frontend`.

| Pasta/arquivo | Responsabilidade |
| --- | --- |
| `frontend/` | Páginas, componentes, sessão, interações e navegação nativos |
| `frontend/styles/` | CSS do sistema, tema e telas |
| `frontend/import/` e `frontend/agenda/` | Importação de agendas e geração de PDF |
| `worker/` | API, autenticação, serviços, D1 e tempo real do Cloudflare |
| `shared/` | Contratos, datas e validações usados pelo Worker e frontend |
| `migrations/` | Histórico **imutável** de migrações do D1 |
| `public/` | Manifesto, ícone e headers HTTP |
| `tests/unit/`, `tests/browser/`, `tests/fixtures/` | Testes JavaScript, Playwright e dados sintéticos |
| `scripts/` | Build, testes de integridade e bootstrap administrativo |
| `docs/operations/` | Procedimentos atuais; `docs/archive/` guarda históricos de migração |
| `wrangler.jsonc`, `wrangler.local.jsonc` | Produção e ambiente local sintético |

**Branches:** `main` = produção; `testes` = homologação (Preview), com dados isolados conforme a configuração do ambiente. Acesso: https://testes.agendaspradosm.joaolds.xyz.br. Qualquer mudança estrutural deve ser validada em PR, com CI verde, antes da mesclagem na `main`.

Leia [Arquitetura](docs/architecture.md), [Índice da documentação](docs/README.md) e [Publicação segura](docs/operations/production-release.md). O projeto não usa React, Vite ou TypeScript.

## Desenvolvimento local

Pré-requisitos:

- Node.js 22 ou compatível com o CI;
- npm;
- Wrangler autenticado somente quando for necessário acessar recursos remotos.

Instale as dependências:

```bash
npm ci --legacy-peer-deps
```

Crie um arquivo local `.dev.vars`:

```text
SESSION_SECRET=defina-um-segredo-local-longo-e-aleatorio
```

Arquivos `.dev.vars*` e `.env*` são ignorados pelo Git e não devem ser versionados.

Prepare o D1 local:

```bash
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
```

Inicie a aplicação:

```bash
npm run dev
```

O Wrangler usa `.wrangler/state` para o D1 local, com banco sintético especificado em `wrangler.local.jsonc`. Esse diretório é ignorado pelo Git. A interface é servida como arquivos ES Modules, sem bundler.

## Comandos principais

| Comando | Função |
| --- | --- |
| `npm run dev` | HTML/CSS/JS puros e Worker com D1 exclusivamente local |
| `npm test` | Testes de contratos e funcionalidades JavaScript |
| `npm run test:design` | Tokens CSS e layout |
| `npm run test:bootstrap-admin` | Segurança do bootstrap emergencial |
| `npm run test:e2e` | Navegador Chromium com APIs mockadas e Worker local |
| `npm run build` | Arquivos JS/CSS/HTML de produção em `dist/` |
| `npm run verify:production` | Migrations, testes, design, bootstrap e build íntegro |
| `npm run check:migrations` | Bloqueio de migrations destrutivas não aprovadas |
| `npm run deploy` | Validação, migrations remotas e publicação explícita |
| `npm run bootstrap-admin` | Bootstrap emergencial (somente com aprovação operacional) |

## D1 e migrations

As migrations ficam em `migrations/`.

Para desenvolvimento:

```bash
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
```

No fluxo normal de produção, **não aplique migrations remotas separadamente**. O comando oficial é `npm run deploy`, executado pelo Cloudflare Workers Builds, que segue esta ordem:

1. verificação completa da aplicação JavaScript;
2. gate de segurança das migrations;
3. `wrangler d1 migrations apply DB --remote`;
4. `wrangler deploy`.

Mudanças incompatíveis de schema devem seguir expand/contract. Consulte [Release de produção](docs/operations/production-release.md).

## Primeiro administrador

Quando ainda não existe administrador, a tela de login oferece **Preparar primeiro administrador**.

Esse fluxo cria a conta inicialmente inativa e registra auditoria. A própria interface informa que a conta ainda precisa passar pela etapa operacional de ativação no D1. Não trate essa preparação como acesso imediatamente liberado.

O script `npm run bootstrap-admin` é um caminho separado de emergência. Ele é **create-only**, exige que não exista administrador ativo e rejeita um login já existente. Portanto, não deve ser usado para promover, reativar, trocar senha nem ativar uma conta previamente preparada pela interface.

Para o procedimento break-glass, consulte [Release de produção](docs/operations/production-release.md).

## Importação de agendas

A importação administrativa aceita **CSV e PDF**.

- **CSV é o formato principal**: uma exportação com `Filial: Todas` pode conter todas as lojas e é separada automaticamente por filial.
- **PDF é o formato de reserva**: PDFs individuais continuam compatíveis e PDFs consolidados com a coluna `Filial` também são agrupados por loja.
- O lote inteiro é validado antes de gravar. Loja ausente, linha não interpretada, total declarado divergente, data divergente ou conflito sem confirmação bloqueiam a operação.
- A gravação multi-loja usa um único `D1Database.batch()`, portanto uma falha em qualquer loja faz rollback do lote inteiro.
- O lote aceita até 700 agendamentos e ainda passa por uma verificação dinâmica do orçamento de operações do D1 antes da escrita atômica.
- Quando já existe agenda para alguma loja/data, a substituição precisa de confirmação explícita e preserva status, histórico e fornecedores manuais, seguindo o comportamento já existente.
- O formato interno das agendas e a interface do conferente não mudam. A alteração fica restrita à entrada administrativa dos dados.

Os arquivos reais exportados não devem ser versionados. Testes usam dados sintéticos, inclusive um lote de 121 agendamentos distribuídos em 9 unidades.

## Acesso rápido na homologação (somente `testes`)

O login normal da produção permanece intocado. No endereço
`testes.agendaspradosm.joaolds.xyz.br` existe uma seção de acesso rápido
com os perfis **ADM**, **Doca 1** e **Visualizador**. Para reduzir o risco
de uso não autorizado em um endereço público, o operador informa um código
de homologação de alta entropia uma vez por aba; a sessão da aba guarda o
código temporariamente para alternar entre perfis após sair.

O código de acesso **não** deve ser armazenado no repositório nem em
documentação. O arquivo `wrangler.jsonc` habilita o recurso apenas nas
`previews.vars` e armazena somente o SHA-256 do código. O backend exige
o hostname específico da Preview, o código correto e rate limiting antes
de criar contas sintéticas. Só cria os logins reservados
`preview-quick-admin`, `preview-quick-doca01` e
`preview-quick-viewer`, com senha comum deliberadamente inutilizável.
Ao entrar na Doca 1, o banco de Preview recebe a loja sintética
`CD DOCA 01` quando ainda não existe; usuários e loja existentes nunca
são sobrescritos. As sessões passam pela mesma verificação de autenticação
que as contas normais. A operação registra auditoria sem incluir o código.

Para desabilitar, retirar `PREVIEW_QUICK_LOGIN_ENABLED` de
`previews.vars` e publicar somente a Preview de testes; sem a flag ou
fora dos dois domínios de testes o endpoint retorna 404. Antes de considerar
esta funcionalidade disponível, validar a publicação da Preview com a branch
atual e confirmar o funcionamento no D1 isolado, não apenas o CI.

### P3 — Conferente consulta Cross pela agenda e pelo fornecedor (somente `testes`)

- O botão **Ver Cross** aparece na barra da conferência somente para o
  conferente vinculado à `CD DOCA 01` **e somente quando existe agenda
  selecionada**. Sem agenda, o botão permanece oculto.
- Ao abrir, o modal consulta `GET /api/store/cross/agendas/:agendaId` e
  mostra somente fornecedores/protocolos com relatório **ativo** vinculado
  àquela agenda. Fornecedores sem Cross não são listados; nomes repetidos
  são distinguidos por agendamento e protocolo.
- Selecionar um fornecedor consulta
  `GET /api/store/cross/agendas/:agendaId/appointments/:appointmentId`
  e abre os detalhes por loja (descrição, pedido, GTIN, embalagem e
  quantidades) **somente leitura**. Há botão de voltar à lista.
- O modal mantém o foco acessível, aceita Escape, pode ser reaberto e é
  encerrado quando a data ou a agenda são alteradas. Falha no banco
  exibe mensagem, sem consultar relatórios globais como fallback.
- Permissões permanecem no Worker: o conferente deve pertencer ao ID
  da Doca 1 e ter o código de loja correspondente. Nenhuma outra doca
  possui acesso. As antigas APIs/telas independentes permanecem
  temporariamente até P4; a consulta do conferente já usa apenas as
  rotas vinculadas de P1.
- Testes Playwright usam agendas e relatórios sintéticos, incluindo
  escolha entre fornecedores com nomes iguais e protocolos diferentes,
  ausência de agenda, listas vazias e falhas de API.

**Homologação pendente:** o D1 Preview ainda precisa das migrations
`0018`–`0021`, e é necessário testar leitura de PDF real após P4/P5.
Não executar migrations remotas de produção.

### P2 — Importar Cross pela agenda da Doca 1 (somente `testes`)

- Na janela de **consulta da agenda** do ADM, o botão **Importar Cross** aparece
  exclusivamente para `CD DOCA 01`, independentemente do modo `Editar agenda`.
  A importação fica desabilitada quando a agenda estiver concluída.
- O modal oferece apenas os agendamentos ativos daquela agenda, identificados por
  **horário, fornecedor e protocolo**, inclusive quando há nomes repetidos.
- O ADM seleciona o agendamento e o PDF Scm405, confere os dados agrupados por loja
  e confirma. O envio utiliza `POST /api/admin/cross/agendas/:agendaId/appointments/:appointmentId`
  da etapa P1, com `operationalDate` obtida da própria agenda.
- Antes de liberar o formulário, a interface consulta os relatórios ativos e exige
  confirmação explícita para substituir um Cross já vinculado; versões anteriores
  continuam preservadas. PDFs com data diferente da agenda também exigem confirmação.
- Falhas no parser, PDF acima de 10 MB, relatórios incompletos, falta de migrações
  e erros de concorrência bloqueiam a gravação e exibem mensagem ao ADM.
- A interface antiga `/admin/cross` segue disponível durante a transição do P2,
  para ser retirada na etapa P4. O botão `Ver Cross` do conferente não foi alterado;
  a sua nova navegação por fornecedor é a etapa P3.
- Testes E2E usam dados sintéticos e leitura de PDF simulada, sem acessar D1 remoto.
  A leitura real do PDF no navegador ainda precisa de homologação.

### P1 — Cross vinculado ao agendamento (somente branch `testes`)

Foi adicionada a migration aditiva `0021_cross_agendamento_vinculo.sql`
para incluir `agenda_id`, `agendamento_id`, `versao` e `ativo` nos
relatórios de Cross. Relatórios legados permanecem sem vínculo; não são
associados automaticamente a fornecedores. O índice parcial impede dois
relatórios ativos para o mesmo agendamento. Triggers validam que o agendamento
pertence à agenda correta, ao dia operacional e à `CD DOCA 01`.

Novas rotas REST sob `/api/admin/cross`:
- `GET /agendas/:agendaId`: fornecedores da agenda com Cross ativo;
- `GET /agendas/:agendaId/appointments/:appointmentId`: Cross ativo e itens;
- `GET /agendas/:agendaId/appointments/:appointmentId/history`: versões;
- `GET /agendas/:agendaId/appointments/:appointmentId/history/:reportId`: versão histórica;
- `POST /agendas/:agendaId/appointments/:appointmentId`: importar Cross vinculando
  o PDF ao agendamento real (payload do Scm405 atual). A data operacional deve
  corresponder à agenda. Uma substituição exige `replaceActiveReportId` igual
  ao relatório ativo consultado antes da operação.

Para conferentes da Doca 1 existem somente as duas rotas de leitura equivalentes
sob `/api/store/cross`. O backend confere código e ID da doca. Todas as outras
docas são bloqueadas. O acesso de ADM é validado no servidor; visualizadores
não recebem permissão de Cross.

O histórico é imutável: ao substituir, a versão anterior fica inativa e todos
os itens e auditorias são mantidos. Gravações de relatório, itens, substituição
da versão ativa e auditoria são atômicas via `D1.batch`.

**Compatibilidade temporária:** nesta etapa P1, as rotas independentes antigas
continuam existentes e a interface atual ainda não usa os novos endpoints.
A integração na janela da agenda será feita em P2/P3; P4 removerá a navegação
antiga. Até P5, não considerar a Preview pronta para validação do Cross sem a
aplicação controlada das migrations `0018`–`0021` no D1 de homologação.

## Cross-Docking (somente branch testes)

Módulo independente de agendamentos, em homologação até validação operacional.

- O administrador acessa **Cross-Docking** no menu e importa PDF do tipo **Scm405**.
- O navegador extrai o texto usando o motor PDF já incluído no projeto. O parser
  `frontend/import/parseCrossReport.js` identifica empresas/lojas de destino,
  produtos, GTIN, pedidos, embalagens e quantidades de separação.
- A prévia deve conferir todos os totais por loja e o total geral antes de habilitar
  a confirmação. Erros bloqueiam a importação inteira.
- O Worker revalida campos, quantidades e totais; detecta arquivo já importado
  por hash do conteúdo e grava todos os itens e auditoria em lote atômico no D1.
- O conferente de código **CD DOCA 01** vê o botão **Ver Cross** mesmo sem agenda.
  A consulta é somente leitura e protegida no backend. Outras docas e lojas não
  possuem acesso. O administrador consulta o histórico na sua própria tela.
- Os números de loja 01/02/etc. indicam destinos no relatório; não correspondem
  ao código de acesso **CD DOCA 01**. Não existe criação automática de agendas.
- As tabelas `cross_relatorios` e `cross_itens` são criadas por
  `migrations/0020_cross_docking.sql`, sem modificar agendamentos existentes.
- Testar somente com D1 sintético/Preview; nenhum PDF comercial deve ser incluído
  em fixtures, logs ou commits. O PDF original não é armazenado, apenas dados
  estruturados, nome e histórico de importação.
- Em caso de necessidade de desativação operacional, remover a navegação do
  módulo ou voltar a release da Preview; a migration é aditiva e os dados
  importados não devem ser apagados automaticamente.

**Ainda depende de homologação com o PDF real no navegador, publicação Preview e
conferência de permissões no ambiente isolado.** A branch `main` permanece
exclusivamente dedicada à produção.

## Dashboard

Os dados de agenda do dashboard não usam polling periódico. Eles atualizam:

- na carga e troca da data selecionada;
- após ações internas como importação ou reabertura;
- quando o usuário clica em **Atualizar**;
- silenciosamente quando a aba volta a ficar visível.

A presença possui dois caminhos complementares:

- **realtime**, quando o WebSocket está conectado;
- **fallback HTTP/D1**, usado na carga inicial e quando a conexão realtime não está disponível.

No caminho realtime:

- **verde / Online**: existe conexão viva, a aba está visível e houve interação nos últimos 30 segundos;
- **amarelo / Ausente**: a conexão continua viva, mas a aba está oculta ou passou cerca de 30 segundos sem interação;
- **vermelho / Offline**: não existe conexão viva de conferente para a loja/doca.

O conferente envia um heartbeat realtime a cada 20 segundos e o cliente mantém ping/pong hibernável no WebSocket. O hub considera tanto o heartbeat funcional quanto o último auto-response do ping para avaliar liveness. Uma conexão sem qualquer sinal válido por aproximadamente 2 minutos é expirada; fechamento normal e logout continuam refletindo Offline sem esperar esse limite. Eventos de mouse, teclado, foco e rolagem mudam somente o estado realtime quando necessário; não geram escrita D1 por evento.

O ADM recebe snapshot e transições de presença pelo WebSocket. O polling periódico de presença foi removido após a estabilização do realtime. O endpoint HTTP/D1 permanece como fallback de reconciliação na carga, mudança de estado da conexão, retorno de foco e botão **Atualizar**.

O fallback D1 continua intacto nesta fase: heartbeat a cada 2 minutos e regra histórica de Online até 3 minutos, Ausente entre 3 e 7 minutos e Offline depois de 7 minutos. Ele permanece disponível para rollback e indisponibilidade do realtime.

Se houver mais de um conferente ou mais de uma aba vinculada à mesma loja/doca, o dashboard mostra o estado mais ativo entre as conexões válidas.

### Infraestrutura realtime

A migração para atualização em tempo real está sendo feita em fases para não colocar a produção em risco.

A infraestrutura realtime usa:
- Durable Object `RealtimeHub` com WebSocket Hibernation;
- binding `REALTIME_HUB` no Worker;
- endpoint autenticado `/api/realtime`;
- validação de origem e identidade resolvida pelo servidor;
- protocolo realtime versionado;
- configuração `REALTIME_MODE` com fallback seguro para `off`.

Após a validação do **shadow mode**, a presença passa a usar `REALTIME_MODE=on`. O Durable Object mantém somente estado efêmero de conexão/presença; o D1 continua sendo a fonte da verdade dos dados de negócio.

O endpoint `/api/realtime/config` informa o modo ativo apenas para sessões autenticadas. Valor ausente ou desconhecido é tratado como `off`. A presença D1 anterior permanece como fallback de segurança; sua tabela e endpoints continuam preservados para rollback e reconciliação, sem polling periódico no ADM.

### Dashboard em tempo real

Depois da presença, o mesmo canal realtime passa a sinalizar mudanças operacionais do dashboard:

- status Recebido/Não recebido/Aguardando;
- Trocas;
- fornecedor sem agenda criado, editado ou removido;
- concluir e reabrir dia;
- ajustes administrativos;
- importação individual, substituição e importação em lote.

A regra é sempre **D1 primeiro, evento depois**. O Durable Object não replica agenda nem agendamento. Ele transmite apenas um evento `agenda.changed` com identificadores, data e motivo da invalidação.

O ADM/visualizador:
- recarrega somente quando a data do evento é a data atualmente selecionada;
- agrupa rajadas curtas de eventos para evitar várias consultas durante importação em lote;
- atualiza também o modal **Ver detalhes** quando a agenda aberta recebe mudança;
- mantém reconciliação ao voltar para a aba e o botão **Atualizar** como fallback.

Falha ao publicar um evento realtime é registrada, mas **não desfaz nem invalida a mutação que já foi confirmada no D1**.

O plano completo e os checkpoints de rollout estão registrados na issue #59.

## Fechamento automático

O Worker possui Cron Trigger:

```text
5 3 * * *
```

Ele executa às 03:05 UTC, equivalente a 00:05 em `America/Sao_Paulo`, para fechar agendas anteriores à data operacional. As requisições HTTP mantêm o mesmo fechamento como fallback idempotente.

## Produção

A produção usa Cloudflare Workers Builds conectado à branch `main`.

O contrato versionado de operação está em:

- [Release de produção](docs/operations/production-release.md)
- [Recuperação de dados do D1](docs/operations/data-recovery.md)

Os planos e especificações técnicas ficam em `docs/superpowers/`.

## Segurança

- `SESSION_SECRET` é segredo de runtime e não deve ser versionado.
- Cookies de sessão são `HttpOnly`, `SameSite=Strict` e seguros em HTTPS.
- Sessões usam janela de 30 dias e são renovadas automaticamente durante o uso, no máximo uma vez por dia, evitando login diário sem criar uma credencial eterna.
- Sessões são versionadas e são revogadas após troca de senha ou mudança do status ativo/inativo do usuário.
- Conferentes precisam estar ativos e ligados a uma loja ativa/não removida.
- O login usa rate limiter com comportamento fail-closed.
- Códigos de loja são canonicalizados e possuem unicidade case-insensitive.
- Mutações críticas usam operações atômicas no D1 quando o contrato exige.
