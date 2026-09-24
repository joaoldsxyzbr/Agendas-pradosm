# Melhorias de UI, Dashboard, Usuários e Dark Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Modernizar o Agenda Prado, mover a importação para o Dashboard, aplicar a identidade azul + amarelo, completar o gerenciamento de usuários de loja e adicionar tema claro/escuro persistente.

**Architecture:** A aplicação continua em React + TypeScript + Vite no frontend e Hono + Cloudflare D1 no Worker. O redesign será centralizado em tokens CSS semânticos, permitindo que o dark mode seja uma extensão da mesma base visual. O gerenciamento de usuários reutiliza o PATCH existente para edição/senha/status e adiciona DELETE sem apagar fisicamente o registro, preservando as referências de auditoria em agendas e histórico.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, React Router 7, Vitest 4, Testing Library, Hono 4, Zod 4, Cloudflare Workers e Cloudflare D1.

**Spec:** docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

## Global Constraints

- Executar uma task por vez.
- Fazer todas as alterações necessárias da task antes da validação final.
- Usar TDD para comportamentos novos ou alterados quando aplicável.
- Evitar refatorações sem relação com a task atual.
- Não alterar funcionalidades existentes sem necessidade.
- Não apagar dados existentes do D1.
- Após concluir cada task: revisar o diff, executar o CI uma única vez, corrigir apenas o necessário se falhar e marcar a task como [x] somente após validação.
- Após três falhas na mesma task, mudar de estratégia ou registrar o bloqueio.
- O fluxo de login deve continuar funcional.
- O fluxo de importação deve continuar funcional.
- Desktop e mobile devem permanecer funcionais.
- A autorização administrativa continua sendo aplicada no backend por requireAuth + requireAdmin.
- Senha e senha_hash nunca podem ser retornados ao frontend.
- A única alteração de schema prevista é uma migration aditiva para suportar exclusão lógica de usuários sem quebrar auditoria.

## Decisões de implementação

Estas decisões fecham pontos técnicos que a spec não define em detalhe:

- A rota /admin/import permanece existente; apenas sai da navegação e passa a ser acessada pelo Dashboard.
- A base visual será centralizada em CSS custom properties no arquivo src/styles.css.
- Paleta técnica inicial do tema claro:
  - primary: #1558A6
  - primary-strong: #0B3D78
  - primary-soft: #EAF2FC
  - accent: #F4C430
  - accent-strong: #B88700
  - background: #F5F7FA
  - surface: #FFFFFF
  - text: #172033
  - muted: #667085
  - border: #D8E0EA
- Paleta técnica inicial do tema escuro:
  - background: #0D1624
  - surface: #142033
  - surface-muted: #1A2940
  - text: #F3F6FA
  - muted: #A9B4C4
  - border: #2B3B52
  - primary: #5CA8FF
  - accent: #FFD449
- Usuários administráveis pela tela continuam sendo usuários de loja.
- Exclusão de usuário será lógica: ativo = 0 e excluido_em preenchido. O registro continua no D1 para preservar FKs de agendas e historico_status.
- Usuário excluído não aparece em GET /api/admin/users, não autentica e não pode ser reativado pelo fluxo normal.
- A senha nova é opcional na edição. Campo vazio significa não enviar senha no PATCH.
- A exclusão usa DELETE /api/admin/users/:id e responde 204 em sucesso.
- A preferência visual usa localStorage com chave theme e valores light ou dark.
- A aplicação coloca data-theme no elemento html.

## Estratégia de branch e CI

- Criar a branch feat/melhorias-ui-dashboard-usuarios-dark a partir da main.
- Cada task deve produzir um único commit remoto contendo todos os arquivos daquela task.
- Usar commit atômico por task para que o PR dispare somente um CI por checkpoint.
- Abrir um PR para main após o primeiro checkpoint implementado e atualizar o mesmo PR nas tasks seguintes.
- O CI oficial em .github/workflows/ci.yml executa npm ci, npm test, npm run typecheck e npm run build.
- Se o CI falhar, diagnosticar a falha e só executar novamente depois de uma mudança relevante.

## Review Focus

