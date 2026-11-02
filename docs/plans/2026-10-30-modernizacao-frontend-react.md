# Plano de modernização do frontend — Agendas Pradosm
Data: 2026-10-30 · Status: planejado, **não implementado** · Origem: `preview`

## 1. Decisão arquitetural

Modernizar **somente a interface** para uma SPA com React, TypeScript (strict), Vite,
Tailwind CSS v4, shadcn/ui, React Router, TanStack Query, TanStack Table,
React Hook Form e Zod. Manter o backend Hono/Cloudflare Workers, D1, Durable
Objects, sessões por cookie, cron, controle de acesso, API e regras de negócio.

Não adicionar Next.js, SSR, Redux/Zustand, novo ORM nem novo banco apenas
para viabilizar a migração. Preservar Chart.js, Lucide e parser PDF WASM
onde comprovadamente adequados; avaliar troca somente com evidência.

**Decisão reversa consciente:** o repositório foi migrado de React/TSX para
JavaScript puro em outubro/2026 (`docs/archive/migracao-js-2026/`).
A nova arquitetura exige revisar explicitamente esse contrato e os
checks que hoje proíbem `.ts`, `.tsx`, React, Vite e TypeScript.
Manter os gates de segurança, em vez de simplesmente removê-los.

## 2. Cenário confirmado no GitHub (preview, 2026-10-30)

- Rota SPA baseada em History API, com 10 páginas:
  `/login`, `/admin`, `/admin/history`, `/admin/import`,
  `/admin/stores`, `/admin/users`, `/admin/reports`,
  `/admin/diagnostics`, `/app`, `/app/tags`.
- Três perfis: administrador; visualizador restrito a Recebimento/
  Relatórios; conferente restrito a Conferência/Tags.
- Entradas atuais: `frontend/entry.js`, `frontend/application.js`,
  `frontend/runtime.js` e `frontend/pages.js`.
- HTML contém grande cascata de folhas CSS legadas; Tailwind v4 já
  compila na preview, com Preflight desativado e prefixo `tw:`.
- `worker/index.js` mantém Hono, Worker Assets, cron e Durable Object;
  `wrangler.preview.jsonc` usa Worker/D1 de teste separados.
- `npm run build` atual usa `scripts/build-native.mjs`, inclusive
  importmap e assets locais para PDF WASM, Chart.js e Lucide.
- CI atual bloqueia TypeScript/React/Vite explicitamente e contém
  Playwright, CodeQL, auditoria npm, dry-run, testes unitários e D1 local.

## 3. Arquitetura-alvo

```text
src/
  app/                 # bootstrap, providers (Query/Router), error boundary
  layouts/             # AdminLayout, StoreLayout, LoginLayout
  routes/              # route tree, guards por papel, lazy loading
  features/
    auth/
    receiving/         # Recebimento, seleção de data, métricas e popup
    history/
    agenda-import/     # CSV/PDF, validação e confirmações
    stores/
    users/
    reports/
    diagnostics/
    conference/        # conferente, presença, status e observações
    tags/
  components/
    ui/                # código dos componentes shadcn/ui controlado no repo
    operations/        # PageHeader, CompactDataTable, StatusBadge,
                       # KPIStat, DateToolbar, ConfirmationDialog, EmptyState
  lib/
    api/               # API client, tipos e erros; credentials: include
    realtime/          # adaptador WebSocket, reconexão e invalidação do cache
    permissions/       # guards UX; backend permanece autoridade
    dates/             # datas de negócio em America/Sao_Paulo
  styles/              # design tokens, densidade e estilos globais mínimos
worker/                # Hono, endpoints, D1, Durable Objects: preservar
shared/                # contratos de domínio a aproveitar sem mudança semântica
```

Frontend organizado por **funcionalidade**; estilos específicos próximos aos
componentes, tokens globais únicos. Vite gera bundles com lazy loading por rota.

### Integração Cloudflare

Preferir Vite com plugin oficial `@cloudflare/vite-plugin` caso o estudo de
compatibilidade com os bindings (D1, DO, rate limit, cron) e assets WASM passe.
**Fallback seguro:** usar Vite apenas para gerar o frontend estático em `dist`
e manter a compilação/implantação Worker atual pelo Wrangler.
Nenhuma alteração em `wrangler.jsonc` de produção antes de testes isolados.

### Design System

- Paleta azul-grafite; tema escuro consistente; tokens semânticos CSS.
- Densidades `compact` (padrão de operações), `normal`, `comfortable`.
- Acessibilidade: foco visível, teclado, labels, aria, contraste e
  estados de erro/loading/empty; diálogo com foco controlado.
