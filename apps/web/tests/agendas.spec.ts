import { test, expect } from "@playwright/test";

const admin = { id: "adm", nome: "ADM de teste", papel: "admin" };
const viewer = { id: "viewer", nome: "Visualizador", papel: "visualizador" };
const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const boards = [
  { id: "agenda0", storeId: "s0", storeCode: "F01", storeName: "Loja 1",
    date: "2026-11-03", originalFileName: "agendas.csv", dayStatus: "aberto",
    digitadoEm: null, digitadoPor: null,
    total: 2, recebido: 0, aguardando: 2, naoChegou: 0, recusado: 0, semAgenda: 0 },
  { id: "agenda1", storeId: "s1", storeCode: "F02", storeName: "Loja 2",
    date: "2026-11-03", originalFileName: "agendas.csv", dayStatus: "concluido",
    digitadoEm: null, digitadoPor: null,
    total: 1, recebido: 0, aguardando: 1, naoChegou: 0, recusado: 0, semAgenda: 0 },
];

const appointments = [
  { id: "a1", supplier: "Fornecedor Azul", protocol: "123456", startTime: "08:00", endTime: "09:00",
    items: 12, volumes: 4, pallets: 2, cargaBatida: "Sim", type: "Nota fiscal",
    nfe: ["332211"], orders: ["8899"], csvFields: { "Doca": "01", "Pedidos": "8899", "N° NF-e": "332211" } },
  { id: "a2", supplier: "Fornecedor Azul", protocol: "123457", startTime: "10:00", endTime: "11:00",
    items: 2, volumes: 3, pallets: 0, cargaBatida: "Não", type: "Pedido",
    nfe: [], orders: ["8898"], csvFields: {} },
  { id: "b1", supplier: "Fornecedor Verde", protocol: "123458", startTime: "12:00", endTime: "13:00",
    items: 1, volumes: 1, pallets: 1, cargaBatida: null, type: "Nota fiscal",
    nfe: ["99999"], orders: [], csvFields: {} }
];

async function mock(page, role = "admin", options = {}) {
  const requests = [];
  let rows = {
    agenda0: [{ supplier: "Fornecedor Azul", hash: hashA, digitadoEm: null, digitadoPor: null, appointments: appointments.slice(0, 2) }],
    agenda1: [{ supplier: "Fornecedor Verde", hash: hashB, digitadoEm: null, digitadoPor: null, appointments: appointments.slice(2) }]
  };
  if (options.multipleSuppliers) {
    rows.agenda0.push({
      supplier: "Fornecedor Laranja", hash: "c".repeat(64),
      digitadoEm: null, digitadoPor: null,
      appointments: [{ ...appointments[2], id: "c1", protocol: "123459", supplier: "Fornecedor Laranja" }]
    });
  }
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body });
    const json = data => route.fulfill({ json: data });
    if (path === "/api/auth/me") return json(role === "viewer" ? viewer : admin);
    if (path === "/api/realtime/config") return json({ mode: "off", protocolVersion: 1 });
    if (["/api/admin/stores", "/api/admin/presence"].includes(path)) return json([]);
    if (path === "/api/admin/agendas" && method === "GET") {
      return json(boards.map(board => ({
        ...board,
        digitadas: rows[board.id].filter(supplier => supplier.digitadoEm).length,
        fornecedores: rows[board.id].length
      })));
    }
    const id = /^\/api\/admin\/agendas\/(agenda[01])\/digitacao$/.exec(path)?.[1];
    if (id && method === "GET") return json({ agendaId: id, suppliers: rows[id] });
    if (id && method === "PATCH") {
      if (options.conflict) return route.fulfill({ status: 409, json: { error: "CONFLITO_ESTADO", message: "Este fornecedor mudou" } });
      const updated = { supplier: body.supplier, hash: body.hash,
        digitadoEm: body.digitado ? "2026-11-03T11:00:00.000Z" : null,
        digitadoPor: body.digitado ? { id: "adm", name: "Administrador" } : null };
      rows[id] = rows[id].map(item => item.supplier === body.supplier ? { ...item, ...updated } : item);
      return json(updated);
    }
    throw Error("API inesperada: " + method + " " + path);
  });
  return { requests };
}

test("Agendas expande lojas sem botões antigos e exibe fornecedores", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/agendas");
  await expect(page.getByRole("heading", { name: "Agendas", exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "Agendas por loja" });
  await expect(table.locator("thead th")).toHaveCount(5);
  await expect(table.locator("thead")).toContainText("Digitadas");
  await expect(table.locator("thead")).not.toContainText("Arquivo importado");
  await expect(page.getByTestId("agendas-progress-F01")).toContainText("0/1 digitadas");
  await expect(page.getByTestId("agendas-progress-F02")).toContainText("0/1 digitadas");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Marcar como digitada" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver agendamentos" })).toHaveCount(0);
  await expect(page.getByLabel("Agendas do dia").locator("strong")).toHaveText(["2", "3", "1"]);
  await page.getByTestId("agendas-row-F01").getByRole("button", { name: /F01/ }).click();
  await expect(page.getByTestId("agendas-details-F01")).toContainText("Fornecedor Azul");
  await expect(page.getByTestId("agendas-details-F01")).toContainText("0 de 1 digitados");
  await expect(page.getByTestId("agendas-details-F01").getByRole("checkbox")).toHaveCount(1);
});