1. **Fluxo de importação sem duplicação:** o item sai da sidebar, /admin/import continua funcionando e o Dashboard vira o único ponto de entrada visual administrativo.
2. **Contraste dos dois temas:** texto, superfície, foco, aviso, erro, disabled e status devem usar tokens, não cores fixas adequadas só ao tema claro.
3. **Senha opcional na edição:** editar nome/login/loja/status sem nova senha deve preservar o hash existente.
4. **Exclusão segura com auditoria:** usuário excluído some da listagem e perde acesso, mas o registro continua para não quebrar agendas ou historico_status.
5. **Proteção administrativa:** IDs de administrador não podem ser excluídos pelo endpoint de usuários de loja.

## Mapa de arquivos

### Task 1
- Modify: src/admin/AdminLayout.tsx
- Modify: src/admin/DashboardPage.tsx
- Modify: src/styles.css
- Keep route: src/App.tsx
- Create: tests/ui/admin-navigation.test.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

### Task 2
- Modify: src/styles.css
- Create: tests/ui/design-system.test.ts
- Review: src/auth/LoginPage.tsx
- Review: src/admin/DashboardPage.tsx
- Review: src/admin/ImportAgendaPage.tsx
- Review: src/admin/StoresPage.tsx
- Review: src/admin/UsersPage.tsx
- Review: src/admin/AdminAgendaHistoryPage.tsx
- Review: src/agenda/TodayPage.tsx
- Review: src/agenda/HistoryPage.tsx
- Review: src/agenda/AgendaList.tsx
- Review: src/agenda/AgendaDetails.tsx
- Review: src/agenda/StatusControl.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

### Task 3
- Create: migrations/0002_user_soft_delete.sql
- Modify: worker/repositories/users.ts
- Modify: worker/routes/admin-users.ts
- Modify: src/admin/UsersPage.tsx
- Create: src/admin/UserEditDialog.tsx
- Modify: tests/worker/admin.test.ts
- Create: tests/ui/admin-users.test.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

### Task 4
- Create: src/theme/theme.ts
- Create: src/theme/ThemeProvider.tsx
- Create: src/theme/ThemeToggle.tsx
- Modify: src/App.tsx
- Modify: src/auth/LoginPage.tsx
- Modify: src/admin/AdminLayout.tsx
- Modify: src/styles.css
- Modify: index.html
- Create: tests/ui/theme.test.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

---

# Task 0 — Corrigir importação incompleta do PDF

**Deliverable:** o parser estruturado mantém cada linha visual no agendamento correto mesmo quando data, fornecedor ou parte do tipo aparecem acima do protocolo centralizado.

**Files**
- Create: tests/fixtures/agenda-sintetica-alinhamento-vertical.txt
- Modify: tests/ui/parser.test.ts
- Modify: src/import/parseAgendaText.ts
- Update checklist após validação: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

**Root cause:** o extrator ordena texto por coordenada vertical. Em células com protocolo centralizado, a primeira linha da data/fornecedor/tipo pode aparecer antes da linha que contém o protocolo. parseStructuredText tratava essas linhas como continuação do registro anterior.

- [x] **Step 1: reproduzir com fixture sintética de 24 registros**
- [x] **Step 2: confirmar RED: parser atual não entrega 24 registros**
- [x] **Step 3: manter linhas iniciadas por data em buffer até surgir o protocolo**
- [x] **Step 4: manter prefixo sem protocolo como registro inválido, sem silenciar erro**
- [x] **Step 5: rodar parser.test.ts e import.test.tsx**
- [x] **Step 6: revisar o diff e executar o CI uma única vez**
- [x] **Step 7: marcar Task 0 como [x] somente após CI verde**

---

# Task 1 — Mover “Importar agenda” para o Dashboard

**Deliverable:** Dashboard, Histórico, Lojas e Usuários ficam na navegação; “Importar agenda” aparece no cabeçalho do Dashboard e abre o fluxo atual.

**Interfaces**
- Consumes: rota existente /admin/import.
- Produces: link contextual para /admin/import.
- Não altera: ImportAgendaPage, parser ou API de importação.

- [ ] **Step 1: criar o teste de navegação**

Criar tests/ui/admin-navigation.test.tsx:

~~~tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminLayout } from "../../src/admin/AdminLayout";
import { DashboardPage } from "../../src/admin/DashboardPage";

vi.mock("../../src/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      id: "admin-test",
      nome: "Administrador",
      perfil: "admin",
      lojaId: null,
    },
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin navigation", () => {
  it("remove Importar da navegação administrativa", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<span>Conteúdo</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: "Importar" }),
    ).not.toBeInTheDocument();
  });

  it("mostra Importar agenda no Dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Importar agenda" });
    expect(link).toHaveAttribute("href", "/admin/import");
  });
});
~~~

