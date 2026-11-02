import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const viewer = { id: "viewer-sintetico", nome: "Visualizador Teste", papel: "visualizador" };
const uuid = i => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");

function buildState() {
  return {
    users: [
      { id: uuid(10), nome: "Maria Silva", login: "maria", papel: "conferente", lojaId: uuid(1), ativo: true },
      { id: uuid(11), nome: "João Doca", login: "joao.doca", papel: "conferente", lojaId: uuid(1), ativo: true },
      { id: uuid(12), nome: "Ana Admin", login: "ana", papel: "admin", lojaId: null, ativo: true },
      { id: uuid(13), nome: "Pedro View", login: "pedro", papel: "visualizador", lojaId: null, ativo: false },
    ],
    stores: [
      { id: uuid(1), codigo: "F01", nome: "Unidade Central", ativo: true, temConferenteAtivo: true },
      { id: uuid(2), codigo: "F02", nome: "Unidade Sul", ativo: false, temConferenteAtivo: false },
    ],
  };
}

async function setup(page, { role = "admin", duplicate = false, lastAdmin = false, listingError = false } = {}) {
  const current = role === "admin" ? admin : viewer;
  const state = buildState();
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body, params: url.searchParams });
    if (path === "/api/auth/me") return route.fulfill({ json: current });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    if (path === "/api/admin/presence") return route.fulfill({ json: [] });
    if (path === "/api/admin/stores") return route.fulfill({ json: state.stores });
    if (path === "/api/admin/users" && method === "GET") {
      if (listingError) { listingError = false; return route.fulfill({ status: 503, json: { error: "FALHA" } }); }
      return route.fulfill({ json: state.users });
    }
    if (path === "/api/admin/users" && method === "POST") {
      if (duplicate) return route.fulfill({ status: 409, json: { error: "LOGIN_EM_USO", message: "Login já está em uso." } });
      const created = { id: uuid(20), nome: body.nome, login: body.login, papel: body.papel, lojaId: body.lojaId ?? null, ativo: true };
      state.users = [...state.users, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/api/admin/users" && method === "PATCH") {
      if (lastAdmin) return route.fulfill({ status: 409, json: { error: "ULTIMO_ADMIN_ATIVO", message: "É necessário manter pelo menos um administrador ativo." } });
      let updated = null;
      state.users = state.users.map(user => user.id === body.id
        ? (updated = {
            ...user,
            ...(body.nome !== undefined ? { nome: body.nome } : {}),
            ...(body.login !== undefined ? { login: body.login } : {}),
            ...(body.papel !== undefined ? { papel: body.papel } : {}),
            ...(body.papel !== undefined ? { lojaId: body.papel === "conferente" ? body.lojaId ?? user.lojaId : null } : {}),
            ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
          })
        : user);
      return route.fulfill({ json: updated });
    }
    if (path === "/api/admin/audit" && method === "GET") {
      return route.fulfill({ json: [{
        id: "evt-1", action: "usuario_atualizado", createdAt: "2026-10-30T12:00:00.000Z",
        details: "Usuário atualizado.", user: { id: admin.id, name: admin.nome },
        before: { nome: "Maria Antiga" }, after: { nome: "Maria Silva" },
      }] });
    }
    if (path === "/api/admin/agendas") return route.fulfill({ json: [] });
    throw Error("Endpoint inesperado no teste: " + method + " " + path);
  });
  await page.goto("/admin/users");
  return { requests, state };
}

test("Usuários React lista, filtra e conta acessos", async ({ page }) => {
  const { state } = await setup(page);
  const table = page.getByRole("table", { name: "Usuários cadastrados" });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByText("4 usuários · 3 ativos")).toBeVisible();
  await expect(table.locator("tbody tr")).toContainText(["F01 - Unidade Central"]);
  await page.getByRole("searchbox", { name: "Buscar usuário" }).fill("maria");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Buscar usuário" }).fill("");
  await page.getByRole("combobox", { name: "Filtrar por papel" }).selectOption("conferente");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Filtrar por papel" }).selectOption("todos");
  await page.getByRole("combobox", { name: "Filtrar por situação" }).selectOption("inativos");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toContainText("Pedro View");
  expect(state.users.length).toBe(4);
});

