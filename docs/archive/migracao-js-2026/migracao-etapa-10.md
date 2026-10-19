# Etapa 10 — começo do frontend JS puro com paridade da main

Data: 18/10/2026 · Branch `migracao-js-puro`

## Adicionado

- `src/agenda/exportAgendaPdf.js`: transpilação nativa do módulo de PDF existente no repositório, com mesmas funções, colunas e cabeçalhos, inicialmente verificada quanto à assinatura PDF e nome de arquivo.
- `migration/frontend/api.js`: cliente `apiFetch` com `credentials: include`, tratamento de erros e HTTP 204 idênticos à `main`.
- `migration/frontend/session.js`: restauração `/api/auth/me`, login/logout com os mesmos endpoints e sem React.
- `migration/frontend/routes.js`: mantém as URLs normais do React Router da `main` (`/login`, `/admin`, subpáginas e `/app`), inclusive permissões do visualizador e do conferente. Não usa hash como a `preview`.
- `migration/frontend/theme.js`: dark por padrão, mesmas classes e preferência de tema.
- `migration/frontend/shell.js`: cabeçalhos admin/conferente com a estrutura e classes da `main`, protegendo contra injeção HTML em nomes.
- `migration/frontend/login.js`: UI de login/primeiro administrador preservada com eventos nativos, sem login rápido de testes.
- `migration/frontend/runtime.js`: roteador browser History API e ciclo de vida de páginas, com logout independente de falhas de presença.

## Validações

Foram verificadas isoladamente 8 combinações de rota/perfil, autenticação, escape de HTML e geração de PDF binário. Testes de contrato também adicionados em `tests/migration/frontend-core.test.js` e `tests/migration/login-runtime-static.test.js`.

**Não ativado no site nem em produção:** `migration/frontend` é uma implementação de transição, sem ligação com `index.html`. O runtime interrompe a navegação se o renderer de determinada tela ainda não existir, para impedir homologação de um sistema incompleto.

## Próximos trabalhos

Converter `TodayPage`, `DashboardPage`, telas administrativas, modais, importação, presença/WebSocket; depois montar o entrypoint definitivo usando CSS original e testar contra a `main`. Só ao final retirar TS, React e Vite. CI continua falhando; não afirmar testes completos aprovados. Produção, `preview` e D1 não foram alterados.