- [ ] **Step 2: remover a entrada da navegação**

Em src/admin/AdminLayout.tsx, NAV_ITEMS passa a ser:

~~~ts
const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/history", label: "Histórico" },
  { to: "/admin/stores", label: "Lojas" },
  { to: "/admin/users", label: "Usuários" },
];
~~~

Não remover a Route path="import" de src/App.tsx.

- [ ] **Step 3: adicionar a ação ao Dashboard**

Em src/admin/DashboardPage.tsx importar Link de react-router-dom e usar:

~~~tsx
<header className="page-heading page-heading-actions">
  <div>
    <span className="eyebrow">Administração</span>
    <h1>Dashboard</h1>
    <p>Acompanhe a situação das agendas de hoje por loja.</p>
  </div>

  <Link className="primary-button dashboard-import-action" to="/admin/import">
    Importar agenda
  </Link>
</header>
~~~

- [ ] **Step 4: ajustar o layout responsivo**

Adicionar em src/styles.css:

~~~css
.page-heading-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.dashboard-import-action {
  flex: 0 0 auto;
  text-decoration: none;
}

@media (max-width: 720px) {
  .page-heading-actions {
    flex-direction: column;
  }

  .dashboard-import-action {
    width: 100%;
    justify-content: center;
  }
}
~~~

- [ ] **Step 5: validar a task**

Executar:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/admin-navigation.test.tsx tests/ui/import.test.tsx
~~~

Revisar o diff e confirmar que src/App.tsx ainda contém /admin/import e que ImportAgendaPage não foi duplicada.

- [ ] **Step 6: checkpoint e CI**

Criar um único commit:

~~~text
feat: move agenda import action to dashboard
~~~

Marcar todos os itens e critérios da Task 1 como [x] na spec somente após validação.

Executar o CI uma única vez.

---

# Task 2 — Redesign azul + amarelo

**Deliverable:** todas as telas usam uma base visual azul + amarelo mais fina e corporativa, sem alterar fluxos.

**Interfaces**
- Consumes: classes CSS atuais.
- Produces: tokens semânticos reaproveitados pela Task 4.
- Não altera: API, rotas ou D1.

- [ ] **Step 1: criar o teste dos tokens**

Criar tests/ui/design-system.test.ts:

~~~ts
import { describe, expect, it } from "vitest";
import css from "../../src/styles.css?raw";

describe("design system", () => {
  it("define os tokens de identidade", () => {
    expect(css).toContain("--color-primary:");
    expect(css).toContain("--color-primary-strong:");
    expect(css).toContain("--color-primary-soft:");
    expect(css).toContain("--color-accent:");
    expect(css).toContain("--color-background:");
    expect(css).toContain("--color-surface:");
    expect(css).toContain("--color-text:");
    expect(css).toContain("--color-text-muted:");
    expect(css).toContain("--color-border:");
  });

  it("remove o verde principal legado", () => {
    expect(css.toLowerCase()).not.toContain("#1f6848");
  });
});
~~~

- [ ] **Step 2: criar os tokens light**

No início de src/styles.css:

