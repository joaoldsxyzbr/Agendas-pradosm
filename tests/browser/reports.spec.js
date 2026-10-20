import { test,expect } from "@playwright/test";
const viewer={id:"v1",nome:"Visualizador",papel:"visualizador",login:"viewer"};
const admin={id:"a1",nome:"Administrador",papel:"admin",login:"admin"};
const stores=[{id:"s1",codigo:"F01",nome:"Centro",ativo:true,temConferenteAtivo:true}];
const report={start:"2026-10-01",end:"2026-10-19",storeCode:null,
 rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",
 total:5,recebido:3,naoChegou:1,aguardando:1,semConferencia:0,recusado:0,semAgenda:1},
 {date:"2026-10-18",storeCode:"F01",storeName:"Centro",dayStatus:"concluido",
 total:2,recebido:1,naoChegou:0,aguardando:0,semConferencia:1,recusado:0,semAgenda:0}],
 suppliers:[{supplier:"Fornecedor Teste",total:4,recebido:3,naoChegou:1}]};
const occ={total:1,offset:0,limit:50,rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",
 supplier:"Fornecedor Teste",protocol:"123456",observation:"Sem pedido",origin:"importado"}]};
async function mocks(page,user){
 const requests=[];const searches=[];
 await page.route("**/api/**",route=>{
   const u=new URL(route.request().url());requests.push(u.pathname);searches.push(u.search);
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
 return {requests,searches};
}
const businessDay=()=>{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const map=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return map.year+"-"+map.month+"-"+map.day;
};
const shift=(day,n)=>{const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
for(const [label,user] of [["administrador",admin],["visualizador",viewer]]){
 test("Relatório gerencial nativo — "+label,async({page})=>{
   await page.setViewportSize({width:1366,height:900});
   const {requests}=await mocks(page,user);
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
   await expect(page.getByRole("heading", {name:"Por loja", exact:true})).toBeVisible();
   await expect(page.getByRole("heading", {name:"Ocorrências e observações"})).toBeVisible();
   const filter=page.locator("[data-report-filters]");
   await filter.locator('[name="store"]').selectOption("F01");
   await filter.getByRole("button",{name:"Aplicar filtros"}).click();
   await expect(page.locator(".report-kpis")).toBeVisible();
   expect(requests.filter(x=>x==="/api/admin/reports").length).toBeGreaterThan(0);
   expect(requests.some(x=>/\/api\/admin\/(?:users|agendas\/import)/.test(x))).toBe(false);
 });
}
test("Atalhos de período, alternância do gráfico, busca de ocorrências e padrão semanal",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  const {requests,searches}=await mocks(page,viewer);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
  await expect(page.locator("[data-report-preset]")).toHaveCount(4);
  await expect(page.locator("[data-report-preset=\"30\"]")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".report-metric-delta").first()).toContainText("vs. período anterior");
  await expect(page.getByRole("heading",{name:"Padrão por dia da semana"})).toBeVisible();
  await expect(page.locator(".report-weekdays .report-progress-item span").first()).toHaveText("Segunda-feira");
  await expect(page.locator(".manager-report")).toContainText("Taxa de recebimento no período");
  const today=businessDay();
  await page.getByRole("button",{name:"Últimos 7 dias"}).click();
  await expect(page.locator("[name=\"start\"]")).toHaveValue(shift(today,-6));
  await expect(page.locator("[name=\"end\"]")).toHaveValue(today);
  await expect(page.locator("[data-report-preset=\"7\"]")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("[data-report-preset=\"30\"]")).toHaveAttribute("aria-pressed","false");
  const chartRequests=()=>requests.filter(x=>x==="/api/admin/reports").length;
  const beforeToggle=chartRequests();
  await page.locator("[data-report-chart-mode=\"rate\"]").click();
  const lineType=await page.locator("[data-report-chart-canvas]").evaluate(canvas=>window.Chart?.getChart(canvas)?.config.type);
  expect(lineType).toBe("line");
  await expect(page.locator("[data-report-native-chart]")).toBeHidden();
  await expect(page.locator("[data-report-rate-native]")).toBeHidden();
  await page.locator("[data-report-chart-mode=\"volume\"]").click();
  const barType=await page.locator("[data-report-chart-canvas]").evaluate(canvas=>window.Chart?.getChart(canvas)?.config.type);
  expect(barType).toBe("bar");
  expect(chartRequests()).toBe(beforeToggle);
  await page.getByLabel("Buscar ocorrência por fornecedor ou protocolo").fill("Fornecedor");
  await page.locator("[data-report-search] button[type=\"submit\"]").click();
  await expect.poll(()=>searches.filter(x=>x.includes("q=Fornecedor")).length).toBeGreaterThan(0);
  await expect(page.locator("[data-report-clear-search]")).toBeVisible();
  await page.locator("[data-report-clear-search]").click();
  await expect(page.locator("[data-report-clear-search]")).toHaveCount(0);
});
test("Falha de carregamento do Chart.js preserva o gráfico HTML",async({page})=>{
  await page.route("**/vendor/chart.umd.min.js",route=>route.abort());
  await mocks(page,viewer);
  await page.goto("/admin/reports");
  await expect(page.locator("[data-report-native-chart] .report-chart")).toBeVisible();
  await expect(page.locator("[data-report-chart-wrap]")).toBeHidden();
  await expect(page.locator(".report-kpis")).toContainText("Recebidos");
});