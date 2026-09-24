# Melhorias de UI, Dashboard, Usuários e Dark Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Modernizar o Agenda Prado, mover a importação para o Dashboard, aplicar a identidade azul + amarelo, completar o gerenciamento de usuários de loja e adicionar tema claro/escuro persistente.

**Architecture:** O trabalho mantém a arquitetura atual React + TypeScript + Vite no frontend e Hono + Cloudflare D1 no Worker. As quatro tasks serão executadas em sequência, cada uma fechando um conjunto independente e testável. O redesign passa a usar tokens CSS semânticos para que o dark mode posterior seja uma extensão da mesma base visual, e o gerenciamento de usuários reutiliza o PATCH existente para edição/senha/status, adicionando somente DELETE para exclusão.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, React Router 7, Vitest 4, Testing Library, Hono 4, Zod 4, Cloudflare Workers e Cloudflare D1.

**Spec:** docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

## Global Constraints

- Executar uma task por vez.
- Fazer todas as alterações necessárias da task antes da validação final.
- Usar TDD para comportamentos novos ou alterados quando aplicável.
- Evitar refatorações sem relação com a task atual.
- Não alterar funcionalidades existentes sem necessidade.
- Não alterar nem apagar dados existentes do D1 sem necessidade.
- Após concluir cada task: revisar o diff, executar o CI uma única vez, corrigir apenas o necessário se falhar e marcar a task como [x] somente após validação.
- Após três falhas na mesma task, mudar de estratégia ou registrar o bloqueio.
- O fluxo de login deve continuar funcional.
- O fluxo de importação deve continuar funcional.
- Desktop e mobile devem permanecer funcionais.
- A autorização administrativa continua sendo aplicada no backend por requireAuth + requireAdmin.
- Senha e senha_hash nunca podem ser retornados ao frontend.
- A implementação não precisa de nova migration D1 para este escopo.

## Decisões de implementação

Estas decisões tornam a spec executável sem alterar seu escopo funcional:

- A rota /admin/import permanece existente; apenas sai da navegação e passa a ser acessada pelo Dashboard.
- A nova base visual será centralizada em CSS custom properties no arquivo src/styles.css.
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
- Usuários administráveis pela tela continuam sendo usuários de loja. A API de exclusão rejeita IDs de administrador, então o administrador logado não pode ser removido por esse fluxo.
- A senha nova é opcional na edição. Campo vazio significa não enviar senha no PATCH.
- A exclusão usa DELETE /api/admin/users/:id e responde 204 em sucesso.
- A preferência visual usa localStorage com chave theme e valores light ou dark.
- A aplicação coloca data-theme no elemento html para controlar o tema.

## Estratégia de branch e CI

- Criar a branch feat/melhorias-ui-dashboard-usuarios-dark a partir da main atual.
- Cada task deve resultar em um único commit remoto contendo todas as alterações daquela task.
- Para evitar múltiplas execuções desnecessárias do CI, agrupar os arquivos da task em um commit atômico antes de atualizar a branch remota.
- Abrir um PR para main após o primeiro checkpoint implementado.
- Cada checkpoint seguinte deve atualizar o mesmo PR com um único commit de task.
- O CI oficial é o workflow .github/workflows/ci.yml, que executa:
  - npm ci
  - npm test
  - npm run typecheck
  - npm run build
- Não disparar novamente o mesmo CI sem uma alteração relevante quando houver falha.

## Review Focus

1. **Fluxo de importação sem duplicação:** o item sai da sidebar, mas /admin/import continua funcionando e o Dashboard passa a ser o único ponto de entrada visual administrativo.
2. **Contraste dos dois temas:** texto, superfície, foco, aviso, erro, disabled e status não podem depender de uma cor fixa adequada somente ao tema claro.
3. **Senha opcional na edição:** editar nome/login/loja/status sem preencher nova senha deve preservar o hash atual.
4. **Exclusão segura:** um usuário de loja só é removido após confirmação; IDs inexistentes ou de administrador não podem ser excluídos pela rota.
5. **Sessão após desativação/exclusão:** usuário desativado ou excluído deve falhar em um novo login e não pode reaparecer na listagem administrativa.

## Mapa de arquivos

### Task 1
- Modify: src/admin/AdminLayout.tsx
- Modify: src/admin/DashboardPage.tsx
- Keep route: src/App.tsx
- Create: tests/ui/admin-navigation.test.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

