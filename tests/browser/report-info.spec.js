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
    if (path === "/api/admin/reports") return json({ rows:[{ date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",total:5,recebido:3,naoChegou:1,aguardando:1,naoCompareceu:0,recusado:0,semAgenda:0 }], suppliers:[] });
    if (path === "/api/admin/reports/occurrences") return json({ total:0, limit:50, offset:0, rows:[] });
    if (path === "/api/admin/reports/latest") return json({ total:0, limit:50, offset:0, rows:[] });
    throw Error("API não mockada: " + path);
  });
}
test("Administrador: ajuda contextual nos 5 indicadores e 7 cartões da visão geral", async ({ page }) => {
  await page.setViewportSize({ width:1366, height:900 });
  await mocks(page, admin);
  await page.goto("/admin/reports");
  await expect(page.locator(".report-kpis .report-info-button")).toHaveCount(5);
  await expect(page.locator(".report-reference-card .report-info-button")).toHaveCount(7);
  const card=page.locator(".report-reference-store-card");
  const info=card.getByRole("button", { name:"Sobre: Desempenho por loja" });
  const tooltip=card.getByRole("tooltip");
  await expect(tooltip).toBeHidden();
  await info.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("recebidos");
  await page.mouse.move(4,4);
  await expect(tooltip).toBeHidden();
  await info.focus();
  await expect(tooltip).toBeVisible();
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded","true");
  await page.keyboard.press("Escape");
  await expect(info).toHaveAttribute("aria-expanded","false");
  // Após Escape o hover ainda mostra a ajuda até o ponteiro sair do ícone.
  await page.mouse.move(4,4);
  await expect(tooltip).toBeHidden();
});
test("Visualizador: toque abre explicação e toque fora fecha", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await mocks(page, viewer);
  await page.goto("/admin/reports");
  const card=page.locator(".report-reference-store-card");
  const info=card.getByRole("button", { name:"Sobre: Desempenho por loja" });
  await expect(info).toBeVisible();
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded","true");
  await expect(card.getByRole("tooltip")).toBeVisible();
  await page.getByRole("heading", { name:"Resumo do período" }).click();
  await expect(info).toHaveAttribute("aria-expanded","false");
  await expect(card.getByRole("tooltip")).toBeHidden();
});
