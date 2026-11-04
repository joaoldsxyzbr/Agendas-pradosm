import { test, expect } from "@playwright/test";

const admin = { id: "adm", nome: "ADM de teste", papel: "admin" };
const viewer = { id: "viewer", nome: "Visualizador de teste", papel: "visualizador" };

const boards = [
  {
    id: "agenda0", storeId: "s0", storeCode: "F01", storeName: "Loja 1",
    date: "2026-11-03", originalFileName: "agendas-03-11.csv", dayStatus: "aberto",
    digitadoEm: "2026-11-03T10:05:00.000Z", digitadoPor: { id: "adm", name: "ADM de teste" },
    total: 20, recebido: 5, aguardando: 15, naoChegou: 0, recusado: 0, semAgenda: 0,
  },
  {
    id: "agenda1", storeId: "s1", storeCode: "F02", storeName: "Loja 2",
    date: "2026-11-03", originalFileName: "agendas-03-11.csv", dayStatus: "aberto",
    digitadoEm: null, digitadoPor: null,
    total: 12, recebido: 2, aguardando: 10, naoChegou: 0, recusado: 0, semAgenda: 0,
  },
];
const detail = {
  agenda: { id: "agenda0", storeCode: "F01", storeName: "Loja 1", date: "2026-11-03", dayStatus: "aberto" },
  appointments: [
    { id: "a1", supplier: "Fornecedor Azul", protocol: "P001", startTime: "08:00", endTime: "09:00", status: "recebido", type: "Nota fiscal", items: 12, volumes: 4, pallets: 2, hasExchanges: false, origin: "imported" },
  ],
};

async function mock(page, role = "admin", options = {}) {
  const requests = [];
  let boardsNow = structuredClone(boards);
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body });
    const json = data => route.fulfill({ json: data });
    if (path === "/api/auth/me") return json(role === "viewer" ? viewer : admin);
    if (path === "/api/realtime/config") return json({ mode: "off", protocolVersion: 1 });
    if (path === "/api/admin/stores" && method === "GET") return json([]);
    if (path === "/api/admin/agendas" && method === "GET") return json(boardsNow);
    const digitadoMatch = /^\/api\/admin\/agendas\/([^/]+)\/digitado$/.exec(path);
    if (digitadoMatch && method === "PATCH") {
      if (options.conflict) return route.fulfill({ status: 409, json: { error: "CONFLITO_ESTADO", message: "Este registro mudou. Atualize a tela e tente novamente." } });
      const id = digitadoMatch[1];
      const updated = {
        id,
        digitadoEm: body.digitado ? "2026-11-03T11:00:00.000Z" : null,
        digitadoPor: body.digitado ? { id: "adm", name: "ADM de teste" } : null,
      };
      boardsNow = boardsNow.map(board => board.id === id
        ? { ...board, digitadoEm: updated.digitadoEm, digitadoPor: updated.digitadoPor }
        : board);
      return json(updated);
    }
    if (path === "/api/admin/agendas/agenda0") return json(detail);
    throw new Error("API inesperada: " + method + " " + path);
  });
  return { requests };
}

test("Tela Agendas lista importações por loja com marcação de digitação", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/agendas");
  await expect(page.getByRole("heading", { name: "Agendas", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agendas" })).toBeVisible();
  const table = page.getByRole("table", { name: "Agendas por loja" });
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveCount(6);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByTestId("agendas-row-F01").getByText("Digitado", { exact: true })).toBeVisible();
  await expect(page.getByTestId("agendas-row-F01").getByText("ADM de teste")).toBeVisible();
  await expect(page.getByTestId("agendas-row-F02").getByRole("button", { name: "Marcar como digitada" })).toBeVisible();
  await expect(page.getByTestId("agendas-row-F01").getByText("agendas-03-11.csv")).toBeVisible();
  await expect(page.getByLabel("Agendas do dia").locator("strong")).toHaveText(["2", "1", "1"]);
});

test("Tela Agendas marca e desmarca a digitação para o conferente", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F02").getByRole("button", { name: "Marcar como digitada" }).click();
  await expect(page.getByTestId("agendas-row-F02").getByText("Digitado", { exact: true })).toBeVisible();
  await expect(page.getByTestId("agendas-row-F02").getByText("ADM de teste")).toBeVisible();
  await page.getByTestId("agendas-row-F02").getByRole("button", { name: "Desmarcar digitação" }).click();
  await expect(page.getByTestId("agendas-row-F02").getByRole("button", { name: "Marcar como digitada" })).toBeVisible();
  const calls = spy.requests.filter(request => request.path.endsWith("/digitado"));
  expect(calls.map(call => call.body.digitado)).toEqual([true, false]);
});

test("Tela Agendas preserva aviso em conflito de digitação", async ({ page }) => {
  await mock(page, "admin", { conflict: true });
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F02").getByRole("button", { name: "Marcar como digitada" }).click();
  await expect(page.getByRole("alert")).toContainText("Este registro mudou");
  await expect(page.getByTestId("agendas-row-F02").getByRole("button", { name: "Marcar como digitada" })).toBeVisible();
});

test("Visualizador não acessa a tela de Agendas", async ({ page }) => {
  await mock(page, "viewer");
  await page.goto("/admin/agendas");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Agendas" })).toHaveCount(0);
});

test("Tela Agendas abre a consulta de agendamentos da loja", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/agendas");
  await page.getByTestId("agendas-row-F01").getByRole("button", { name: "Ver agendamentos" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F01/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Fornecedor Azul")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