### Task 2
- Modify: src/styles.css
- Create: tests/ui/design-system.test.ts
- Review existing screens:
  - src/auth/LoginPage.tsx
  - src/admin/DashboardPage.tsx
  - src/admin/ImportAgendaPage.tsx
  - src/admin/StoresPage.tsx
  - src/admin/UsersPage.tsx
  - src/admin/AdminAgendaHistoryPage.tsx
  - src/agenda/TodayPage.tsx
  - src/agenda/HistoryPage.tsx
  - src/agenda/AgendaList.tsx
  - src/agenda/AgendaDetails.tsx
  - src/agenda/StatusControl.tsx
- Update checklist: docs/superpowers/specs/2026-09-24-melhorias-ui-dashboard-usuarios-dark-design.md

### Task 3
- Modify: shared/api.ts
- Modify: worker/repositories/users.ts
- Modify: worker/routes/admin-users.ts
- Modify: src/admin/UsersPage.tsx
- Create: src/admin/UserEditDialog.tsx
- Modify: src/admin/types.ts somente se a UI precisar de campo adicional já retornado pela API
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

# Task 1 — Mover “Importar agenda” para o Dashboard

**Deliverable:** a navegação administrativa fica com Dashboard, Histórico, Lojas e Usuários; o Dashboard exibe “Importar agenda” e leva para o fluxo atual.

**Interfaces**
- Consumes: rota existente /admin/import.
- Produces: link contextual para /admin/import no cabeçalho do Dashboard.
- Não altera: ImportAgendaPage e API de importação.

- [ ] **Step 1: escrever o teste de navegação antes da implementação**

Criar tests/ui/admin-navigation.test.tsx cobrindo:
- sidebar administrativa não mostra link Importar;
- Dashboard mostra link Importar agenda;
- destino do link é /admin/import.

Estrutura mínima esperada:

~~~tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/admin/DashboardPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin navigation", () => {
  it("mostra Importar agenda no Dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })));

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

Adicionar no mesmo arquivo o teste do AdminLayout usando mock de useAuth para confirmar que nenhum link com nome Importar aparece na navegação.

- [ ] **Step 2: implementar a navegação enxuta**

Em src/admin/AdminLayout.tsx remover somente:

~~~ts
{ to: "/admin/import", label: "Importar" }
~~~

Manter as rotas Dashboard, Histórico, Lojas e Usuários nas versões desktop e mobile porque ambas usam NAV_ITEMS.

- [ ] **Step 3: adicionar a ação contextual ao Dashboard**

Em src/admin/DashboardPage.tsx:
- importar Link de react-router-dom;
- manter título e descrição existentes;
- adicionar Link para /admin/import com classes primary-button e dashboard-import-action;
- texto visível: “Importar agenda”.

Estrutura:

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

- [ ] **Step 4: ajustar responsividade sem mexer no fluxo de importação**

Em src/styles.css:
- page-heading-actions usa flex no desktop;
- dashboard-import-action não deve ocupar espaço excessivo;
- no breakpoint mobile, a ação fica abaixo do bloco de título e alinhada ao início ou com largura confortável;
- não duplicar formulário, parser ou chamadas da ImportAgendaPage no Dashboard.

- [ ] **Step 5: verificar a task antes do checkpoint**

Executar verificação focada:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/admin-navigation.test.tsx tests/ui/import.test.tsx
~~~

Revisar o diff e confirmar:
- nenhum link Importar na sidebar/mobile-nav;
- rota /admin/import ainda existe em src/App.tsx;
- ImportAgendaPage não foi duplicada.

- [ ] **Step 6: checkpoint e CI**

Criar um único commit da Task 1:

~~~text
feat: move agenda import action to dashboard
~~~

Atualizar a spec:
- marcar todos os itens de Task 1 como [x];
- marcar “Task 1 — Mover Importar agenda” como [x].

Executar o CI uma única vez para este checkpoint. Só marcar concluída após npm test, typecheck e build passarem.

---

# Task 2 — Redesign azul + amarelo

**Deliverable:** todas as telas usam uma base visual azul + amarelo mais fina e corporativa, sem alterar fluxos funcionais.

**Interfaces**
- Consumes: classes CSS já usadas pelas telas.
- Produces: tokens CSS semânticos que a Task 4 reutilizará para o dark mode.
- Não altera: contratos de API, rotas ou banco.

- [ ] **Step 1: criar um teste simples para os tokens obrigatórios**

Criar tests/ui/design-system.test.ts:

~~~ts
import { describe, expect, it } from "vitest";
import css from "../../src/styles.css?raw";

describe("design system", () => {
  it("define a identidade azul e amarela por tokens semânticos", () => {
    expect(css).toContain("--color-primary:");
    expect(css).toContain("--color-accent:");
    expect(css).toContain("--color-background:");
    expect(css).toContain("--color-surface:");
    expect(css).toContain("--color-text:");
    expect(css).toContain("--color-border:");
  });

  it("remove o verde principal legado", () => {
    expect(css.toLowerCase()).not.toContain("#1f6848");
  });
});
~~~

- [ ] **Step 2: transformar a paleta em tokens do tema claro**

No início de src/styles.css substituir cores estruturais por variáveis:

~~~css
:root {
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
}
~~~

- [ ] **Step 3: migrar os componentes existentes para os tokens**

Em src/styles.css revisar todas as regras usadas por:
- login;
- sidebar e navegação;
- cabeçalhos;
- dashboard/store cards;
- botões;
- inputs/selects;
- tabelas;
- painéis de detalhe;
- badges/status;
- feedbacks de erro/sucesso/aviso;
- modais e overlays existentes;
- mobile navigation.

Substituir cores legadas fixas por var(--color-*). O amarelo deve aparecer como destaque, não como fundo dominante de grandes áreas.

- [ ] **Step 4: refinar peso visual e responsividade**

Ainda em src/styles.css:
- reduzir sombras pesadas;
- padronizar bordas e raios;
- garantir foco visível com azul;
- manter áreas clicáveis confortáveis;
- preservar table-scroll em telas estreitas;
- garantir que page-heading-actions da Task 1 responda bem em mobile.

- [ ] **Step 5: verificar a task**

Executar:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/design-system.test.ts tests/ui/login.test.tsx tests/ui/agenda.test.tsx tests/ui/import.test.tsx tests/ui/admin-history.test.tsx
~~~

Revisar visualmente as telas:
- /login
- /admin
- /admin/history
- /admin/import
- /admin/stores
- /admin/users
- /app
- /app/history

- [ ] **Step 6: checkpoint e CI**

Criar um único commit da Task 2:

~~~text
style: apply blue and yellow visual system
~~~

Atualizar a spec e marcar a Task 2 como [x] somente após validação.

Executar o CI uma única vez para este checkpoint.

---

# Task 3 — Gerenciamento completo de usuários

**Deliverable:** administrador pode editar nome, login, loja, status e senha de usuários de loja, além de excluí-los com confirmação.

**Interfaces**
- GET /api/admin/users -> AdminUser[]
- POST /api/admin/users -> cria usuário de loja
- PATCH /api/admin/users -> edita nome, login, senha, lojaId e ativo
- DELETE /api/admin/users/:id -> remove somente usuário de loja e retorna 204
- UserEditDialog recebe user, stores, onSaved e onDeleted.

- [ ] **Step 1: escrever primeiro os testes de backend que faltam**

Expandir tests/worker/admin.test.ts com casos:

~~~ts
it("admin edita nome, login, loja e senha do usuário", async () => {
  // criar duas lojas e um usuário
  // PATCH com nome, login, lojaId e senha
  // esperar 200 e resposta sem senha_hash
  // login antigo deve falhar e login novo com nova senha deve funcionar
});

it("editar sem senha preserva a senha atual", async () => {
  // PATCH somente nome
  // login com a senha anterior continua 200
});

it("login duplicado na edição retorna 409", async () => {
  // criar dois usuários
  // tentar aplicar ao segundo o login do primeiro
  // esperar LOGIN_EM_USO
});

it("admin exclui usuário de loja", async () => {
  // DELETE /api/admin/users/:id
  // esperar 204
  // novo login do usuário retorna 401
});

it("rota de exclusão não remove administrador", async () => {
  // DELETE usando id de admin
  // esperar 404
  // login do administrador continua funcionando
});
~~~

- [ ] **Step 2: completar contrato e repositório**

Em shared/api.ts:
- manter UpdateStoreUserInput como contrato único para nome, login, senha, lojaId e ativo;
- não criar endpoint separado para senha;
- manter senha opcional com minLength 8.

Em worker/repositories/users.ts adicionar:

~~~ts
export async function deleteStoreUser(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM usuarios WHERE id = ? AND perfil = 'loja'")
    .bind(id)
    .run();

  return result.meta.changes > 0;
}
~~~

Não alterar updateStoreUser para escrever senha em texto puro. O hash continua sendo calculado por hashPassword no Worker.

- [ ] **Step 3: adicionar exclusão na rota administrativa**

Em worker/routes/admin-users.ts adicionar DELETE /:id:
- validar que o id é UUID;
- buscar o usuário;
- aceitar somente perfil loja;
- retornar USUARIO_NAO_ENCONTRADO com 404 se inexistente ou admin;
- chamar deleteStoreUser;
- retornar 204.

O userJson continua sendo a única forma de resposta de usuário e não deve incluir senha_hash.

- [ ] **Step 4: escrever os testes de UI antes da edição da tela**

Criar tests/ui/admin-users.test.tsx cobrindo:
- botão Editar abre dados atuais;
- senha aparece vazia e opcional;
- salvar sem senha não inclui senha no PATCH;
- salvar com senha inclui senha no PATCH;
- loja e ativo podem ser alterados;
- excluir exige segunda confirmação;
- após exclusão bem-sucedida a lista é recarregada;
- ApiError com LOGIN_EM_USO exibe mensagem amigável.

Exemplo do ponto crítico:

~~~tsx
fireEvent.click(screen.getByRole("button", { name: /editar/i }));
fireEvent.change(screen.getByLabelText("Nome"), {
  target: { value: "Novo Nome" },
});
fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

await waitFor(() => {
  const patchCall = fetchMock.mock.calls.find(
    ([url, init]) => url === "/api/admin/users" && init?.method === "PATCH",
  );
  expect(patchCall).toBeTruthy();
  const body = JSON.parse(String(patchCall?.[1]?.body));
  expect(body).not.toHaveProperty("senha");
});
~~~

- [ ] **Step 5: criar UserEditDialog**

Criar src/admin/UserEditDialog.tsx com props:

~~~ts
type UserEditDialogProps = {
  user: AdminUser;
  stores: AdminStore[];
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
  onDeleted: (userId: string) => void;
};
~~~

O componente deve:
- inicializar Nome, Login, Loja e Status com os valores atuais;
- iniciar Nova senha vazia;
- enviar PATCH /api/admin/users;
- omitir senha quando vazia;
- mostrar botão destrutivo Excluir usuário;
- ao clicar Excluir, trocar para um estado de confirmação contendo o nome do usuário;
- só enviar DELETE /api/admin/users/:id após confirmar;
- exibir erro da API dentro do diálogo;
- bloquear botões durante save/delete;
- fechar e chamar callback apenas após sucesso.

- [ ] **Step 6: integrar a edição na UsersPage**

Em src/admin/UsersPage.tsx:
- manter cadastro de novo usuário existente;
- trocar ação principal da tabela para Editar;
- manter status visível na tabela;
- abrir UserEditDialog para o usuário selecionado;
- ao salvar, atualizar o item em users sem precisar perder feedback;
- ao excluir, remover o item da lista imediatamente após o 204;
- manter load para recuperação completa quando necessário;
- não exibir senha atual em nenhum ponto.

- [ ] **Step 7: verificar backend e UI**

Executar testes focados:

~~~bash
npx vitest run tests/worker/admin.test.ts
npx vitest run --config vitest.ui.config.ts tests/ui/admin-users.test.tsx
~~~

Revisar especificamente:
- PATCH sem senha preserva credencial;
- PATCH com login duplicado retorna 409, não 500;
- DELETE admin falha;
- DELETE usuário remove acesso;
- respostas não contêm senha_hash.

- [ ] **Step 8: checkpoint e CI**

Criar um único commit da Task 3:

~~~text
feat: complete admin user management
~~~

Atualizar a spec e marcar a Task 3 como [x] somente após validação.

Executar o CI uma única vez para este checkpoint.

---

# Task 4 — Modo dark

**Deliverable:** tema light/dark alternável sem reload, persistente e aplicado a login, admin e loja, mantendo azul + amarelo.

**Interfaces**
- type Theme = "light" | "dark"
- storage key: theme
- html[data-theme="light"] e html[data-theme="dark"]
- ThemeProvider expõe theme e setTheme/toggleTheme.
- ThemeToggle usa o contexto e fornece label acessível.

- [ ] **Step 1: escrever os testes de comportamento do tema**

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
});