- Componentes: Button, IconButton, Input, Select, DatePicker, Dialog,
  AlertDialog, StatusBadge, Table, FilterBar, KPIStat, Tabs, Toast,
  PageHeader, LoadingState e EmptyState.
- Recebimento compacto já aprovado: referência inicial, com indicadores
  ~76 px, linhas ~60 px e controles ~37 px em desktop; ajustar por
  legibilidade responsiva sem impor esses números a todas as páginas.

## 4. Etapas de implementação e critérios de aceite

### Etapa 0 — Baseline, contratos e segurança (sem mudanças funcionais)
1. Congelar inventário de rotas, APIs, permissões, estados e fluxos.
2. Capturar telas autenticadas em desktop/notebook/mobile, estados vazios,
   loading, erros e modais, usando dados sintéticos determinísticos.
3. Registrar contratos de importação, PDF, relatórios, ações de conferente,
   observações, tags e WebSocket, inclusive quando `REALTIME_MODE=off`.
4. Fixar baseline de performance (bundle inicial, carregamento, número de
   requests, responsividade); aprovar baseline visual com o usuário.

**Aceite:** matriz completa de funcionalidades e screenshots de referência.

### Etapa 1 — Infraestrutura React/Vite isolada
1. Criar branch de implementação **derivada da preview** (sem tocar `main`).
2. Instalar React, React DOM, TypeScript estrito, Vite e adaptador de Workers
   a partir de versões verificadas e lockfile reproduzível.
3. Criar SPA paralela para comparação, usando a mesma API de teste e origem
   controlada; não remover o caminho JS existente nesta etapa.
4. Integrar Tailwind v4 e shadcn/ui com tokens semânticos; verificar CSP,
   caminhos de assets, WASM, rotas SPA e refresh em deep links.
5. Atualizar CI: permitir TS/TSX apenas no frontend novo, rodar
   `tsc --noEmit`, lint e verificações existentes; manter CodeQL e dry-run.

**Aceite:** `npm ci`, desenvolvimento local e build/deploy preview isolado
funcionando; Worker, cron, rate limits e Durable Objects preservados.

### Etapa 2 — Fundação e autenticação
1. API client tipado preservando cookies e tratamento de 401/403/409.
2. Sessão e guarda de rotas por papel; backend continua autorizando ações.
3. Layout Admin/Conferente, navegação, logout, tema, feedback, modais.
4. Criar componentes de UI e Storybook **somente se** facilitar revisão
   dos componentes; não tornar Storybook pré-requisito do deploy.

**Aceite:** autenticação real contra D1 local, rotas por papel, reload,
perda de sessão, redirecionamento, teclado e navegação mobile equivalentes.

### Etapa 3 — Recebimento (piloto visual completo)
1. Migrar `/admin` e o modo somente leitura do visualizador.
2. Reaproveitar `dashboard-model.js`, datas de negócio e contratos.
3. KPIStat, filtro de data, CompactDataTable, status, pendências,
   progresso, popup de agenda e botão de importação.
4. TanStack Query para cache/refetch e adaptação do cliente realtime.
5. Aprovar screenshot em 390, 768, 1288/1366 e 1920 px.

**Aceite:** funções, ações e métricas equivalentes; sem overflow de
página; sem dupla solicitação/concorrência de atualizações; layout compacto.

### Etapa 4 — Conferente e Tags (risco operacional mais alto)
1. Migrar `/app` e `/app/tags`, com lista, filtros, ordenação,
   presença, datas, observações, ações de recebimento/recusa/não chegada,
   tags e estados concluído/reaberto.
2. Preservar semântica do WebSocket: heartbeat, reconexão, eventos e
   invalidação seletiva de TanStack Query; evitar duplicidade de mutations.
3. Validar comportamento com `REALTIME_MODE=off` e com servidor de
   realtime simulado/isolado; jamais testar alterando D1 de produção.

**Aceite:** fluxos de conferente com testes E2E e estados consistentes após
reconexão, mudança de data e várias atualizações.

### Etapa 5 — Cadastros, Histórico e Importação
1. `/admin/stores` e `/admin/users`: tabelas, filtros, CRUD,
   alteração de status/senha, auditoria, permissões e modais.
2. `/admin/history`: períodos, histórico e observações.
3. `/admin/import`: CSV/PDF, prévia, bloqueios, warnings, confirmação,
   deduplicação/substituição e limites existentes de arquivo.
4. Preservar parser PDF/WASM assíncrono; validar CSP e cache de assets.

**Aceite:** mesmos payloads, respostas, erros e trilha de auditoria;
uploads de exemplo e limites/erros cobertos por testes sintéticos.

### Etapa 6 — Relatórios, Diagnósticos e refinamentos finais
1. `/admin/reports`: filtros, períodos, exportações existentes, KPIs,
   agregações, gráficos, estados vazios e modo visualizador.