~~~css
:root {
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  --color-primary: #1558a6;
  --color-primary-strong: #0b3d78;
  --color-primary-soft: #eaf2fc;
  --color-accent: #f4c430;
  --color-accent-strong: #b88700;
  --color-background: #f5f7fa;
  --color-surface: #ffffff;
  --color-surface-muted: #eef3f8;
  --color-text: #172033;
  --color-text-muted: #667085;
  --color-border: #d8e0ea;
  --color-danger: #b42318;
  --color-danger-soft: #fff2f0;
  --color-success: #18794e;
  --color-success-soft: #eefbf4;
  --color-warning: #8a6100;
  --color-warning-soft: #fff8df;
  --shadow-card: 0 12px 32px rgba(15, 52, 88, 0.08);
  color: var(--color-text);
  background: var(--color-background);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
~~~

- [ ] **Step 3: migrar os seletores para tokens**

Em src/styles.css substituir cores estruturais fixas por:
- background -> var(--color-background)
- superfícies -> var(--color-surface)
- superfícies secundárias -> var(--color-surface-muted)
- texto principal -> var(--color-text)
- texto secundário -> var(--color-text-muted)
- bordas -> var(--color-border)
- ações/foco -> var(--color-primary)
- destaques -> var(--color-accent)
- estados de erro/sucesso/aviso -> respectivos tokens semânticos

Aplicar isso a login, sidebar, mobile nav, page headings, cards, botões, inputs, selects, tabelas, status-pill, feedbacks, detail-panel, history-box e overlays.

- [ ] **Step 4: refinar peso visual**

No mesmo arquivo:
- remover sombras muito pesadas em favor de var(--shadow-card);
- usar bordas de 1px e raios consistentes;
- manter foco visível com outline/box-shadow azul;
- não usar amarelo em grandes superfícies;
- preservar table-scroll e espaçamento em mobile.

- [ ] **Step 5: validar a task**

Executar:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/design-system.test.ts tests/ui/login.test.tsx tests/ui/agenda.test.tsx tests/ui/import.test.tsx tests/ui/admin-history.test.tsx
~~~

Revisar visualmente /login, /admin, /admin/history, /admin/import, /admin/stores, /admin/users, /app e /app/history.

- [ ] **Step 6: checkpoint e CI**

Criar um único commit:

~~~text
style: apply blue and yellow visual system
~~~

Marcar a Task 2 como [x] na spec somente após validação e executar o CI uma única vez.

---

# Task 3 — Gerenciamento completo de usuários

**Deliverable:** administrador edita nome, login, loja, status e senha de usuários de loja e pode excluí-los de forma lógica, preservando auditoria.

**Interfaces**
- GET /api/admin/users -> apenas usuários de loja não excluídos.
- POST /api/admin/users -> cria usuário de loja.
- PATCH /api/admin/users -> edita nome, login, senha, lojaId e ativo.
- DELETE /api/admin/users/:id -> marca usuário de loja como excluído e retorna 204.
- UserEditDialog recebe user, stores, onClose, onSaved e onDeleted.

- [ ] **Step 1: adicionar a migration de exclusão lógica**

Criar migrations/0002_user_soft_delete.sql:

~~~sql
ALTER TABLE usuarios ADD COLUMN excluido_em TEXT;

CREATE INDEX idx_usuarios_perfil_excluido
  ON usuarios(perfil, excluido_em);
~~~

A migration é aditiva: nenhum registro existente é removido ou modificado.

- [ ] **Step 2: ajustar o repositório de usuários**

Em worker/repositories/users.ts:
- adicionar excluido_em: string | null em UserRecord;
- incluir excluido_em em USER_COLUMNS;
- findUserByLogin deve usar AND excluido_em IS NULL;
- findUserById deve usar AND excluido_em IS NULL;
- listStoreUsers deve usar perfil = 'loja' AND excluido_em IS NULL;
- updateStoreUser deve incluir AND excluido_em IS NULL no UPDATE;
- criar softDeleteStoreUser.

Código da nova função:

~~~ts
export async function softDeleteStoreUser(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      "UPDATE usuarios SET ativo = 0, excluido_em = ?, atualizado_em = ? " +
        "WHERE id = ? AND perfil = 'loja' AND excluido_em IS NULL",
    )
    .bind(now, now, id)
    .run();

  return result.meta.changes > 0;
}
~~~

- [ ] **Step 3: criar a rota DELETE**

Em worker/routes/admin-users.ts:
- importar z de zod;
- importar softDeleteStoreUser;
- adicionar a rota abaixo do PATCH:

~~~ts
adminUserRoutes.delete("/:id", async (c) => {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Usuário inválido." },
      400,
    );
  }

  const current = await findUserById(c.env.DB, parsedId.data);
  if (!current || current.perfil !== "loja") {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  const deleted = await softDeleteStoreUser(c.env.DB, current.id);
  if (!deleted) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  return c.body(null, 204);
});
~~~

O middleware já aplicado em worker/app.ts mantém GET/PATCH/DELETE restritos a admin.

- [ ] **Step 4: ampliar os testes de backend antes da UI**

Em tests/worker/admin.test.ts, ampliar jsonRequest para aceitar DELETE e body opcional:

