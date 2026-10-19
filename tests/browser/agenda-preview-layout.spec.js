import { test, expect } from "@playwright/test";

const admin = { id:"adm1", nome:"Admin teste", papel:"admin", login:"adm" };
const stores = [{id:"s1",codigo:"F03",nome:"Loja Central",ativo:true,temConferenteAtivo:true}];
const appointment = {id:"appt1",protocol:"12345",startTime:"08:00",endTime:"09:00",
  supplier:"FORNECEDOR DE TESTE DISTRIBUIDORA",type:"CNPJ",items:1,volumes:2,
  pallets:0,cargaBatida:null,nfe:[],orders:[],status:"recebido",
  hasExchanges:false,origin:"importado",ativo:true};

async function mockDashboard(page) {
  await page.route("**/api/**", async route => {
    const path=new URL(route.request().url()).pathname;
    const json=data=>route.fulfill({json:data});
    if(path==="/api/auth/me")return json(admin);
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path==="/api/admin/stores")return json(stores);
    if(path==="/api/admin/presence")return json([]);
    if(path==="/api/admin/agendas")return json([{id:"agenda1",storeId:"s1",
      storeCode:"F03",storeName:"Loja Central",date:"2026-10-19",dayStatus:"aberto",
      total:1,recebido:1,aguardando:0,naoChegou:0,recusado:0,semAgenda:0}]);
    if(path==="/api/admin/agendas/agenda1")return json({
      agenda:{id:"agenda1",storeCode:"F03",storeName:"Loja Central",
        date:"2026-10-19",dayStatus:"aberto",completedAt:null,completedBy:null},
      appointments:[appointment]
    });
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    if(path==="/api/auth/logout")return route.fulfill({status:204});
    throw Error("API não mockada: "+path);
  });
}

test("Popup de agenda ocupa largura integral e preserva ações",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await mockDashboard(page);
  await page.goto("/admin");
  await page.locator('[data-agenda-id="agenda1"]').click();
  const modal=page.locator(".agenda-preview-modal");
  const content=modal.locator("[data-preview-content]");
  const list=modal.locator("[data-preview-list]");
  await expect(modal).toBeVisible();
  await expect(content).toBeVisible();
  await expect(modal.locator('[data-preview-search]')).toBeVisible();
  await expect(list.locator('[data-testid="agenda-desktop-row"]')).toHaveCount(1);
  const geometry=await modal.evaluate(el=>{
    const box=node=>node.getBoundingClientRect();
    const section=el.querySelector("[data-preview-content]");
    const list=el.querySelector("[data-preview-list]");
    const table=el.querySelector("[data-agenda-desktop]");
    const scroll=el.querySelector(".table-scroll");
    const metrics=el.querySelector(".agenda-metrics");
    const metricsCards=metrics.querySelectorAll(".agenda-metric");
    const search=el.querySelector(".agenda-toolbar");
    const context=el.querySelector(".agenda-preview-context");
    const actions=el.querySelector(".agenda-preview-status");
    return {section:box(section).width,list:box(list).width,table:box(table).width,
      scroll:box(scroll).width,scrollWidth:scroll.scrollWidth,
      metricsWidth:box(metrics).width,searchWidth:box(search).width,
      metricsTop:box(metrics).top,searchTop:box(search).top,
      metricsRight:box(metrics).right,searchLeft:box(search).left,
      contextWidth:box(context).width,actionsRight:box(actions).right,
      contextRight:box(context).right,cards:[...metricsCards].map(card=>box(card).width),
      sectionGrid:getComputedStyle(section).gridTemplateColumns};
  });
  expect(geometry.list).toBeGreaterThan(geometry.section*0.9);
  expect(geometry.table).toBeGreaterThan(geometry.section*0.9);
  expect(geometry.scroll).toBeGreaterThan(geometry.section*0.9);
  expect(Math.abs(geometry.metricsTop-geometry.searchTop)).toBeLessThan(12);
  expect(geometry.metricsRight).toBeLessThanOrEqual(geometry.searchLeft+1);
  expect(geometry.searchLeft-geometry.metricsRight).toBeLessThan(26);
  expect(geometry.cards).toHaveLength(5);
  expect(Math.min(...geometry.cards)).toBeGreaterThan(95);
  expect(geometry.contextWidth).toBeGreaterThan(geometry.section*0.9);
  expect(geometry.contextRight-geometry.actionsRight).toBeLessThan(30);
  await modal.locator("[data-preview-search]").fill("NÃO EXISTE");
  await expect(modal.locator("[data-preview-empty]")).toBeVisible();
  await modal.locator("[data-preview-search]").fill("");
  await expect(list.locator('[data-testid="agenda-desktop-row"]')).toHaveCount(1);
  await modal.locator("[data-preview-edit]").click();
  await expect(modal.locator("[data-preview-add]")).toBeVisible();
  await modal.locator("[data-preview-close]").click();
  await expect(modal).toHaveCount(0);
});

test("Popup de agenda fica legível no celular",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockDashboard(page);
  await page.goto("/admin");
  await page.locator(".dashboard-operation-table .table-scroll").evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await page.locator('[data-agenda-id="agenda1"]').click();
  const modal=page.locator(".agenda-preview-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-preview-search]")).toBeVisible();
  await expect(modal.locator('[data-testid="agenda-mobile-card"]')).toBeVisible();
  const rect=await modal.boundingBox();
  expect(rect.width).toBeLessThanOrEqual(390);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  await modal.locator("[data-preview-close]").click();
  await expect(modal).toHaveCount(0);
});