test("Usuários React exige campos completos antes de gravar", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole("button", { name: "Novo usuário" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar usuário" });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: "Cadastrar usuário" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Nome").fill("Novo Conferente");
  await dialog.getByLabel("Login").fill("novo.conferente");
  await dialog.getByLabel("Senha").fill("curta");
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Senha").fill("senha-valida-123456");
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Loja").selectOption(uuid(1));
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  expect(requests.filter(r => r.method === "POST")).toHaveLength(1);
  const post = requests.find(r => r.method === "POST");
  expect(post.body).toEqual({
    nome: "Novo Conferente", login: "novo.conferente", senha: "senha-valida-123456",
    papel: "conferente", lojaId: uuid(1),
  });
  await expect(page.getByRole("table", { name: "Usuários cadastrados" }).locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText("5 usuários · 4 ativos")).toBeVisible();
});

test("Usuários React mostra login em uso sem fechar o diálogo", async ({ page }) => {
  const { requests } = await setup(page, { duplicate: true });
  await page.getByRole("button", { name: "Novo usuário" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar usuário" });
  await dialog.getByLabel("Nome").fill("Duplicado");
  await dialog.getByLabel("Login").fill("maria");
  await dialog.getByLabel("Senha").fill("senha-valida-123456");
  await dialog.getByLabel("Papel").selectOption("visualizador");
  await dialog.getByRole("button", { name: "Cadastrar usuário" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Login já está em uso.");
  await expect(dialog).toBeVisible();
  expect(requests.filter(r => r.method === "POST")).toHaveLength(1);
});

test("Usuários React edita acesso e consulta auditoria", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole("button", { name: "Editar usuário Maria Silva" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar usuário" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Loja")).toHaveValue(uuid(1));
  await dialog.getByLabel("Papel").selectOption("visualizador");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toHaveCount(0);
  const patch = requests.find(r => r.method === "PATCH" && r.path === "/api/admin/users");
  expect(patch.body).toEqual({ id: uuid(10), nome: "Maria Silva", login: "maria", papel: "visualizador" });
  await expect(page.getByRole("table", { name: "Usuários cadastrados" }).locator("tbody tr")).toContainText(["Maria Silva", "Visualizador"]);
  await page.getByRole("button", { name: "Editar usuário Maria Silva" }).click();
  await page.getByRole("button", { name: "Ver histórico" }).click();
  await expect(dialog.getByRole("list")).toContainText("Usuário atualizado");
  await expect(dialog).toContainText("Antes: nome: Maria Antiga");
  await expect(dialog).toContainText("Depois: nome: Maria Silva");
  const audit = requests.find(r => r.path === "/api/admin/audit");
  expect(audit.params.get("entity")).toBe("usuario");
  expect(audit.params.get("entityId")).toBe(uuid(10));
});

test("Usuários React desativa e reativa com confirmação", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole("button", { name: "Editar usuário Maria Silva" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar usuário" });
  await dialog.getByRole("button", { name: "Desativar usuário" }).click();
  await expect(dialog.getByText("Desativar Maria Silva?")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar desativação" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests.find(r => r.method === "PATCH" && r.path === "/api/admin/users").body)
    .toEqual({ id: uuid(10), ativo: false });
  await expect(page.getByRole("table", { name: "Usuários cadastrados" }).locator("tbody tr"))
    .toContainText(["Maria Silva", "Inativo"]);
  await page.getByRole("button", { name: "Editar usuário Maria Silva" }).click();
  await dialog.getByRole("button", { name: "Ativar usuário" }).click();
  await dialog.getByRole("button", { name: "Confirmar ativação" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests.filter(r => r.method === "PATCH").at(-1).body).toEqual({ id: uuid(10), ativo: true });
  await expect(page.getByRole("table", { name: "Usuários cadastrados" }).locator("tbody tr"))
    .toContainText(["Maria Silva", "Ativo"]);
});

test("Usuários React protege o último administrador ativo", async ({ page }) => {
  await setup(page, { lastAdmin: true });
  await page.getByRole("button", { name: "Editar usuário Ana Admin" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar usuário" });
  await dialog.getByRole("button", { name: "Desativar usuário" }).click();
  await dialog.getByRole("button", { name: "Confirmar desativação" }).click();
  await expect(dialog.getByRole("alert")).toContainText("É necessário manter pelo menos um administrador ativo.");
  await expect(dialog).toBeVisible();
});

test("Usuários React recupera falha de listagem com tentativa novamente", async ({ page }) => {
  await setup(page, { listingError: true });
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar os usuários." })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("table", { name: "Usuários cadastrados" }).locator("tbody tr")).toHaveCount(4);
});

test("Usuários React bloqueia visualizador", async ({ page }) => {
  await setup(page, { role: "visualizador" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
});

test("Usuários React usa cartões no celular sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible();
  const cards = page.getByLabel("Usuários no celular");
  await expect(cards.locator("article")).toHaveCount(4);
  await expect(page.getByRole("table", { name: "Usuários cadastrados" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