~~~ts
function jsonRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  cookie: string,
  body?: unknown,
) {
  return exports.default.fetch(
    new Request("https://example.com" + url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Cookie: cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
~~~

Adicionar um helper para criar loja e usuário via API:

~~~ts
async function createManagedUser(
  cookie: string,
  suffix: string,
  senha = password,
) {
  const storeResponse = await jsonRequest(
    "/api/admin/stores",
    "POST",
    cookie,
    {
      codigo: "U" + suffix,
      nome: "Loja " + suffix,
    },
  );
  const store = (await storeResponse.json()) as { id: string };

  const userResponse = await jsonRequest(
    "/api/admin/users",
    "POST",
    cookie,
    {
      nome: "Usuário " + suffix,
      login: "usuario-" + suffix,
      senha,
      lojaId: store.id,
    },
  );
  const user = (await userResponse.json()) as {
    id: string;
    login: string;
    lojaId: string;
  };

  return { store, user };
}
~~~

Adicionar estes testes completos:

~~~ts
it("admin edita login e senha do usuário", async () => {
  const cookie = await adminCookie("admin-edit-user", "admin-edit-user");
  const { user } = await createManagedUser(cookie, "edit");

  const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
    id: user.id,
    nome: "Usuário Editado",
    login: "usuario-editado",
    senha: "nova-senha-segura-123",
    lojaId: user.lojaId,
    ativo: true,
  });

  expect(update.status).toBe(200);
  const body = (await update.json()) as Record<string, unknown>;
  expect(body).toMatchObject({
    nome: "Usuário Editado",
    login: "usuario-editado",
    ativo: true,
  });
  expect(body).not.toHaveProperty("senha_hash");

  expect((await login("usuario-edit")).status).toBe(401);
  expect(
    (await login("usuario-editado", "nova-senha-segura-123")).status,
  ).toBe(200);
});

it("editar sem senha preserva a senha atual", async () => {
  const cookie = await adminCookie(
    "admin-edit-no-password",
    "admin-edit-no-password",
  );
  const { user } = await createManagedUser(cookie, "keep-password");

  const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
    id: user.id,
    nome: "Nome Atualizado",
  });

  expect(update.status).toBe(200);
  expect((await login("usuario-keep-password")).status).toBe(200);
});

it("login duplicado na edição retorna 409", async () => {
  const cookie = await adminCookie("admin-edit-dup", "admin-edit-dup");
  const first = await createManagedUser(cookie, "dup-a");
  const second = await createManagedUser(cookie, "dup-b");

  const update = await jsonRequest("/api/admin/users", "PATCH", cookie, {
    id: second.user.id,
    login: first.user.login,
  });

  expect(update.status).toBe(409);
  expect(await update.json()).toMatchObject({ error: "LOGIN_EM_USO" });
});

it("exclusão lógica remove da lista e impede login", async () => {
  const cookie = await adminCookie("admin-delete-user", "admin-delete-user");
  const { user } = await createManagedUser(cookie, "delete");

  const deleted = await jsonRequest(
    "/api/admin/users/" + user.id,
    "DELETE",
    cookie,
  );
  expect(deleted.status).toBe(204);

  const list = await exports.default.fetch(
    new Request("https://example.com/api/admin/users", {
      headers: { Cookie: cookie },
    }),
  );
  const users = (await list.json()) as Array<{ id: string }>;
  expect(users.some((item) => item.id === user.id)).toBe(false);
  expect((await login(user.login)).status).toBe(401);

  const stored = await db
    .prepare(
      "SELECT ativo, excluido_em FROM usuarios WHERE id = ? LIMIT 1",
    )
    .bind(user.id)
    .first<{ ativo: number; excluido_em: string | null }>();

  expect(stored?.ativo).toBe(0);
  expect(stored?.excluido_em).toBeTruthy();
});

it("DELETE de administrador é rejeitado", async () => {
  const adminId = crypto.randomUUID();
  await seedAdmin(adminId, "admin-protected");
  const cookie = cookiePair(await login("admin-protected"));

  const response = await jsonRequest(
    "/api/admin/users/" + adminId,
    "DELETE",
    cookie,
  );

  expect(response.status).toBe(404);
  expect((await login("admin-protected")).status).toBe(200);
});
~~~

- [ ] **Step 5: criar UserEditDialog com edição e confirmação**

Criar src/admin/UserEditDialog.tsx com:

~~~ts
type UserEditDialogProps = {
  user: AdminUser;
  stores: AdminStore[];
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
  onDeleted: (userId: string) => void;
};
~~~

O payload de edição deve omitir senha vazia:

~~~ts
const payload = {
  id: user.id,
  nome: nome.trim(),
  login: login.trim(),
  lojaId,
  ativo,
  ...(senha ? { senha } : {}),
};

