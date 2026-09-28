# Agenda Prado

Aplicação web para importar e visualizar agendas diárias de recebimento por loja.

## Stack

- React + TypeScript + Vite
- Cloudflare Workers
- Cloudflare D1
- Hono
- Vitest

## Pré-requisitos

- Node.js 22
- npm
- conta Cloudflare com acesso ao Worker e ao D1
- Wrangler autenticado para comandos remotos

Instale as dependências:

```bash
npm ci
```

## Desenvolvimento

```bash
npm run dev
```

Verificação completa:

```bash
npm test
npm run typecheck
npm run build
```

`npm test` executa a suíte Worker/D1 e a suíte React/jsdom.

## Banco D1

Banco configurado no `wrangler.jsonc`:

- binding: `DB`
- database_name: `agendas-prado`
- database_id: `0a7d7d8b-e033-4644-90d4-fbc9ddc64532`

Aplicar migrations localmente:

```bash
npx wrangler d1 migrations apply agendas-prado --local
```

Aplicar migrations em produção:

```bash
npx wrangler d1 migrations apply agendas-prado --remote
```

## Segredo de sessão

`SESSION_SECRET` deve existir somente como segredo do Worker. Gere um valor aleatório forte fora do repositório e configure:

```bash
npx wrangler secret put SESSION_SECRET
```

Nunca grave esse valor em arquivo versionado.

## Primeiro administrador

Há dois caminhos seguros. Nenhum grava senha em texto puro.

### Sem ambiente local

Enquanto ainda não existir nenhum registro com perfil `admin`, a tela de login mostra **Preparar primeiro administrador**.

1. Informe nome, login e uma senha com pelo menos 12 caracteres.
2. O Worker gera o hash PBKDF2 e cria o administrador com `ativo = 0`.
3. Esse usuário ainda **não consegue fazer login**.
4. No console do D1, ative somente o login que você acabou de cadastrar:

```sql
UPDATE usuarios
SET ativo = 1,
    atualizado_em = CURRENT_TIMESTAMP
WHERE login = 'SEU_LOGIN'
  AND perfil = 'admin'
  AND ativo = 0;
```

Depois da criação do primeiro registro administrativo, a opção de preparação desaparece automaticamente. A ativação explícita no D1 impede que um cadastro público, sozinho, obtenha acesso administrativo.

### Com ambiente local

O bootstrap por script usa somente variáveis de ambiente e envia ao D1 apenas o hash PBKDF2 da senha.

### PowerShell

```powershell
$env:ADMIN_NAME="Administrador"
$env:ADMIN_LOGIN="admin"
$env:ADMIN_PASSWORD="<senha-forte-com-12-ou-mais-caracteres>"
npm run bootstrap-admin
```

### Bash

```bash
ADMIN_NAME="Administrador" \
ADMIN_LOGIN="admin" \
ADMIN_PASSWORD="<senha-forte-com-12-ou-mais-caracteres>" \
npm run bootstrap-admin
```

Se o login já existir, o bootstrap atualiza nome e senha, ativa a conta e garante o perfil administrativo.

## Deploy

Depois de aplicar as migrations e configurar `SESSION_SECRET`:

```bash
npm run deploy
```

O deploy executa o build antes de publicar o Worker.

## Fluxo diário do administrador

1. Entrar no painel administrativo.
2. Manter lojas e usuários quando necessário.
3. Usar **Importar agenda** no Dashboard.
4. Selecionar o PDF diário da loja e revisar a prévia.
5. Confirmar a importação.
6. Se já existir agenda para a mesma loja/data, usar **Substituir agenda** somente após revisar a prévia.
7. Usar o seletor de data do Dashboard para acompanhar cada loja.
8. Quando necessário, consultar o histórico diretamente nos cadastros de loja e usuário.

## Fluxo do conferente

1. Entrar com o usuário da própria loja.
2. Selecionar a data desejada na tela de recebimento.
3. Enquanto o dia estiver **Em aberto**, marcar cada fornecedor como **Recebido** ou **Não recebido** e registrar **Trocas** quando houver.
4. Adicionar fornecedor sem agenda quando necessário; esse registro pode ser editado ou removido antes da conclusão.
5. Concluir o dia ao finalizar o recebimento.
6. Dias concluídos ficam somente para consulta do conferente; o administrador pode corrigi-los ou reabri-los.


## Auditoria e histórico

Toda alteração relevante de dados deve deixar uma trilha de auditoria no D1.

- registrar quem realizou a ação e quando;
- registrar a entidade afetada e, quando aplicável, loja, agenda e agendamento relacionados;
- registrar valores anteriores e posteriores para alterações;
- registrar criação, edição e remoção lógica de fornecedores sem agenda;
- registrar status de recebimento, trocas, conclusão e reabertura de dias;
- registrar importação e substituição de agendas;
- registrar criação, edição, ativação/desativação e remoção lógica de lojas e usuários;
- nunca registrar senha, hash de senha, segredo de sessão ou outro segredo;
- exclusões de registros operacionais e cadastros são lógicas quando houver necessidade de preservar histórico;
- leituras, visualizações e cliques comuns não entram na auditoria para evitar ruído.

A consulta administrativa é contextual: o histórico de lojas e usuários aparece dentro dos respectivos modais de edição. A API de auditoria é restrita ao perfil administrador.

## Segurança operacional

- cada usuário de loja acessa somente a loja vinculada à sessão;
- rotas administrativas exigem perfil admin;
- sessões usam cookie HTTP-only;
- dados de autenticação e agenda usam `Cache-Control: no-store`;
- mutações autenticadas validam `Origin` quando enviado pelo navegador;
- o JSON de importação possui limite de 1 MB;
- erros internos retornam resposta genérica sem stack trace ao cliente;
- senhas nunca são armazenadas em texto puro;\n- o PBKDF2-SHA256 usa 100.000 iterações por compatibilidade com o limite do Web Crypto do Cloudflare Workers.

## PDFs reais

**Não commite PDFs reais, texto extraído, notas fiscais, pedidos ou dados comerciais.**

O arquivo `QUINTA LOJA 03.pdf` é referência de aceite manual e deve permanecer fora do repositório público. Os testes automatizados usam apenas fixtures sintéticas.

## CI

O workflow `.github/workflows/ci.yml` roda em pull requests para `main` e em pushes na `main`:

1. `npm ci`
2. `npm test`
3. `npm run typecheck`
4. `npm run build`
