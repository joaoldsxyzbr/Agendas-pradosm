# Regra operacional de senha e testes autenticados — 20/10/2026

## PBKDF2: decisão do responsável

O projeto **deve usar exatamente 100.000 iterações de PBKDF2-HMAC-SHA256 para gerar novos hashes**. Não elevar para 600 mil ou superior. Foi relatado que o aumento já causou falha/indisponibilidade em outros projetos e exigiu reversão. A estabilidade do Agendas Pradosm prevalece sobre recomendações genéricas de custo de derivação.

O módulo `worker/lib/password.js` mantém `CURRENT_ITERATIONS = 100000`. O CI verifica `PASSWORD_HASH_ITERATIONS === 100000`. O suporte de leitura de hashes já existentes com valor maior (se houver) deve permanecer apenas para evitar bloquear acessos; **isso não muda o parâmetro usado ao criar hashes novos**.

As rotinas `npm run benchmark:password` e `node scripts/benchmark-password-workerd.mjs` não medem mais valores superiores. Não há necessidade de criar Worker remoto, fazer migration D1 ou solicitar credenciais.

## Testes de autenticação e autorização

Testes locais com conta sintética e API real do Worker validam entrada/saída, cookie assinado, autenticação por perfil e bloqueio de acesso indevido. Devem utilizar SQLite nativo em memória, sem acessar D1 remoto, e a WebCrypto nativa. As rotas de relatório e gestão precisam confirmar controle de perfis no **backend** (ocultar botões no frontend não substitui autorização).

Verificações de login com dados reais em produção continuam fora do escopo da automação; não utilizar credenciais reais em testes, logs, repositório ou conversa.
