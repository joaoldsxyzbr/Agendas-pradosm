import { test, expect } from "@playwright/test";
const user={id:"conf1",nome:"Conferente Teste",papel:"conferente",login:"conf",lojaId:"s1",lojaCodigo:"F03",lojaNome:"Loja Central"};
let calls=[];
const appointment={id:"appt1",protocol:"12345",startTime:"08:00",endTime:"09:00",supplier:"Fornecedor Teste",
 type:"Nota fiscal",items:1,volumes:2,pallets:0,cargaBatida:null,nfe:[],orders:[],status:"aguardando",
 hasExchanges:false,observation:null,origin:"imported",ativo:true};
async function mocks(page) {
 calls=[];
 await page.route("**/api/**",async route=>{
  const path=new URL(route.request().url()).pathname, method=route.request().method();
  const json=data=>route.fulfill({json:data});
  if(path==="/api/auth/me")return json(user);
  if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
  if(path==="/api/store/today"||path.startsWith("/api/store/history/"))return json({
   agenda:{id:"agenda1",date:"2026-10-19",storeCode:"F03",storeName:"Loja Central",dayStatus:"aberto",completedAt:null},
   appointments:[appointment]
  });
  if(path==="/api/store/presence")return route.fulfill({status:204});
  if(path==="/api/store/appointments/appt1/status"&&method==="PATCH"){
    const body=route.request().postDataJSON();calls.push(body);
    appointment.status=body.status;appointment.observation=body.observation;
    return json({...appointment});
  }
  if(path==="/api/store/appointments/appt1/observation"&&method==="PATCH"){
    const body=route.request().postDataJSON();calls.push(body);
    appointment.observation=body.observation;
    return json({...appointment});
  }
  throw Error("Rota não mockada: "+method+" "+path);
 });
}
test("Não recebido exige motivo e outros exige texto",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mocks(page);await page.goto("/app");
 await page.locator('[data-testid="agenda-desktop-row"] [data-status="nao_chegou"]').click();
 const dialog=page.locator(".observation-dialog");
 await expect(dialog).toBeVisible();
 expect(calls).toHaveLength(0);
 await dialog.locator("[data-observation-reason]").selectOption("Outros");
 await expect(dialog.locator("[data-observation-custom-wrap]")).toBeVisible();
 await dialog.locator("[data-observation-custom]").fill("Motorista sem documento");
 await dialog.locator("[data-observation-save]").click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator(".agenda-observation-cell")).toContainText("Outros: Motorista sem documento");
 expect(calls).toEqual([{status:"nao_chegou",observation:"Outros: Motorista sem documento"}]);
 await page.locator('[data-testid="agenda-desktop-row"] [data-edit-observation="appt1"]').click();
 await expect(page.locator("[data-observation-reason]")).toHaveValue("Outros");
 await expect(page.locator("[data-observation-custom]")).toHaveValue("Motorista sem documento");
 await page.locator("[data-observation-cancel]").last().click();
 await page.locator('[data-testid="agenda-desktop-row"] [data-status="nao_chegou"]').click();
 await expect(page.locator(".agenda-observation-cell")).toContainText("Obs.");
 await expect.poll(()=>calls.length).toBe(2);
 expect(calls[1]).toEqual({status:"aguardando",observation:null});
});
test("Cancelamento não altera status e cinco motivos aparecem no mobile",async({page})=>{
 appointment.status="aguardando";appointment.observation=null;
 await page.setViewportSize({width:390,height:844});
 await mocks(page);await page.goto("/app");
 await page.locator('[data-testid="agenda-mobile-card"] [data-status="nao_chegou"]').click();
 const dialog=page.locator(".observation-dialog");
 await expect(dialog).toBeVisible();
 await expect(dialog.locator("option")).toHaveCount(7);
 await dialog.locator("[data-observation-cancel]").last().click();
 expect(calls).toHaveLength(0);
 await expect(page.locator('[data-testid="agenda-mobile-card"] .status-aguardando')).toBeVisible();
});

for (const scenario of [
 {name:"desktop",viewport:{width:1440,height:900},container:'[data-testid="agenda-desktop-row"]'},
 {name:"mobile",viewport:{width:390,height:844},container:'[data-testid="agenda-mobile-card"]'}
]) {
 test("Motivos predefinidos ocultam descrição no "+scenario.name,async({page})=>{
  appointment.status="aguardando";appointment.observation=null;
  await page.setViewportSize(scenario.viewport);
  await mocks(page);await page.goto("/app");
  await page.locator(scenario.container+' [data-status="nao_chegou"]').click();
  const dialog=page.locator(".observation-dialog");
  const reason=dialog.locator("[data-observation-reason]");
  const custom=dialog.locator("[data-observation-custom-wrap]");
  await expect(dialog).toBeVisible();
  await expect(custom).toBeHidden();
  for(const preset of ["Sem agenda","Sem pedido","Sem boleto","Prazo de pagamento incorreto","Temperatura acima do OK"]) {
   await reason.selectOption(preset);
   await expect(custom).toBeHidden();
  }
  await reason.selectOption("Outros");
  await expect(custom).toBeVisible();
  await expect(dialog.locator("[data-observation-custom]")).toHaveAttribute("required","");
  await reason.selectOption("Sem pedido");
  await expect(custom).toBeHidden();
  await expect(dialog.locator("[data-observation-custom]")).not.toHaveAttribute("required","");
  await dialog.locator("[data-observation-save]").click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toEqual([{status:"nao_chegou",observation:"Sem pedido"}]);
  await expect(page.locator(scenario.container+" .status-nao_chegou")).toBeVisible();
 });
}