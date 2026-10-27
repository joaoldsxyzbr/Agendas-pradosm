import { test, expect } from "@playwright/test";

const date = "2026-10-26";
const report = {
  id: "r1", agendaId: "agenda1", appointmentId: "ap1", version: 1,
  date, reportDate: date, reportCode: "Scm405",
  fileName: "cross-sintetico.pdf", reference: "Carga teste",
  stores: 1, lines: 1, dispatchQty: 1, separateQty: 24
};
const items = [{
  storeNumber: "01", storeName: "LOJA 01 LTDA", department: "MERCEARIA",
  productCode: "12345", description: "PRODUTO SINTETICO",
  gtin: "7896007811298", orderCode: "80776", dispatchCode: "27896007811292",
  packageSize: 24, dispatchQty: 1, separateQty: 24
}];
const user = (papel, lojaCodigo) => ({
  id: "u1", nome: "Operador Teste", papel,
  lojaId: "s1", lojaCodigo, lojaNome: lojaCodigo || "CD"
});
const appointment = (id, protocol, supplier) => ({
  id, protocol, supplier, startTime: "07:00", endTime: "07:30",
  status: "aguardando", ativo: true, type: "TESTE", items: 1, volumes: 2,
  pallets: 0, nfe: [], orders: [], hasExchanges: false, origin: "importado"
});
const linked = [
  { appointment: { id: "ap1", protocol: "99026101", supplier: "DISTRIBUIDORA ALFA", startTime: "07:00", endTime: "07:30" },
    cross: report },
  { appointment: { id: "ap2", protocol: "99026102", supplier: "DISTRIBUIDORA ALFA", startTime: "08:10", endTime: "08:40" },
    cross: { ...report, id: "r2", appointmentId: "ap2", separateQty: 48 } }
];
async function mocks(page, actor, { hasAgenda = true, suppliers = linked, unavailable = false } = {}) {
  const paths = [];
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    paths.push(pathname);
    const json = data => route.fulfill({ json: data });
    if (pathname === "/api/auth/me") return json(actor);
    if (pathname === "/api/realtime/config") return json({ mode: "off", protocolVersion: 1 });
    if (pathname === "/api/store/today") return json({
      agenda: hasAgenda ? { id: "agenda1", date, storeCode: actor.lojaCodigo,
        storeName: "CD Doca 1", dayStatus: "aberto", completedAt: null } : null,
      appointments: hasAgenda ? [
        appointment("ap1", "99026101", "DISTRIBUIDORA ALFA"),
        appointment("ap2", "99026102", "DISTRIBUIDORA ALFA"),
        appointment("ap3", "99026103", "INDUSTRIA SEM CROSS")
      ] : []
    });
    if (pathname.startsWith("/api/store/history/")) return json({ agenda: null, appointments: [] });
    if (pathname === "/api/store/presence" || pathname === "/api/diagnostics/events") return route.fulfill({ status: 204 });
    if (pathname === "/api/store/cross/agendas/agenda1") {
      return unavailable ? route.fulfill({ status: 503, json: { error: "DB_INDISPONIVEL" } })
        : json({ agendaId: "agenda1", date, suppliers });
    }
    if (pathname === "/api/store/cross/agendas/agenda1/appointments/ap1")
      return json({ appointment: linked[0].appointment, report, rows: items });
    if (pathname === "/api/store/cross/agendas/agenda1/appointments/ap2")
      return json({ appointment: linked[1].appointment, report: { ...report, id: "r2", appointmentId: "ap2" }, rows: [
        { ...items[0], storeNumber: "02", storeName: "LOJA 02 LTDA", description: "PRODUTO DO SEGUNDO CROSS" }
      ] });
    if (pathname === "/api/admin/cross") return json({ reports: [report] });
    if (pathname === "/api/admin/cross/r1") return json({ report, rows: items });
    throw Error("Rota inesperada: " + pathname);
  });
  return paths;
}

