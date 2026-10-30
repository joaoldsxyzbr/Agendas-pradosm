import { test, expect } from "@playwright/test";

const user = { id:"conferente",nome:"Conferente Teste",papel:"conferente",login:"conf",lojaId:"s1",lojaCodigo:"F03",lojaNome:"Loja Central" };
const appointments = [
 {id:"a1",supplier:"FORNECEDOR TESTE",protocol:"1234",type:"Nota fiscal",
 startTime:"08:00",endTime:"08:30",status:"aguardando",ativo:true,
 items:1,volumes:3,pallets:1,cargaBatida:null,nfe:[],orders:[],hasExchanges:false,origin:"importado"}
];
async function mockApi(page) {
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    const method=route.request().method();
    const json=x=>route.fulfill({json:x});
    if(path==="/api/auth/me")return json(user);
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path.startsWith("/api/store/tags/agenda/"))return json({tags:[],assignments:{}});
    if(path==="/api/store/today"||path.startsWith("/api/store/history/"))return json({
      agenda:{id:"agenda1",date:"2026-10-19",storeCode:"F03",storeName:"Loja Central",dayStatus:"aberto",completedAt:null},
      appointments
    });
    if(path==="/api/store/presence")return route.fulfill({status:204});
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    if(path==="/api/store/appointments/a1/status"&&method==="PATCH")return json({...appointments[0],status:route.request().postDataJSON().status});
    throw Error("Rota não mockada: "+method+" "+path);
  });
}
test("Conferente ganha sidebar e resumo em cards, preservando comandos",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await mockApi(page);
  await page.goto("/app");
  const shell=page.locator(".prado-store-layout");
  await expect(shell).toBeVisible();
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  await expect(page.locator(".prado-store-sidebar")).toBeVisible();
  const sidebarToggle=page.locator("[data-sidebar-toggle]");
  await expect(sidebarToggle).toHaveAttribute("aria-expanded","false");
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute("aria-expanded","true");
  await expect(page.locator(".prado-store-side-nav a").first()).toHaveAttribute("href","/app");
  await expect(page.locator(".prado-store-sidebar a[href='/admin']")).toHaveCount(0);
  await expect(page.locator(".agenda-metrics [data-metric]")).toHaveCount(5);
  await expect(page.locator(".prado-store-agenda-panel")).toBeVisible();
  await expect(page.locator("[data-agenda-command-slot] .agenda-command-bar")).toBeVisible();
  await expect(page.locator("[data-store-complete]")).toBeVisible();
  await expect(page.locator("[data-store-pdf]")).toBeVisible();
  await expect(page.locator("[data-add-manual]")).toBeVisible();
  const positions=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect();
    return {sidebar:rect(".prado-store-sidebar").width,
      summary:rect(".agenda-metrics").width,
      firstCard:rect(".agenda-metrics>span").height,
      panel:rect(".prado-store-agenda-panel").width};
  });
  expect(positions.sidebar).toBeGreaterThan(180);
  expect(positions.firstCard).toBeGreaterThan(85);
  expect(positions.firstCard).toBeLessThan(125);
  const visual=await page.evaluate(()=>{
    const metrics=document.querySelector(".agenda-metrics>span");
    const cell=document.querySelector(".agenda-desktop tbody td");
    const panel=document.querySelector(".prado-store-agenda-panel");
    const heading=document.querySelector(".prado-store-agenda-panel-heading");
    return {
      metricLayout:getComputedStyle(metrics).display,
      metricIcon:metrics.querySelector(".metric-icon")?.textContent?.trim(),
      metricPct:metrics.querySelector("[data-percent]")?.textContent?.trim(),
      tablePadding:parseFloat(getComputedStyle(cell).paddingTop),
      panelColor:getComputedStyle(panel).backgroundColor,
      headingHeight:heading.getBoundingClientRect().height,
      pageOverflow:document.documentElement.scrollWidth-window.innerWidth
    };
  });
  expect(visual.metricLayout).toBe("grid");
  expect(visual.metricIcon).toBeTruthy();
  expect(visual.metricPct).toBe("100% do dia");
  expect(visual.tablePadding).toBeLessThanOrEqual(10);
  expect(visual.headingHeight).toBeLessThan(105);
  expect(visual.pageOverflow).toBeLessThanOrEqual(2);
  expect(visual.panelColor).toBe("rgb(23, 38, 53)");
  expect(positions.panel).toBeGreaterThan(positions.summary*0.9);
  await expect(page.locator('[data-testid="agenda-desktop-row"]')).toHaveCount(1);
  await page.locator("[data-agenda-search]").fill("não encontrado");
  await expect(page.locator("[data-search-empty]")).toBeVisible();
});
test("Conferente responsivo preserva conteúdo e botões",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockApi(page);
  await page.goto("/app");
  await expect(page.locator(".prado-store-sidebar")).toBeHidden();
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  await expect(page.locator(".agenda-metrics [data-metric]")).toHaveCount(5);
  await expect(page.locator('[data-testid="agenda-mobile-card"]')).toBeVisible();
  await expect(page.locator("[data-store-complete]")).toBeVisible();
  await expect(page.locator("[data-logout]")).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});