test("Fornecedores aparecem em linhas compactas únicas, com detalhes sob demanda", async ({ page }) => {
  await mock(page, "admin", { multipleSuppliers: true });
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F01").getByRole("button", { name: /F01/ }).click();
  const section = page.getByTestId("agendas-details-F01");
  const list = section.getByRole("list", { name: "Fornecedores desta loja" });
  const items = list.getByTestId("agendas-supplier-item");
  await expect(items).toHaveCount(2);
  await expect(list).toContainText("Fornecedor Azul");
  await expect(list).toContainText("Fornecedor Laranja");
  await expect(section.getByRole("checkbox")).toHaveCount(2);
  await expect(section.getByRole("button", { name: "Detalhes de Fornecedor Azul" })).toHaveAttribute("aria-expanded", "false");
  await expect(section.getByTestId("agendas-protocol-123456")).toHaveCount(0);
  const rects = await items.evaluateAll(nodes => nodes.map(node => {
    const { x, y, height } = node.getBoundingClientRect();
    return { x, y, height };
  }));
  expect(rects[0].height).toBeLessThan(54);
  expect(rects[1].height).toBeLessThan(54);
  expect(rects[1].y).toBeGreaterThan(rects[0].y);
  expect(rects[1].x).toBe(rects[0].x);
  await section.getByRole("button", { name: "Detalhes de Fornecedor Azul" }).click();
  await expect(section.getByTestId("agendas-protocol-123456")).toBeVisible();
  await expect(section.getByRole("button", { name: "Detalhes de Fornecedor Azul" })).toHaveAttribute("aria-expanded", "true");
  await section.getByRole("button", { name: "Detalhes de Fornecedor Azul" }).click();
  await expect(section.getByTestId("agendas-protocol-123456")).toHaveCount(0);
});

test("Progresso por loja é visível sem abrir fornecedores e não cria consultas por loja", async ({ page }) => {
  const spy = await mock(page, "admin", { multipleSuppliers: true });
  await page.goto("/admin/agendas");
  await expect(page.getByTestId("agendas-progress-F01")).toContainText("0/2 digitadas");
  await expect(page.getByTestId("agendas-progress-F02")).toContainText("0/1 digitadas");
  expect(spy.requests.filter(request => request.path.endsWith("/digitacao"))).toHaveLength(0);
  const row = page.getByTestId("agendas-row-F01");
  await row.getByRole("button", { name: "Ver fornecedores" }).click();
  await expect(row.getByRole("button", { name: "Ocultar fornecedores" })).toBeVisible();
  await expect(page.getByTestId("agendas-details-F01")).toContainText("Fornecedor Laranja");
  await row.getByRole("button", { name: "Ocultar fornecedores" }).click();
  await expect(page.getByTestId("agendas-details-F01")).toHaveCount(0);
  await expect(page.getByTestId("agendas-progress-F01")).toContainText("0/2 digitadas");
});

test("Check é por fornecedor, independente dos protocolos e dos status", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F01").getByRole("button", { name: /F01/ }).click();
  const check = page.getByRole("checkbox", { name: "Digitado: Fornecedor Azul" });
  await expect(check).not.toBeChecked();
  await check.click();
  await expect(check).toBeChecked();
  await expect(page.getByTestId("agendas-details-F01")).toContainText("1 de 1 digitados");
  await expect(page.getByTestId("agendas-progress-F01")).toContainText("1/1 digitadas");
  await check.click();
  await expect(check).not.toBeChecked();
  await expect(page.getByTestId("agendas-progress-F01")).toContainText("0/1 digitadas");
  const calls = spy.requests.filter(call => call.method === "PATCH" && call.path.endsWith("/digitacao"));
  expect(calls.map(call => ({ supplier: call.body.supplier, digitado: call.body.digitado })))
    .toEqual([{ supplier: "Fornecedor Azul", digitado: true }, { supplier: "Fornecedor Azul", digitado: false }]);
  expect(spy.requests.filter(call => /\/status$/.test(call.path))).toHaveLength(0);
});

test("Agendas mostra pedidos e campos CSV originais por protocolo", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F01").getByRole("button", { name: /F01/ }).click();
  await page.getByRole("button", { name: "Detalhes de Fornecedor Azul" }).click();
  const protocol = page.getByTestId("agendas-protocol-123456");
  await expect(protocol).toContainText("8899");
  await expect(protocol).toContainText("332211");
  await protocol.getByText("Todos os campos originais do CSV").click();
  await expect(protocol).toContainText("Doca");
  await expect(protocol).toContainText("01");
  await expect(page.getByTestId("agendas-protocol-123457")).toBeVisible();
});

test("Conflito administrativo preserva o check anterior", async ({ page }) => {
  await mock(page, "admin", { conflict: true });
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F02").getByRole("button", { name: /F02/ }).click();
  const check = page.getByRole("checkbox", { name: "Digitado: Fornecedor Verde" });
  await check.click();
  await expect(page.getByRole("alert")).toContainText("Este fornecedor mudou");
  await expect(check).not.toBeChecked();
});

test("Visualizador não pode acessar Agendas nem Importação", async ({ page }) => {
  await mock(page, "viewer");
  await page.goto("/admin/agendas");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Agendas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importação" })).toHaveCount(0);
  await page.goto("/admin/import");
  await expect(page).toHaveURL(/\/admin$/);
});

test("Importação é uma aba exclusiva e não aparece no Recebimento", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Importar agenda" })).toHaveCount(0);
  await page.getByRole("link", { name: "Importação" }).click();
  await expect(page).toHaveURL(/\/admin\/import$/);
  await expect(page.getByRole("heading", { name: "Importação de Agendas" })).toBeVisible();
  await page.getByRole("button", { name: "Selecionar arquivo CSV/PDF" }).click();
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toBeVisible();
});