test("ADM ainda tem o módulo antigo durante P3, sem mudança no P4", async ({ page }) => {
  await mocks(page, user("admin", null));
  await page.goto("/admin/cross");
  await expect(page.getByRole("heading", { name: "Cross-Docking", exact: true })).toBeVisible();
  await expect(page.locator("[data-cross-import]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Cross-Docking" }).first()).toBeVisible();
  await page.locator("[data-cross-open='r1']").click();
  await page.locator(".cross-store summary").click();
  await expect(page.getByText("PRODUTO SINTETICO")).toBeVisible();
});

test("Doca 1 consulta somente Cross dos agendamentos da data e distingue protocolos iguais", async ({ page }) => {
  const paths = await mocks(page, user("conferente", "CD DOCA 01"));
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Ver Cross" })).toBeVisible();
  expect(paths.some(x => x.startsWith("/api/store/cross"))).toBe(false);
  await page.getByRole("button", { name: "Ver Cross" }).click();
  const modal = page.getByRole("dialog", { name: "Ver Cross" });
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-cross-supplier]")).toHaveCount(2);
  await expect(modal.getByText("INDUSTRIA SEM CROSS")).toHaveCount(0);
  await expect(modal.getByText("99026101")).toBeVisible();
  await expect(modal.getByText("99026102")).toBeVisible();
  await modal.locator("[data-cross-supplier='ap2']").click();
  await expect(modal.getByText("PRODUTO DO SEGUNDO CROSS")).toBeHidden();
  await modal.locator(".cross-store summary").click();
  await expect(modal.getByText("PRODUTO DO SEGUNDO CROSS")).toBeVisible();
  expect(paths).toContain("/api/store/cross/agendas/agenda1/appointments/ap2");
  expect(paths).not.toContain("/api/store/cross/agendas/agenda1/appointments/ap1");
  await modal.locator("[data-cross-back]").click();
  await expect(modal.locator("[data-cross-supplier]")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver Cross" })).toBeFocused();
  await page.getByRole("button", { name: "Ver Cross" }).click();
  await expect(page.getByRole("dialog", { name: "Ver Cross" })).toBeVisible();
});

test("Doca 1 não exibe Cross sem agenda e fecha ao trocar o dia", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 01"), { hasAgenda: false });
  await page.goto("/app");
  await expect(page.getByText(/Nenhuma agenda para hoje/)).toBeVisible();
  await expect(page.locator("[data-store-cross]")).toBeHidden();
});

test("Doca 1 fecha o Cross ao mudar a data da agenda", async ({ page }) => {
  const paths = await mocks(page, user("conferente", "CD DOCA 01"));
  await page.goto("/app");
  await page.getByRole("button", { name: "Ver Cross" }).click();
  const modal = page.getByRole("dialog", { name: "Ver Cross" });
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("[data-store-previous]").click();
  await expect(page.locator("[data-store-cross]")).toBeHidden();
  expect(paths.some(p => p.startsWith("/api/store/cross/") && p !== "/api/store/cross/agendas/agenda1")).toBe(false);
});

test("Lista vazia e falha de consulta exibem aviso sem abrir relatório", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 01"), { suppliers: [] });
  await page.goto("/app");
  await page.getByRole("button", { name: "Ver Cross" }).click();
  await expect(page.getByRole("dialog", { name: "Ver Cross" })
    .getByText(/Nenhum fornecedor desta agenda possui Cross/)).toBeVisible();
});

test("Falha no D1 é tratada com mensagem de indisponibilidade", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 01"), { unavailable: true });
  await page.goto("/app");
  await page.getByRole("button", { name: "Ver Cross" }).click();
  await expect(page.getByRole("dialog", { name: "Ver Cross" })
    .getByText(/Não foi possível consultar o Cross/)).toBeVisible();
});

test("Outras docas não recebem botão Cross", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 02"));
  await page.goto("/app");
  await expect(page.locator("[data-store-cross]")).toHaveCount(0);
});