describe("theme", () => {
  it("alterna para dark sem recarregar e persiste", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /modo escuro/i }));

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
  });
});
~~~

- [ ] **Step 2: criar utilitários do tema**

Criar src/theme/theme.ts:

~~~ts
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
~~~

- [ ] **Step 3: criar ThemeProvider e ThemeToggle**

ThemeProvider:
- estado inicial vindo de readStoredTheme;
- applyTheme no início;
- persistir theme em localStorage ao alterar;
- expor theme e toggleTheme via contexto.

ThemeToggle:
- botão compacto;
- aria-label “Ativar modo escuro” quando light;
- aria-label “Ativar modo claro” quando dark;
- texto/ícone não deve depender apenas de cor.

- [ ] **Step 4: aplicar provider e controles**

Em src/App.tsx envolver AuthProvider com ThemeProvider.

Adicionar ThemeToggle:
- em src/admin/AdminLayout.tsx no rodapé/área de usuário e também disponível no layout mobile;
- no StoreLayout dentro de src/App.tsx;
- em src/auth/LoginPage.tsx, em posição que não conflite com o formulário.

Evitar controles duplicados simultaneamente no mesmo viewport.

- [ ] **Step 5: evitar flash do tema errado**

Em index.html, antes do carregamento de /src/main.tsx, aplicar imediatamente o tema salvo:

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

