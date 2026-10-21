import { test, expect } from "@playwright/test";
const viewer = { id:"v1", nome:"Visualizador", papel:"visualizador", login:"viewer" };
const admin = { id:"a1", nome:"Administrador", papel:"admin", login:"admin" };
async function mocks(page, user) {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    const json = data => route.fulfill({ json:data });
    if (path === "/api/auth/me") return json(user);
    if (path === "/api/realtime/config") return json({ mode:"off", protocolVersion:1 });
    if (path === "/api/admin/stores") return json([{ id:"s1", codigo:"F01", nome:"Centro" }]);
    if (path === "/api/admin/reports") return json({ rows:[{ date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",total:5,recebido:3,naoChegou:1,aguardando:1,semConferencia:0,recusado:0,semAgenda:0 }], suppliers:[] });
    if (path === "/api/admin/reports/occurrences") return json({ total:0, limit:50, offset:0, rows:[] });
    throw Error("API não mockada: " + path);
  });
}
test("Administrador: 13 ajudas em mouse e teclado", async ({ page }) => {
  await page.setViewportSize({ width:1366, height:900 });
  await mocks(page, admin);
  await page.goto("/admin/reports");
  await expect(page.locator(".report-info-button")).toHaveCount(13);
  const info=page.getByRole("button", { name:"Sobre: Comparativo por loja" });
  const tooltip=page.locator("#report-help-9");
  await expect(tooltip).toBeHidden();
  await info.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("recebidos");
  await page.mouse.move(4,4);
  await expect(tooltip).toBeHidden();
  await page.keyboard.press("Tab");
  await info.focus();
  await expect(tooltip).toBeVisible();
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded","true");
  await page.mouse.move(4,4);
  await page.keyboard.press("Escape");
  await expect(info).toHaveAttribute("aria-expanded","false");
  await expect(tooltip).toBeHidden();
});
test("Visualizador: toque abre a explicação e toque fora fecha", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await mocks(page, viewer);
  await page.goto("/admin/reports");
  const info=page.getByRole("button", { name:"Sobre: Comparativo por loja" });
  await expect(info).toBeVisible();
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded","true");
  await expect(page.locator("#report-help-9")).toBeVisible();
  await page.getByRole("heading", { name:"Comparativo por loja" }).click();
  await expect(info).toHaveAttribute("aria-expanded","false");
  await expect(page.locator("#report-help-9")).toBeHidden();
});