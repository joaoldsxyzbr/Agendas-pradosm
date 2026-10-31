import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const viewer = { id: "viewer-sintetico", nome: "Visualizador Teste", papel: "visualizador" };
const uuid = i => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");

const users = [
  { id: uuid(10), nome: "Maria Silva", login: "maria", papel: "conferente", lojaId: uuid(1), ativo: true },
  { id: uuid(12), nome: "Ana Admin", login: "ana", papel: "admin", lojaId: null, ativo: true },
];
const stores = [
  { id: uuid(1), codigo: "F01", nome: "Unidade Central", ativo: true, temConferenteAtivo: true },
];
const records = [
  { id: "d1", user: { id: admin.id, name: admin.nome }, source: "browser", level: "error",
    event: "IMPORT_VALIDATION_FAILED", operation: "importacao", format: "csv", count: 12,
    durationMs: 45, httpStatus: 400, correlationId: "9f2d1c10-1111-4000-8000-000000000001",
    storeId: uuid(1), createdAt: "2026-10-28T13:00:00.000Z" },
  { id: "d2", user: { id: uuid(10), name: "Maria Silva" }, source: "browser", level: "info",
    event: "IMPORT_SUCCEEDED", operation: "importacao", format: "csv", count: 30,
    durationMs: 820, httpStatus: 200, correlationId: null,
    storeId: uuid(1), createdAt: "2026-10-28T14:00:00.000Z" },
  { id: "d3", user: null, source: "browser", level: "error",
    event: "BROWSER_EXCEPTION", operation: "aplicativo", format: null, count: null,
    durationMs: null, httpStatus: null, correlationId: "9f2d1c10-1111-4000-8000-000000000003",
    storeId: null, createdAt: "2026-10-28T15:00:00.000Z" },
  { id: "d4", user: { id: admin.id, name: admin.nome }, source: "worker", level: "warning",
    event: "IMPORT_READ_FAILED", operation: "importacao", format: "pdf", count: null,
    durationMs: 300, httpStatus: null, correlationId: null,
    storeId: uuid(1), createdAt: "2026-10-28T16:00:00.000Z" },
];
const audit = [
  { id: "a1", action: "usuario_atualizado", entity: "usuario", entityId: uuid(10), storeId: null,
    agendaId: null, appointmentId: null, before: { nome: "Maria Antiga" }, after: { nome: "Maria Silva" },
    details: "Usuário atualizado.", createdAt: "2026-10-28T12:00:00.000Z",
    user: { id: admin.id, name: admin.nome } },
  { id: "a2", action: "loja_criada", entity: "loja", entityId: uuid(2), storeId: uuid(2),
    agendaId: null, appointmentId: null, before: null, after: { codigo: "F02" },
    details: "Loja criada.", createdAt: "2026-10-28T11:00:00.000Z", user: null },
];

async function setup(page, { role = "admin", failure = false } = {}) {
  const current = role === "admin" ? admin : viewer;
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    requests.push({ path, method, params: url.searchParams });
    if (path === "/api/auth/me") return route.fulfill({ json: current });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    if (path === "/api/admin/users" && method === "GET") return route.fulfill({ json: users });
    if (path === "/api/admin/stores") return route.fulfill({ json: stores });
    if (path === "/api/admin/diagnostics") {
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { error: "INDISPONIVEL" } }); }
      const params = url.searchParams;
      let list = records;
      if (params.get("nivel")) list = list.filter(item => item.level === params.get("nivel"));
      if (params.get("origem")) list = list.filter(item => item.source === params.get("origem"));
      if (params.get("operacao")) list = list.filter(item => item.operation === params.get("operacao"));
      if (params.get("date")) list = list.filter(item => item.createdAt.startsWith(params.get("date")));
      if (params.get("userId")) list = list.filter(item => item.user?.id === params.get("userId"));
      if (params.get("storeId")) list = list.filter(item => item.storeId === params.get("storeId"));
      return route.fulfill({ json: list });
    }
    if (path === "/api/admin/audit") {
      const params = url.searchParams;
      let list = audit;
      if (params.get("date")) list = list.filter(item => item.createdAt.startsWith(params.get("date")));
      if (params.get("userId")) list = list.filter(item => item.user?.id === params.get("userId"));
      if (params.get("storeId")) list = list.filter(item => item.storeId === params.get("storeId"));
      return route.fulfill({ json: list });
    }
    if (path === "/api/admin/agendas") return route.fulfill({ json: [] });
    if (path === "/api/admin/presence") return route.fulfill({ json: [] });
    throw Error("Endpoint inesperado no teste: " + method + " " + path);
  });
  await page.goto("/admin/diagnostics");
  return { requests };
}

