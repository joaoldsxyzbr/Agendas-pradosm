import { test,expect } from "@playwright/test";
const viewer={id:"v1",nome:"Visualizador",papel:"visualizador",login:"viewer"};
const admin={id:"a1",nome:"Administrador",papel:"admin",login:"admin"};
const stores=[{id:"s1",codigo:"F01",nome:"Centro",ativo:true,temConferenteAtivo:true}];
const report={start:"2026-10-01",end:"2026-10-19",storeCode:null,
 rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",
 total:5,recebido:3,naoChegou:1,aguardando:1,recusado:0,semAgenda:1}],
 suppliers:[{supplier:"Fornecedor Teste",naoChegou:1}]};
const occ={total:1,offset:0,limit:50,rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",
 supplier:"Fornecedor Teste",protocol:"123456",observation:"Sem pedido",origin:"importado"}]};
async function mocks(page,user){
 const requests=[];
 await page.route("**/api/**",route=>{
   const u=new URL(route.request().url());requests.push(u.pathname);
   const json=data=>route.fulfill({json:data});
   if(u.pathname==="/api/auth/me")return json(user);
   if(u.pathname==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
   if(u.pathname==="/api/admin/stores")return json(stores);
   if(u.pathname==="/api/admin/presence")return json([]);
   if(u.pathname==="/api/admin/agendas")return json([]);
   if(u.pathname==="/api/admin/reports")return json(report);
   if(u.pathname==="/api/admin/reports/occurrences")return json(occ);
   throw Error("API inesperada: "+u.pathname);
 });
 return requests;
}
for(const [label,user] of [["administrador",admin],["visualizador",viewer]]){
 test("Relatório gerencial nativo — "+label,async({page})=>{
   await page.setViewportSize({width:1366,height:900});
   const requests=await mocks(page,user);
   await page.goto("/admin");
   const nav=page.locator(".prado-sidebar");
   await expect(nav.getByRole("link",{name:"Relatório Gerencial"})).toBeVisible();
   if(user.papel==="visualizador"){
     await expect(nav.getByRole("link",{name:"Usuários"})).toHaveCount(0);
     await expect(nav.getByRole("link",{name:"Lojas"})).toHaveCount(0);
   }
   await nav.getByRole("link",{name:"Relatório Gerencial"}).click();
   await expect(page).toHaveURL(/\/admin\/reports$/);
   await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
   await expect(page.locator(".prado-topbar-breadcrumb strong")).toHaveText("Relatório Gerencial");
   await expect(page.locator(".report-kpis")).toContainText("Recebidos");
   await expect(page.locator(".report-kpis")).toContainText("3");
   await expect(page.locator(".report-chart")).toBeVisible();
   await expect(page.locator(".manager-report")).toContainText("Sem pedido");
   const filter=page.locator("[data-report-filters]");
   await filter.locator('[name="store"]').selectOption("F01");
   await filter.getByRole("button",{name:"Aplicar filtros"}).click();
   await expect(page.locator(".report-kpis")).toBeVisible();
   expect(requests.filter(x=>x==="/api/admin/reports").length).toBeGreaterThan(0);
   expect(requests.some(x=>/\/api\/admin\/(?:users|agendas\/import)/.test(x))).toBe(false);
 });
}