const updated = await apiFetch<AdminUser>("/api/admin/users", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

onSaved(updated);
~~~

A exclusão deve ter dois estados explícitos:
- estado normal com botão className="danger-button" e texto “Excluir usuário”;
- após o primeiro clique, mostrar “Excluir {user.nome}?” com botões “Cancelar” e “Confirmar exclusão”.

A chamada final:

~~~ts
await apiFetch<void>("/api/admin/users/" + user.id, {
  method: "DELETE",
});
onDeleted(user.id);
~~~

O formulário contém labels exatos Nome, Login, Loja, Status e Nova senha (opcional). Nova senha usa type="password", minLength={8} e autoComplete="new-password".

- [ ] **Step 6: testar o diálogo de usuário**

Criar tests/ui/admin-users.test.tsx usando mock de apiFetch:

~~~tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../src/lib/api";
import { UserEditDialog } from "../../src/admin/UserEditDialog";

vi.mock("../../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/api")>(
    "../../src/lib/api",
  );
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Conferente",
  login: "conferente",
  perfil: "loja" as const,
  lojaId: "22222222-2222-4222-8222-222222222222",
  ativo: true,
};

const stores = [
  {
    id: user.lojaId,
    codigo: "F03",
    nome: "Canasvieiras",
    ativo: true,
  },
];

afterEach(() => {
  cleanup();
  mockedApiFetch.mockReset();
});

describe("UserEditDialog", () => {
  it("omite senha vazia no PATCH", async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ...user,
      nome: "Conferente Atualizado",
    });

    render(
      <UserEditDialog
        user={user}
        stores={stores}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Conferente Atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(1));
    const init = mockedApiFetch.mock.calls[0][1];
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("senha");
  });

  it("envia nova senha quando preenchida", async () => {
    mockedApiFetch.mockResolvedValueOnce(user);

    render(
      <UserEditDialog
        user={user}
        stores={stores}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nova senha (opcional)"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(1));
    const init = mockedApiFetch.mock.calls[0][1];
    const body = JSON.parse(String(init?.body));
    expect(body.senha).toBe("nova-senha-segura");
  });

  it("só exclui após confirmação explícita", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();

    render(
      <UserEditDialog
        user={user}
        stores={stores}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir Conferente?")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/admin/users/" + user.id,
        { method: "DELETE" },
      ),
    );
    expect(onDeleted).toHaveBeenCalledWith(user.id);
  });
});
~~~

- [ ] **Step 7: integrar o diálogo na UsersPage**

Em src/admin/UsersPage.tsx:
- adicionar selectedUser: AdminUser | null;
- trocar o botão Ativar/Desativar da tabela por Editar;
- abrir UserEditDialog com o usuário selecionado;
- em onSaved, substituir o item pelo id e fechar o diálogo;
- em onDeleted, remover o item pelo id e fechar o diálogo;
- manter o cadastro de usuário existente;
- manter o status visível na tabela.

Atualização local exata:

~~~ts
function userSaved(updated: AdminUser) {
  setUsers((current) =>
    current.map((item) => (item.id === updated.id ? updated : item)),
  );
  setSelectedUser(null);
}

function userDeleted(userId: string) {
  setUsers((current) => current.filter((item) => item.id !== userId));
  setSelectedUser(null);
}
~~~

- [ ] **Step 8: validar a task**

Executar:

~~~bash
npx vitest run tests/worker/admin.test.ts
npx vitest run --config vitest.ui.config.ts tests/ui/admin-users.test.tsx
~~~

Confirmar no diff:
- senha vazia não vai no PATCH;
- senha nova só é hashada no Worker;
- login duplicado retorna 409;
- DELETE não remove fisicamente o registro;
- usuário excluído não aparece e não autentica;
- admin não pode ser excluído;
- userJson não contém senha_hash.

- [ ] **Step 9: checkpoint e CI**

Criar um único commit:

~~~text
feat: complete admin user management
~~~

Marcar a Task 3 como [x] na spec somente após validação e executar o CI uma única vez.

---

# Task 4 — Modo dark

**Deliverable:** tema light/dark alternável sem reload, persistente e aplicado a login, admin e loja.

**Interfaces**
- Theme = "light" | "dark"
- storage key = theme
- html[data-theme="light"] e html[data-theme="dark"]
- ThemeProvider fornece theme e toggleTheme.
- ThemeToggle expõe um botão acessível.