test("Diagnósticos React abre na aba Erros com apenas falhas", async ({ page }) => {
  const { requests } = await setup(page);
  const table = page.getByRole("table", { name: "Registros de diagnóstico" });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("2 registros nesta consulta (máximo de 100).")).toBeVisible();
  await expect(table).toContainText("Arquivo não passou na validação");
  await expect(table).toContainText("Erro do JavaScript");
  const query = requests.find(r => r.path === "/api/admin/diagnostics");
  expect(query.params.get("nivel")).toBe("error");
  expect(query.params.get("limit")).toBe("100");
});

test("Diagnósticos React separa operações dos erros", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole("tab", { name: "Operações" }).click();
  const table = page.getByRole("table", { name: "Registros de diagnóstico" });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table).toContainText("Importação confirmada");
  await expect(table).toContainText("Falha na leitura do arquivo");
  const queries = requests.filter(r => r.path === "/api/admin/diagnostics");
  const latest = queries.at(-1);
  expect(latest.params.get("nivel")).toBeNull();
  await expect(page.getByText("2 registros nesta consulta (máximo de 100).")).toBeVisible();
});

test("Diagnósticos React consulta auditoria com filtros de cadastro", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByRole("tab", { name: "Auditoria" }).click();
  await expect(page.getByRole("combobox", { name: "Origem" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Área" })).toBeDisabled();
  const table = page.getByRole("table", { name: "Registros de auditoria" });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table).toContainText("usuario atualizado");
  await expect(table).toContainText("Sistema");
  const query = requests.find(r => r.path === "/api/admin/audit");
  expect(query.params.get("limit")).toBe("100");
  await page.getByLabel("Data (UTC)").fill("2026-10-28");
  await page.getByLabel("Usuário").selectOption({ label: "Maria Silva" });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("Usuário atualizado.");
  const filtered = requests.filter(r => r.path === "/api/admin/audit").at(-1);
  expect(filtered.params.get("date")).toBe("2026-10-28");
  expect(filtered.params.get("userId")).toBe(uuid(10));
});

test("Diagnósticos React filtra erros por origem e área", async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByLabel("Origem").selectOption("browser");
  await page.getByLabel("Área").selectOption("importacao");
  await page.getByRole("button", { name: "Filtrar" }).click();
  const table = page.getByRole("table", { name: "Registros de diagnóstico" });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("Arquivo não passou na validação");
  const query = requests.filter(r => r.path === "/api/admin/diagnostics").at(-1);
  expect(query.params.get("origem")).toBe("browser");
  expect(query.params.get("operacao")).toBe("importacao");
  expect(query.params.get("nivel")).toBe("error");
});

test("Diagnósticos React trata falha com tentativa novamente", async ({ page }) => {
  await setup(page, { failure: true });
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível carregar os registros de auditoria." })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("table", { name: "Registros de diagnóstico" }).locator("tbody tr")).toHaveCount(2);
});

test("Diagnósticos React bloqueia visualizador", async ({ page }) => {
  await setup(page, { role: "visualizador" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Logs e Auditoria" })).toHaveCount(0);
});

test("Diagnósticos React mantém celular sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.getByRole("heading", { name: "Logs e Auditoria", exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Registros de diagnóstico" }).locator("tbody tr")).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
