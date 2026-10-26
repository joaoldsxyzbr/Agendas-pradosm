import { test, expect } from "@playwright/test";

const report = {
  id: "r1", date: "2026-10-26", reportDate: "2026-10-26",
  reportCode: "Scm405", fileName: "cross-sintetico.pdf", reference: "Carga teste",
  stores: 1, lines: 1, dispatchQty: 1, separateQty: 24
};
const item = {
  storeNumber: "01", storeName: "LOJA 01 LTDA", department: "MERCEARIA",
  productCode: "12345", description: "PRODUTO SINTETICO", gtin: "7896007811298",
  orderCode: "80776", dispatchCode: "27896007811292",
  packageSize: 24, dispatchQty: 1, separateQty: 24
};
const user = (papel, lojaCodigo) => ({
  id: "u1", nome: "Operador Teste", papel,
  lojaId: "s1", lojaCodigo, lojaNome: lojaCodigo || "CD"
});
async function mocks(page, actor) {
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = data => route.fulfill({ json: data });
    if (path === "/api/auth/me") return json(actor);
    if (path === "/api/realtime/config") return json({ mode: "off", protocolVersion: 1 });
    if (path === "/api/store/today" || path.startsWith("/api/store/history/")) {
      return json({ agenda: null, appointments: [] });
    }
    if (path === "/api/store/presence" || path === "/api/diagnostics/events") return route.fulfill({ status: 204 });
    if (path === "/api/store/cross" || path === "/api/admin/cross") return json({ reports: [report] });
    if (path === "/api/store/cross/r1" || path === "/api/admin/cross/r1") return json({ report, rows: [item] });
    throw Error("Rota inesperada: " + path);
  });
}

test("ADM possui área separada do importador de agendas", async ({ page }) => {
  await mocks(page, user("admin", null));
  await page.goto("/admin/cross");
  await expect(page.getByRole("heading", { name: "Cross-Docking", exact: true })).toBeVisible();
  await expect(page.locator("[data-cross-import]")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Cross-Docking" }).first()).toBeVisible();
  await page.locator("[data-cross-open='r1']").click();
  await expect(page.getByText("PRODUTO SINTETICO")).toBeHidden();
  await page.locator(".cross-store summary").click();
  await expect(page.getByText("PRODUTO SINTETICO")).toBeVisible();
});

test("Doca 1 abre Cross mesmo quando não há agenda e fecha com Escape", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 01"));
  await page.goto("/app");
  await expect(page.getByText("Sem agenda").first()).toBeVisible();
  await page.getByRole("button", { name: "Ver Cross" }).click();
  const modal = page.getByRole("dialog", { name: "Ver Cross" });
  await expect(modal).toBeVisible();
  await modal.locator("[data-cross-open='r1']").click();
  await modal.locator(".cross-store summary").click();
  await expect(modal.getByText("PRODUTO SINTETICO")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await page.getByRole("button", { name: "Ver Cross" }).click();
  await expect(page.getByRole("dialog", { name: "Ver Cross" })).toBeVisible();
});

test("Outras docas não recebem botão Cross", async ({ page }) => {
  await mocks(page, user("conferente", "CD DOCA 02"));
  await page.goto("/app");
  await expect(page.locator("[data-store-cross]")).toHaveCount(0);
});
