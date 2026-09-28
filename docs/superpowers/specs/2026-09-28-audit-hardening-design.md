# Auditoria e hardening pós-auditoria — Design

Data: 2026-09-28

## Objetivo

Corrigir todos os achados acionáveis da auditoria de produção, preservando o comportamento atual do app e mantendo PBKDF2-SHA256 em 100.000 iterações.

## Escopo aprovado

1. Tornar o deploy seguro para migrations incompatíveis.
2. Fazer o fechamento de agendas passadas acontecer por Cron Trigger, mantendo o fechamento lazy como fallback.
3. Tornar a proteção do último administrador atômica no D1.
4. Bloquear conferentes ligados a loja inativa ou removida.
5. Tornar o bootstrap do primeiro administrador atômico com a auditoria.
6. Falhar de forma segura quando o rate limiter de login estiver indisponível.
7. Adicionar smoke E2E em navegador real e checagem automatizada básica de acessibilidade.
8. Fortalecer a política de integração no GitHub quando a API disponível permitir.

## Fora de escopo

- Alterar as 100.000 iterações do PBKDF2.
- Trocar algoritmo de senha.
- Refatorações visuais ou funcionais não relacionadas.
- Alterar dados operacionais de produção.

## Design

### Deploy e migrations

O comando de deploy deve executar primeiro toda a verificação de produção. Antes de aplicar migrations, um script local deve rejeitar novas migrations destrutivas posteriores ao baseline já aplicado em produção (0012). Migrations aditivas continuam no fluxo normal: verificação → gate de segurança → migrations → deploy.

Isso garante que, se o deploy do Worker falhar depois de uma migration aditiva, o Worker anterior continue compatível. Mudanças destrutivas exigem release em duas fases expand/contract.

### Fechamento automático

A lógica de fechamento será extraída de `worker/app.ts` para um serviço reutilizável. O Worker exportará `fetch` e `scheduled`. Um Cron diário às 03:05 UTC (00:05 em America/Sao_Paulo) fechará agendas anteriores à data operacional. As chamadas HTTP continuarão executando o mesmo fechamento como fallback idempotente.

### Último administrador

Uma migration aditiva criará triggers SQLite/D1 que impedem UPDATE/DELETE que deixariam zero administradores ativos não removidos. A regra deixa de depender de uma contagem feita pela aplicação antes do UPDATE.

### Loja inativa

Conferentes só terão sessão válida quando a loja vinculada existir, não estiver removida e estiver ativa. Admin e visualizador permanecem sem loja obrigatória.

### Bootstrap

A criação condicional do primeiro admin e seu registro de auditoria serão enviados no mesmo `db.batch`, com o INSERT de auditoria condicionado à existência do ID recém-criado. Assim, sucesso/falha é atômico.

### Rate limiter

Se o binding do rate limiter falhar, login não será liberado. A API responderá 503 genérico com `Retry-After`, evitando bypass silencioso da proteção.

### E2E e acessibilidade

Adicionar Playwright para um smoke real da tela de login e análise automatizada com axe. O CI instalará Chromium e executará o teste após build/typecheck.

### GitHub

O repositório deve usar status checks de CI e CodeQL como gate de merge. Se o conector atual não tiver permissão administrativa para criar rulesets, a limitação será registrada explicitamente, sem tentar contornar permissões.

## Critérios de aceite

- Nenhuma alteração em `worker/lib/password.ts` ou no valor 100.000.
- CI completo verde.
- Cron configurado e handler coberto por teste.
- D1 local testa proteção atômica do último admin.
- Login de conferente com loja inativa retorna 401.
- Falha do limiter retorna 503.
- Bootstrap cria usuário e auditoria de forma atômica.
- Migration safety gate rejeita migration destrutiva nova em teste.
- E2E Chromium passa e não reporta violações axe na tela de login.
- Produção só será alterada após CI verde e merge explícito.
