# Logs, diagnósticos e auditoria — plano e operação

**Branch:** `feat/logs-auditoria-diagnosticos-20261022` (base `main` df43f841). Este trabalho não altera produção.

## Objetivo
Preservar a auditoria de alterações de usuários e recebimentos e acrescentar diagnóstico das falhas de frontend, importação, Worker e operação, consultável pelo administrador.

## Arquitetura
- A tabela `auditoria` e o endpoint `/api/admin/audit` permanecem intactos.
- Migration aditiva `0018_diagnosticos.sql` cria tabela própria e índices.
- `POST /api/diagnostics/events`: exige sessão, proteção de origem, esquema estrito e limite de 30 eventos/usuário/minuto; somente códigos e métricas tipados.
- `GET /api/admin/diagnostics`: somente perfil administrador, filtros nível, operação, origem e data; máximo 200.
- Erros inesperados do Worker e erros de importação geram eventos identificáveis por UUID. Cloudflare Observability continua para rastros do runtime.
- O navegador envia resultados de leitura/validação/envio de importação, erros globais e rejeições de promessas, sem capturar dados pessoais.

## Privacidade
**Nunca enviar nem persistir** conteúdo/nome do CSV ou PDF, nomes de fornecedores, URLs com parâmetros, valores digitados, stack trace, IP, corpo de requisição, cookies, tokens ou senha. O servidor ignora campos desconhecidos. Apenas formatos e códigos enumerados, status HTTP, contagem limitada e UUID de correlação.

## Retenção e operação
Apagar apenas eventos técnicos de `diagnosticos` com mais de **30 dias**, no cron diário existente. A política **não** se aplica à tabela `auditoria`. Falha em log não deve impedir a operação principal; dados operacionais e logs técnicos separados.

## Aceitação
1. Acesso a logs só do administrador; negar visualizador e conferente.
2. Eventos válidos são consultáveis com filtros, com código e correlação; payload com segredo livre é rejeitado.
3. Erros de leitura, validação e resposta da API de importação são visíveis sem dados empresariais.
4. Tests `npm run verify:production`, Playwright, migrations local D1 e CodeQL/CI aprovados.
5. Sem adicionar dependências nem mudar PBKDF2 (100.000 iterações), nem escrever no D1 remoto.
6. Verificação em Preview antes de qualquer decisão de merge à `main`.

## Reversão
Antes da integração a produção, a branch pode ser encerrada sem efeito na operação. Após migration: deixar a nova tabela aditiva inativa se necessário; nunca tentar rollback destrutivo de banco. Reverter apenas código por release controlada.
## Como usar no aplicativo
1. Administrador: abrir **Logs e Auditoria** na navegação lateral.
2. **Erros**: vê eventos com nível error e identificador de correlação (primeiros 8 caracteres na tabela; valor completo em tooltip).
3. **Operações**: acompanha eventos informativos/avisos, especialmente importações.
4. **Auditoria**: histórico existente de alterações de cadastros e agendas, sem conflitar com diagnósticos.
5. Use os filtros de data UTC, origem, área, usuário e loja; apenas os campos aplicáveis à aba permanecem habilitados.
6. Use **Atualizar** para recarregar os últimos 100 resultados por consulta. O painel não faz polling contínuo.

## Correlação de incidentes
- Para falhas HTTP 5xx, a API informa `X-Error-Id`; o navegador reutiliza o identificador no seu evento de falha de importação.
- Pesquisar o UUID completo no campo retornado pela API ou correlacionar o prefixo da interface com o Cloudflare Observability.
- `GET /api/admin/diagnostics?operacao=importacao&nivel=error&date=2026-10-22` retorna os eventos filtrados ao administrador.
- Códigos técnicos não registram a mensagem real da exceção; em caso complexo, correlacione com monitoramento do Worker, respeitando a política de dados.
- Eventos `browser` são autodeclarados por clientes autenticados e não substituem comprovantes de gravação nem registros `worker` ou `auditoria`.
- O navegador ignora falha de telemetria, sem interromper a operação principal.

## Política de publicação e validação
- A nova migration é **aditiva** e só será aplicada ao D1 remoto pelo fluxo de deploy regular **após** eventual integração à main.
- Não subir eventos falsos nem acionar a API de produção para testes.
- Validar em Preview isolado, com D1 local de CI e papéis admin/visualizador/conferente.
- Código e documentação permanecem na branch até CI + CodeQL + Preview verdes.
- A feature de arrastar/soltar CSV/PDF está em **PR #120** e é independente destes diagnósticos.
## Compatibilidade de migrations
A migration `0018` é preservada no estado original porque previews anteriores podem tê-la aplicado. Os campos `loja_id` e `duracao_ms` entram exclusivamente na `0019`, evitando divergência no D1 da Preview. Nunca reescrever migrations já aplicadas em outros ambientes. O cron remove somente diagnósticos com mais de 30 dias, não a auditoria de negócios.