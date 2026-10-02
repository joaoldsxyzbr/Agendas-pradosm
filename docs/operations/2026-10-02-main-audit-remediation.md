# Remediação da auditoria da main — 02/10/2026

## Escopo

Auditoria e remediação executadas primeiro na branch `preview`, sem alteração da `main` nem do D1 de produção.

Fluxo obrigatório: `preview → validar → main`.

## Remediações implementadas na preview

- [x] `preview` sincronizada com a `main` atual como ancestral, sem perder mocks/visuais exclusivos.
- [x] CI completo executado também em `preview`.
- [x] Dashboard ADM/Visualizador passou a acompanhar a virada da data operacional.
- [x] Conferente e Dashboard compartilham a mesma fonte de data operacional.
- [x] WebSocket recebeu expiração vinculada à sessão autenticada.
- [x] Logout, troca de senha e desativação encerram conexões realtime do usuário.
- [x] Troca de papel/loja força reconexão com identidade atualizada.
- [x] Cliente realtime não entra em reconexão infinita após sessão revogada.
- [x] Rate limit de login separado por origem e por login.
- [x] Senhas novas/alteradas exigem no mínimo 12 caracteres.
- [x] Formatos PBKDF2 ficam versionados para permitir futura elevação do work factor.
- [x] Arquivos CSV/PDF acima de 10 MB são recusados antes do parser no navegador.
- [x] E2E da preview desliga mocks somente no bundle de CI e usa Worker/D1 local real.
- [x] Contraste dos botões da preview ajustado para acessibilidade.
- [x] Caminho de deploy preparado para evitar executar `verify:production` duas vezes no Workers Builds.
- [x] Runbook de produção atualizado.
- [x] Itens externos não automatizáveis registrados na issue #82.

## PBKDF2 e limite de CPU

A recomendação genérica de elevar PBKDF2-HMAC-SHA256 para 600.000 iterações não foi promovida como padrão porque o plano Workers não pôde ser confirmado pela API disponível.

A documentação atual da Cloudflare limita Workers Free a 10 ms de CPU por requisição. O projeto mantém 100.000 iterações, que já estão em produção, e compensa o risco com:

- rate limit por origem;
- rate limit por login;
- senha mínima de 12 caracteres para novas senhas;
- sessão assinada e revogável;
- preparação do formato do hash para aumento futuro.

Elevar o fator exige confirmação de Workers Paid ou benchmark no runtime real sem erro 1102.

## Validação

O commit de referência da validação deve ser o HEAD final da `preview`.

Critérios obrigatórios antes de promoção:

- `npm audit --omit=dev`;
- testes Worker/UI;
- typecheck;
- build;
- E2E + axe;
- CodeQL;
- check agregado `verify`;
- Workers Build da Preview;
- `preview` deve estar 0 commits atrás da `main`.

## Fora do código

Issue #82 registra:

- branch protection da `main` sem bypass rotineiro;
- segundo administrador real;
- decisão sobre visibilidade do repositório;
- confirmação futura do work factor de senha.

## Produção

A promoção seletiva para a `main` foi autorizada e executada em 02/10/2026.

Foram promovidas apenas as correções técnicas da auditoria. Mocks, CSS e experimentos visuais exclusivos da `preview` permaneceram fora da produção.

Após o CI e o deploy da `main`, o deploy command externo da Cloudflare deve permanecer em `npm run deploy:cloudflare`.
