# Agenda Prado

Sistema web para gestão diária das agendas de recebimento das lojas Prado Supermercados.

## Stack

- HTML, CSS e JavaScript ES modules para a interface.
- Hono em Cloudflare Workers para a API.
- Cloudflare D1 isolado por ambiente.
- Zod para validação de dados.
- Playwright e Vitest para testes; Vite não é usado como servidor ou empacotador da aplicação.

## Perfis de acesso

- **admin**: administra lojas, usuários, importações, histórico e ajustes.
- **visualizador**: acompanha o dashboard administrativo em modo somente leitura.
- **conferente**: opera apenas a agenda da própria loja ativa.

A autorização real é aplicada no Worker. A interface também oculta ações que o perfil não pode executar.

### Ativação de usuários e visibilidade das lojas

- O administrador pode **Desativar usuário** e **Ativar usuário** sem excluir cadastro, vínculo, senha ou histórico. A ação exige confirmação.
- Um usuário desativado perde o acesso e as sessões anteriores são invalidadas; depois de reativado, entra novamente com o mesmo login e senha.
- O dashboard administrativo e do visualizador mostra apenas lojas ativas que tenham pelo menos um conferente ativo. Se houver vários, a loja permanece visível enquanto um deles estiver ativo.
- A importação CSV/PDF continua recebendo e preservando agendas de lojas cadastradas e ativas mesmo sem conferente ativo. Ao reativar o conferente, as agendas e histórico voltam a aparecer.
- Usuários inativos continuam consultáveis na tela de cadastros. Desativar **usuário** não desativa a **loja**; a importação segue exigindo que a loja esteja ativa.


## Desenvolvimento local

Pré-requisitos: Node.js 22, npm e Wrangler (autenticado somente para recursos remotos).

Instale as dependências:

```bash
npm ci --legacy-peer-deps
```

Crie um arquivo local .dev.vars com SESSION_SECRET=defina-um-segredo-local-longo-e-aleatorio. Arquivos .dev.vars* e .env* são ignorados e não devem ser versionados.

Prepare o D1 local com npx wrangler d1 migrations apply DB --local.
Inicie a aplicação HTML/JavaScript e o Worker com npm run dev.
Wrangler serve os assets estáticos de public/ e o Worker local usando .wrangler/state.

## Comandos principais

| Comando | Função |
| --- | --- |
| npm run dev | Interface estática e Worker local pelo Wrangler |
| npm test | Testes do Worker, parser e guards do projeto |
| npm run test:e2e | Build + D1 local isolado + Playwright Chromium + axe |
| npm run check:javascript | Sintaxe JS e ausência de fontes TypeScript |
| npm run build | Extrator PDF e validação do Worker/assets |
| npm run verify:production | Testes + sintaxe JavaScript + build |
| npm run check:migrations | Bloqueia migrations destrutivas sem aprovação |
| npm run deploy | Verifica, aplica migrations remotas e publica pelo Wrangler |
| npm run bootstrap-admin | Bootstrap administrativo de emergência, somente break-glass |

## D1 e migrations

As migrations ficam em `migrations/`.

Para desenvolvimento:

```bash
npx wrangler d1 migrations apply DB --local
```

No fluxo normal de produção, **não aplique migrations remotas separadamente**. O comando oficial é `npm run deploy`, executado pelo Cloudflare Workers Builds, que segue esta ordem:

1. verificação completa da aplicação;
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