- [ ] **Step 1: criar o teste de tema**

Criar tests/ui/theme.test.tsx:

~~~tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { ThemeToggle } from "../../src/theme/ThemeToggle";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("alterna para dark sem recarregar e persiste", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ativar modo escuro" }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("restaura dark salvo", () => {
    localStorage.setItem("theme", "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Ativar modo claro" }),
    ).toBeInTheDocument();
  });
});
~~~

- [ ] **Step 2: criar os utilitários de tema**

Criar src/theme/theme.ts:

~~~ts
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
~~~

- [ ] **Step 3: criar ThemeProvider**

Criar src/theme/ThemeProvider.tsx:

~~~tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Tema continua funcionando mesmo sem persistência.
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () =>
        setTheme((current) => (current === "light" ? "dark" : "light")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  }
  return value;
}
~~~

- [ ] **Step 4: criar ThemeToggle**

Criar src/theme/ThemeToggle.tsx:

~~~tsx
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      className="theme-toggle ghost-button"
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {dark ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
~~~

- [ ] **Step 5: ligar o provider e os controles**

Em src/App.tsx envolver AuthProvider:

~~~tsx
<BrowserRouter>
  <ThemeProvider>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </ThemeProvider>
</BrowserRouter>
~~~

Adicionar ThemeToggle:
- no rodapé do AdminLayout;
- no rodapé do StoreLayout;
- na LoginPage fora do form.

Em mobile, posicionar o mesmo controle por CSS; não renderizar duas cópias do toggle no mesmo layout.

- [ ] **Step 6: evitar flash do tema errado**

Em index.html, dentro de head e antes do módulo principal:

~~~html
<script>
  (() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
        document.documentElement.style.colorScheme = saved;
      }
    } catch {}
  })();
</script>
~~~

Sem valor válido, o CSS light continua sendo o default.

- [ ] **Step 7: adicionar os tokens dark**

Em src/styles.css:

~~~css
html[data-theme="dark"] {
  --color-background: #0d1624;
  --color-surface: #142033;
  --color-surface-muted: #1a2940;
  --color-text: #f3f6fa;
  --color-text-muted: #a9b4c4;
  --color-border: #2b3b52;
  --color-primary: #5ca8ff;
  --color-primary-strong: #8bc1ff;
  --color-primary-soft: #1c3554;
  --color-accent: #ffd449;
  --color-accent-strong: #e3b51b;
  --color-danger: #ff8a80;
  --color-danger-soft: #351b1f;
  --color-success: #70d7a4;
  --color-success-soft: #153127;
  --color-warning: #ffd86b;
  --color-warning-soft: #342d17;
  --shadow-card: 0 14px 36px rgba(0, 0, 0, 0.22);
}
~~~

Revisar os seletores para remover white, #fff, #ffffff, black e cores legadas onde representem superfície/texto estrutural. Exceções aceitáveis: cores intencionais de conteúdo que permaneçam legíveis nos dois temas.

- [ ] **Step 8: validar todas as telas**

Executar:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/theme.test.tsx tests/ui/login.test.tsx tests/ui/agenda.test.tsx tests/ui/import.test.tsx tests/ui/admin-history.test.tsx tests/ui/admin-users.test.tsx
~~~

Fazer smoke nos dois temas em:
- /login
- /admin
- /admin/history
- /admin/import
- /admin/stores
- /admin/users
- /app
- /app/history

Validar sidebar, cards, tabelas, forms, modal de usuário, dropdowns, badges, hover, foco e disabled.

- [ ] **Step 9: checkpoint e CI**

Criar um único commit:

~~~text
feat: add persistent light and dark themes
~~~

Marcar a Task 4 e a definição de pronto na spec apenas para itens com evidência. Executar o CI uma única vez.

---

# Fechamento

- [ ] As quatro tasks estão [x] na spec.
- [ ] O último CI está verde.
- [ ] O diff completo da branch contra main foi revisado.
- [ ] A única migration é aditiva e preserva dados.
- [ ] Login admin e loja continuam funcionando.
- [ ] Importação continua usando o fluxo existente.
- [ ] Usuários excluídos não aparecem e não autenticam, com auditoria preservada.
- [ ] Light/dark estão consistentes em desktop e mobile.
- [ ] A documentação final reflete o comportamento entregue.

## Critério para merge

O PR só pode ir para main quando todos os itens de fechamento acima tiverem evidência e a spec estiver atualizada.