2. Reutilizar `report-model.js` e Chart.js inicialmente; trocar só se
   benchmarks e UX justificarem.
3. `/admin/diagnostics`: listagens, filtros, detalhes e proteções.
4. Padronizar foco, toasts, erro, responsividade e densidade de todas
   as páginas. Remover CSS legado somente após comparar screenshots.

**Aceite:** paridade funcional e visual de **todas as 10 rotas**,
todos os perfis e seus estados críticos.

### Etapa 7 — Consolidação e promoção
1. Eliminar a árvore DOM JS antiga, folhas obsoletas, importmap
   desnecessário e build próprio **somente após homologação**.
2. Validar pacote final, CSP, assinaturas, lazy loading, performance,
   dependências, acessibilidade e regressão visual.
3. Executar CI completo após concluir os ajustes, corrigir falhas,
   repetir até verde, verificar deploy na Preview Cloudflare.
4. Criar PR de promoção para `main` **somente após aprovação do usuário**,
   preservando migrações D1 e credenciais.

**Aceite:** CI verde no SHA final + Preview navegável nas 10 telas +
aprovação explícita para promover produção.

## 5. Regras de preservação

- **Não tocar outros repositórios.** `main` e produção permanecem intactas
  até liberação expressa.
- D1 de teste da preview separado de D1 de produção; sem copiar dados
  pessoais ou credenciais reais para testes.
- Não alterar endpoints, métodos, payloads, tabelas, migrations, roles,
  cron, sessão, rate limit nem protocolos WebSocket pela modernização visual.
- Separação de estado: TanStack Query para estado do servidor, React state
  para UI local; evitar stores globais/Redux sem necessidade demonstrada.
- Preservar `America/Sao_Paulo`, parsing de datas de negócio e regra
  de virada do dia.
- O bundle React não pode introduzir scripts de CDN e precisa respeitar
  CSP, cookies HttpOnly, proteção de origem e permissão no backend.
- Não trocar Chart.js nem PDF WASM apenas por uniformidade tecnológica.
- Não mudar infraestrutura Cloudflare ou banco durante a migração da UI.
- Risco principal: regressão de operações e CSS; mitigar com migração por
  rota, comparações de screenshots e rollback por commit/deploy do Worker.

## 6. Matriz mínima de homologação

| Rota | Papel | Verificações específicas |
|---|---|---|
| /login | público | login, logout, erro, recuperação de sessão, bootstrap existente |
| /admin | admin e visualizador | KPIs, agenda/detalhes, datas, presença; importação somente admin |
| /admin/history | admin | período, filtros, observações, detalhes |
| /admin/import | admin | CSV, PDF, prévia, erros, confirmação, idempotência |
| /admin/stores | admin | CRUD, filtro, status, auditoria |
| /admin/users | admin | CRUD, papéis, senha, status, auditoria |
| /admin/reports | admin e visualizador | KPIs, gráfico, filtros, períodos |
| /admin/diagnostics | admin | logs, erros, privacidade |
| /app | conferente | presença, estados, observações, reconexão |
| /app/tags | conferente | cadastro e aplicação de tags |

Cenários transversais: desktop e mobile, navegação por teclado, contraste,
latência/erro de API, segurança por papel, sem overflow, reload em deep link
e regressão de dados. Baselines de screenshots Playwright em runner Linux
padronizado para evitar falsos positivos.

## 7. Definition of Done

- `npm ci` reproduz build sem `legacy-peer-deps`, se compatibilidade permitir.
- TypeScript com `strict`, zero erros no typecheck, lint sem erros.
- Contratos e testes unitários verdes; E2E com D1 local e dados sintéticos.
- CodeQL e `npm audit` sem achados bloqueantes; Wrangler dry-run aprovado.
- 10 rotas e 3 perfis testados, incluindo os fluxos críticos.
- Baselines visuais aprovados em múltiplos tamanhos.
- Worker e recursos de Cloudflare intactos, deploy preview confirmado.
- Nenhuma alteração em `main` até aprovação do usuário.

## 8. Fontes oficiais de arquitetura (consultadas em 2026-10-30)

- Cloudflare React + Vite: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- shadcn/ui para Vite: https://ui.shadcn.com/docs/installation/vite
- React Router SPA: https://reactrouter.com/start/declarative/installation
- TanStack Table: https://tanstack.com/table/latest/docs/overview
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Playwright visual: https://playwright.dev/docs/test-snapshots

## 9. Próxima ação executável

Começar Etapa 0 com matriz de equivalência e snapshots, depois criar branch
de implementação baseada na `preview` e executar Etapa 1. Este arquivo é
um plano: não muda o frontend, não instala dependências nem publica produção.