O default continua sendo light quando não há preferência válida.

- [ ] **Step 6: criar overrides do dark mode**

Em src/styles.css adicionar html[data-theme="dark"] redefinindo os tokens, sem replicar folha inteira:

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
  --color-danger-soft: #351b1f;
  --color-success-soft: #153127;
  --color-warning-soft: #342d17;
  --shadow-card: 0 14px 36px rgba(0, 0, 0, 0.22);
}
~~~

Revisar todos os seletores para garantir que fundo/texto não usem branco/preto fixos incompatíveis com o dark.

- [ ] **Step 7: verificar todas as telas obrigatórias**

Executar:

~~~bash
npx vitest run --config vitest.ui.config.ts tests/ui/theme.test.tsx tests/ui/login.test.tsx tests/ui/agenda.test.tsx tests/ui/import.test.tsx tests/ui/admin-history.test.tsx tests/ui/admin-users.test.tsx
~~~

Fazer smoke visual nos dois temas:
- login;
- Dashboard;
- histórico admin;
- importação;
- lojas;
- usuários e diálogo de edição/exclusão;
- agenda de hoje da loja;
- histórico da loja;
- tabelas, dropdowns, badges, foco, hover e disabled.

- [ ] **Step 8: checkpoint e CI**

Criar um único commit da Task 4:

~~~text
feat: add persistent light and dark themes
~~~

Atualizar a spec:
- marcar todos os itens de Task 4 como [x];
- marcar a ordem de execução completa;
- marcar a definição de pronto que tiver evidência;
- não marcar itens sem validação real.

Executar o CI uma única vez para este checkpoint.

---

# Fechamento

Após as quatro tasks:

- [ ] confirmar que as quatro tasks estão [x] na spec;
- [ ] confirmar que o último CI está verde;
- [ ] revisar o diff completo da branch contra main;
- [ ] confirmar que não houve migration D1 ou alteração destrutiva de dados;
- [ ] confirmar que login admin e loja seguem funcionando;
- [ ] confirmar que importação de agenda continua usando o fluxo existente;
- [ ] confirmar desktop e mobile;
- [ ] atualizar documentação adicional somente se o comportamento final divergir da documentação atual;
- [ ] fazer review final antes do merge para main.

## Critério para merge

O PR só pode ir para main quando:
- Task 1, Task 2, Task 3 e Task 4 estiverem marcadas como [x];
- CI estiver verde;
- não houver regressão conhecida de login/importação;
- o gerenciamento de usuários estiver completo;
- light/dark estiverem consistentes;
- a spec refletir exatamente o que foi concluído.
