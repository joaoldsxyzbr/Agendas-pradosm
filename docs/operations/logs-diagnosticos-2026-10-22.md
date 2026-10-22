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
