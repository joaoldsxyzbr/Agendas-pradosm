# Baseline operacional da migração React — 30/10/2026

**Fonte:** branch `preview` do repositório Agendas-pradosm no início da
`modernizacao-react-vite`, commit `47bf342`.
A implementação antiga permanece operacional em `frontend/`.

## Contrato de rotas e permissões

| Caminho | Admin | Visualizador | Conferente | Resultado atual |
|---|---|---|---|---|
| /login | redireciona ao /admin | redireciona ao /admin | redireciona ao /app | autenticação não logada |
| /admin | sim | somente leitura | não | dashboard de lojas |
| /admin/history | sim | não | não | histórico e observações |
| /admin/import | sim | não | não | CSV/PDF |
| /admin/stores | sim | não | não | cadastro de lojas |
| /admin/users | sim | não | não | cadastro de usuários |
| /admin/reports | sim | sim | não | relatórios e gráficos |
| /admin/diagnostics | sim | não | não | logs/auditoria |
| /app | não | não | sim | conferência por loja |
| /app/tags | não | não | sim | tags de fornecedores |

Regra de navegação existente: `frontend/routes.js`.
A API `/api/auth/me` restaura a sessão; `/api/auth/login` recebe
`{login, senha}`; `/api/auth/logout` termina a sessão. Cookies são
controlados pelo Worker e as rotas protegidas no backend.

## Fluxos que não podem regredir

1. Recebimento: data, KPIs, presença, progresso, pendências, modal, importação.
2. Conferente: status, observações, tags, filtros, datas, recebimento e
   fechamento/reabertura da agenda.
3. Importação: CSV/PDF, prévia, validações, duplicidade e confirmação.
4. Cadastros: CRUD, permissões, auditoria e estados ativos/inativos.
5. Relatórios: filtros, agregações, intervalos, gráficos e acesso visualizador.
6. Segurança: sessões, papéis, origem, rate limit, cookie, D1 separado.
7. Tempo real: WebSocket e modo desativado, reconexão, presença e invalidação.

Referências de testes atuais: `tests/browser/smoke.spec.js`,
`recebimento-refino.spec.js`, `conferente-layout.spec.js`,
`reports.spec.js`, `tags.spec.js`, `api-d1-real.spec.js`,
mais `tests/unit/`.

## Capturas de referência pendentes

Ainda será necessário capturar screenshots da versão atual, com mocks fixos,
nos tamanhos **390, 768, 1288, 1366 e 1920 px**, cobrindo as dez telas,
modais, loading/erro/empty e temas. Não afirmar paridade visual antes disso.

## Entrega de fundação na nova branch

A primeira camada React deve existir paralelamente em `apps/web`,
ser construída em `dist-modern/` e não modificar o build do Worker atual.
O novo app suporta sessão e caminhos autorizados, mas as telas ainda são
**placeholders explicitamente identificados**, sem ações operacionais.
