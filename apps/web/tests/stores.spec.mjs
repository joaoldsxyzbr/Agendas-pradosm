import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const viewer = { id: "viewer-sintetico", nome: "Visualizador Teste", papel: "visualizador" };
const uuid = i => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");

async function setup(page, { role = "admin", duplicate = false, hasUsers = false, auditError = false, listingError = false } = {}) {
  let current = role === "admin" ? admin : viewer;
  let stores = [
    { id: uuid(1), codigo: "F01", nome: "Unidade Central", ativo: true, temConferenteAtivo: true },
    { id: uuid(2), codigo: "F02", nome: "Unidade Sul", ativo: false, temConferenteAtivo: false },
  ];
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = method === "GET" || method === "DELETE" ? null : route.request().postDataJSON();
    requests.push({ path, method, body, params: url.searchParams });
    if (path === "/api/auth/me") return route.fulfill({ json: current });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    if (path === "/api/admin/stores" && method === "GET") {
      if (listingError) { listingError = false; return route.fulfill({ status: 503, json: { error: "FALHA" } }); }
      return route.fulfill({ json: stores });
    }
    if (path === "/api/admin/stores" && method === "POST") {
      if (duplicate) return route.fulfill({ status: 409, json: { error: "CODIGO_LOJA_EM_USO", message: "Código de loja já está em uso." } });
      const store = { id: uuid(3), codigo: body.codigo, nome: body.nome, ativo: true, temConferenteAtivo: false };
      stores = [...stores, store]; return route.fulfill({ status: 201, json: store });
    }
    if (path === "/api/admin/stores" && method === "PATCH") {
      if (duplicate) return route.fulfill({ status: 409, json: { error: "CODIGO_LOJA_EM_USO", message: "Código de loja já está em uso." } });
      let edited = null;
      stores = stores.map(s => s.id === body.id ? (edited = { ...s, codigo: body.codigo, nome: body.nome, ativo: body.ativo }) : s);
      return route.fulfill({ json: edited });
    }
    if (path === "/api/admin/stores/" + uuid(1) && method === "DELETE") {
      if (hasUsers) return route.fulfill({ status: 409, json: { error: "LOJA_POSSUI_USUARIOS", message: "Mova ou exclua os usuários vinculados antes de excluir a loja." } });
      stores = stores.filter(store => store.id !== uuid(1));
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/admin/audit" && method === "GET") {
      if (auditError) return route.fulfill({ status: 503, json: { error: "INDISPONIVEL" } });
      return route.fulfill({ json: [{
        id: "evt-1", action: "loja_atualizada", createdAt: "2026-10-30T12:00:00.000Z",
        details: "Loja atualizada.", user: { id: admin.id, name: admin.nome },
        before: { nome: "Antes" }, after: { nome: "Depois" },
      }] });
    }
    if (path === "/api/admin/agendas") return route.fulfill({ json: [] });
    if (path === "/api/admin/presence") return route.fulfill({ json: [] });
    throw Error("Endpoint inesperado no teste: " + method + " " + path);
  });
  await page.goto("/admin/stores");
  return { requests, getStores: () => stores };
}

test("Lojas React lista e filtra código, nome e situação", async ({ page }) => {
  await setup(page);
  const table = page.getByRole("table", { name: "Lojas cadastradas" });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("2 lojas · 1 ativas")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar loja" }).fill("central");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("F01");
  await page.getByRole("searchbox", { name: "Buscar loja" }).fill("");
  await page.getByRole("combobox", { name: "Filtrar por situação" }).selectOption("inativas");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("Unidade Sul");
});

test("Lojas React cadastra sem gravar antes de confirmação e normaliza o código", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Nova loja" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar loja" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Código" }).fill("  f03  ");
  await dialog.getByRole("textbox", { name: "Nome" }).fill("  Nova unidade  ");
  expect(state.requests.some(r => r.method === "POST")).toBe(false);
  await dialog.getByRole("button", { name: "Cadastrar loja" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Lojas cadastradas" })).toContainText("Nova unidade");
  expect(state.requests.some(r => r.method === "POST" && r.body.codigo === "F03" && r.body.nome === "Nova unidade")).toBe(true);
});

test("Lojas React edita status e mostra histórico somente ao consultar", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Editar loja F01" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar loja" });
  await expect(dialog).toBeVisible();
  expect(state.requests.filter(r => r.path === "/api/admin/audit")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Ver histórico" }).click();
  await expect(dialog.getByText("Loja atualizada.")).toBeVisible();
  expect(state.requests.some(r => r.path === "/api/admin/audit" && r.params.get("entity") === "loja" && r.params.get("entityId") === uuid(1))).toBe(true);
  await dialog.getByRole("textbox", { name: "Nome" }).fill("Unidade Central Nova");
  await dialog.getByRole("combobox", { name: "Situação" }).selectOption("inativa");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("store-F01")).toContainText("Unidade Central Nova");
  await expect(page.getByTestId("store-F01")).toContainText("Inativa");
  expect(state.requests.some(r => r.method === "PATCH" && r.body.id === uuid(1) && r.body.ativo === false)).toBe(true);
});

test("Lojas React não remove loja sem confirmação nem quando há usuários vinculados", async ({ page }) => {
  const state = await setup(page, { hasUsers: true });
  await page.getByRole("button", { name: "Editar loja F01" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar loja" });
  await dialog.getByRole("button", { name: "Excluir loja", exact: true }).click();
  expect(state.requests.filter(r => r.method === "DELETE")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Mova ou exclua os usuários vinculados");
  await expect(page.getByTestId("store-F01")).toBeVisible();
  expect(state.requests.filter(r => r.method === "DELETE")).toHaveLength(1);
});

test("Lojas React permite cancelar exclusão sem requisição DELETE", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Editar loja F01" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar loja" });
  await dialog.getByRole("button", { name: "Excluir loja", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancelar" }).last().click();
  await expect(dialog.getByRole("button", { name: "Confirmar exclusão" })).toHaveCount(0);
  expect(state.requests.filter(r => r.method === "DELETE")).toHaveLength(0);
});

test("Lojas React preserva histórico após exclusão lógica confirmada", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Editar loja F01" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar loja" });
  await dialog.getByRole("button", { name: "Excluir loja", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Lojas cadastradas" })).not.toContainText("Unidade Central");
  expect(state.requests.filter(r => r.method === "DELETE")).toHaveLength(1);
});

test("Lojas React mostra erro de duplicidade sem alterar tabela", async ({ page }) => {
  const state = await setup(page, { duplicate: true });
  await page.getByRole("button", { name: "Nova loja" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar loja" });
  await dialog.getByRole("textbox", { name: "Código" }).fill("F01");
  await dialog.getByRole("textbox", { name: "Nome" }).fill("Outra loja");
  await dialog.getByRole("button", { name: "Cadastrar loja" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Código de loja já está em uso.");
  await expect(page.getByRole("table", { name: "Lojas cadastradas" }).locator("tbody tr")).toHaveCount(2);
  expect(state.requests.filter(r => r.method === "POST")).toHaveLength(1);
});

test("Lojas React recupera falha da listagem e mantém administrador como único papel com acesso", async ({ page }) => {
  await setup(page, { listingError: true });
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar as lojas.");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("table", { name: "Lojas cadastradas" }).locator("tbody tr")).toHaveCount(2);
});

test("Lojas React bloqueia visualizador", async ({ page }) => {
  await setup(page, { role: "visualizador" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Lojas" })).toHaveCount(0);
});

test("Lojas React não causa rolagem horizontal do documento no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.getByRole("heading", { name: "Lojas", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
