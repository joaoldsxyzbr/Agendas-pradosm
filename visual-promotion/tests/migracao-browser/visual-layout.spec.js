import { test, expect } from "@playwright/test";
const admin = { id:"a1", nome:"Administrador Visual", papel:"admin", login:"adm" };
const stores = [{ id:"s1",codigo:"F03",nome:"Loja Central",ativo:true,temConferenteAtivo:true }];
const conf = { id:"c1", nome:"Conferente", papel:"conferente", login:"c1", lojaId:"s1" };
async function mocks(page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = data => route.fulfill({json:data});
    if(path === "/api/auth/me") return json(admin);
    if(path === "/api/realtime/config") return json({mode:"off",protocolVersion:1});
    if(path === "/api/admin/stores") return json(stores);
    if(path === "/api/admin/users") return json([admin,conf]);
    if(path === "/api/admin/presence") return json([]);
    if(path === "/api/admin/agendas") return json([]);
    if(path === "/api/auth/bootstrap-status") return json({available:false});
    if(path === "/api/auth/logout") return route.fulfill({status:204});
    throw Error("API não mockada: " + path);
  });
}
test("Menu lateral compacto e breadcrumb sincronizado", async ({page}) => {
  await mocks(page);
  await page.goto("/admin/users");
  const nav = page.locator(".prado-sidebar .prado-side-nav");
  const items = nav.locator(".nav-link");
  await expect(items).toHaveCount(3);
  await expect(nav).toBeVisible();
  const rects = await items.evaluateAll(links => links.map(link => {
    const r=link.getBoundingClientRect();
    return {height:r.height,top:r.top,display:getComputedStyle(link).display};
  }));
  for (let i=0; i<rects.length;i++) {
    expect(rects[i].height).toBeGreaterThanOrEqual(40);
    expect(rects[i].height).toBeLessThanOrEqual(50);
    if(i) expect(rects[i].top-rects[i-1].top).toBeLessThanOrEqual(55);
  }
  await expect(page.locator(".prado-topbar-breadcrumb strong")).toHaveText("Usuários");
  await items.filter({hasText:"Lojas"}).click();
  await expect(page).toHaveURL(/\/admin\/stores$/);
  await expect(page.locator(".prado-topbar-breadcrumb strong")).toHaveText("Lojas");
  await expect(items.filter({hasText:"Lojas"})).toHaveAttribute("aria-current","page");
});
test("Menu mobile usa abas horizontais pequenas", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await mocks(page);
  await page.goto("/admin/users");
  await expect(page.locator(".prado-sidebar")).toBeHidden();
  const menu=page.locator(".prado-mobile-nav");
  await expect(menu).toBeVisible();
  const heights=await menu.locator(".nav-link").evaluateAll(items=>items.map(item=>item.getBoundingClientRect().height));
  expect(heights).toHaveLength(3);
  expect(heights.every(h=>h>=30&&h<=42)).toBe(true);
  await expect(page.locator(".prado-topbar-breadcrumb strong")).toHaveText("Usuários");
});
