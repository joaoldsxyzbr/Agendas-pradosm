import { test,expect } from "@playwright/test";
const viewer={id:"v1",nome:"Visualizador",papel:"visualizador",login:"viewer"};
const admin={id:"a1",nome:"Administrador",papel:"admin",login:"admin"};
const stores=[{id:"s1",codigo:"F01",nome:"Centro",ativo:true,temConferenteAtivo:true}];
const report={start:"2026-10-01",end:"2026-10-19",storeCode:null,
 rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",
 total:5,recebido:3,naoChegou:1,aguardando:1,semConferencia:0,recusado:0,semAgenda:1},
 {date:"2026-10-18",storeCode:"F01",storeName:"Centro",dayStatus:"concluido",
 total:2,recebido:1,naoChegou:0,aguardando:0,semConferencia:1,recusado:0,semAgenda:0}],
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
   await expect(page.locator(".report-kpis")).toContainText("4");
   await expect(page.locator(".report-metric")).toHaveCount(7);
   await expect(page.locator(".report-metric").filter({has:page.locator(".report-metric-heading > span", {hasText:/^Aguardando$/})})).toContainText("1");
   await expect(page.locator(".report-metric").filter({has:page.locator(".report-metric-heading > span", {hasText:/^Sem conferência$/})})).toContainText("1");
   await expect(page.locator(".manager-report")).toContainText("Sem conferência");
   await expect(page.locator("[data-report-chart-wrap]")).toBeVisible();
   await expect(page.locator("[data-report-native-chart]")).toBeHidden();
   const data=await page.locator("[data-report-chart-canvas]").evaluate(canvas=>{
     const instance=window.Chart?.getChart(canvas);
     return {type:instance?.config.type,received:instance?.data.datasets?.[0]?.data?.[0],
       missed:instance?.data.datasets?.[1]?.data?.[0]};
   });
   expect(data).toEqual({type:"bar",received:1,missed:0});
   await expect(page.locator(".manager-report")).toContainText("Sem pedido");
   await expect(page.getByRole("heading", {name:"Por data"})).toHaveCount(0);
   await expect(page.getByRole("heading", {name:"Por loja"})).toBeVisible();
   await expect(page.getByRole("heading", {name:"Ocorrências e observações"})).toBeVisible();
   const filter=page.locator("[data-report-filters]");
   await filter.locator('[name="store"]').selectOption("F01");
   await filter.getByRole("button",{name:"Aplicar filtros"}).click();
   await expect(page.locator(".report-kpis")).toBeVisible();
   expect(requests.filter(x=>x==="/api/admin/reports").length).toBeGreaterThan(0);
   expect(requests.some(x=>/\/api\/admin\/(?:users|agendas\/import)/.test(x))).toBe(false);
 });
}
test("Falha de carregamento do Chart.js preserva o gráfico HTML",async({page})=>{
  await page.route("**/vendor/chart.umd.min.js",route=>route.abort());
  await mocks(page,viewer);
  await page.goto("/admin/reports");
  await expect(page.locator("[data-report-native-chart] .report-chart")).toBeVisible();
  await expect(page.locator("[data-report-chart-wrap]")).toBeHidden();
  await expect(page.locator(".report-kpis")).toContainText("Recebidos");
});