# Migração JS puro — etapa 2: bibliotecas do Worker

Data: 18/10/2026 · Branch exclusiva: `migracao-js-puro`

Foram adicionados módulos JavaScript para utilitários usados no Worker, preservando as assinaturas públicas e verificações de segurança existentes:

- `worker/lib/http.js` — origem, cabeçalhos HTTP e limites de importação
- `worker/lib/login-rate-limit.js` — limite de tentativas de login
- `worker/lib/password.js` — hash e verificação de senhas
- `worker/lib/presence.js` — classificação online/ausente/offline
- `worker/lib/session.js` — verificação de sessão e cookies
- `worker/lib/time.js` — datas de negócio em Brasília

A conversão utilizou os artefatos JS previamente compilados no próprio repositório; sintaxe e nomes essenciais conferidos antes do commit. Estes módulos **ainda requerem testes completos contra a referência da main**, pois equivalência de nomes não prova equivalência de comportamento.

Teste JavaScript de presença: `node --test tests/migration/worker-utils.test.js`. Outros testes do Worker continuam sendo os originais até a conversão completa.

A execução GitHub Actions **está bloqueada**: jobs de validação na branch `migracao-js-puro` falham rapidamente, com logs retornando HTTP 404 pela integração. Não considerar CI aprovado até investigar na interface GitHub Actions. Não houve deploy, alteração de D1 ou modificação de `main`/`preview`.

Próximos passos: converter repositórios, rotas, serviços e Durable Object; converter UI respeitando a `main`; completar testes e retirar TypeScript, React e Vite apenas ao final.