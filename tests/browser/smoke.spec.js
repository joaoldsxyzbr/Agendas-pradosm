import { test, expect } from "@playwright/test";
const admin = { id:"adm1", nome:"Administrador teste", papel:"admin", login:"adm" };
const viewer = { id:"viewer1", nome:"Visualizador teste", papel:"visualizador", login:"viewer" };
const storeUser = { id:"conf1", nome:"Conferente teste", papel:"conferente", login:"conf", lojaId:"s1", lojaCodigo:"F03", lojaNome:"Loja Central" };
const stores = [{id:"s1",codigo:"F03",nome:"Loja Central",ativo:true,temConferenteAtivo:true}];
const appointment = {id:"appt1",protocol:"12345",startTime:"08:00",endTime:"09:00",supplier:"Fornecedor Teste",type:"CNPJ",items:1,volumes:2,pallets:0,cargaBatida:null,nfe:[],orders:[],status:"recebido",hasExchanges:false,origin:"importado",ativo:true};
let changes;
async function mocks(page, initial=null) {
  changes=[];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname, method = route.request().method();
    const json = data => route.fulfill({json:data});
    if(path==="/api/diagnostics/events")return route.fulfill({status:204});
    if(path==="/api/auth/me")return initial?json(initial):route.fulfill({status:401,json:{error:"UNAUTHORIZED"}});
    if(path==="/api/auth/login")return json(admin);
    if(path==="/api/auth/logout"||path==="/api/store/presence")return route.fulfill({status:204});
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path==="/api/admin/stores")return json(stores);
    if(path==="/api/admin/users")return json([{...storeUser,ativo:true},admin]);
    if(path==="/api/admin/presence")return json([]);
    if(path==="/api/admin/agendas")return json([{id:"agenda1",storeCode:"F03",storeName:"Loja Central",dayStatus:"aberto",total:1,recebido:1,aguardando:0,naoChegou:0,recusado:0,semAgenda:0}]);
    if(path.startsWith("/api/store/tags/agenda/"))return json({tags:[],assignments:{}});
    if(path==="/api/store/today"||path.startsWith("/api/store/history/"))return json({agenda:{id:"agenda1",date:"2026-10-18",storeCode:"F03",storeName:"Loja Central",dayStatus:"aberto",completedAt:null,completedBy:null},appointments:[appointment]});
    if(path==="/api/store/appointments/appt1/status"&&method==="PATCH"){
      const body=route.request().postDataJSON();changes.push(body);
      return json({...appointment,status:body.status});
    }
    throw Error("Rota não mockada: "+method+" "+path);
  });
}
test("Login nativo redireciona para dashboard", async ({page})=>{
  await mocks(page);
  await page.goto("/login");
  await expect(page.getByRole("heading",{name:"Entrar"})).toBeVisible();
  await page.locator('input[name="login"]').fill("adm");
  await page.locator('input[name="senha"]').fill("senha-teste");
  await page.getByRole("button",{name:"Entrar"}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Loja Central").first()).toBeVisible();
});
test("Visualizador não acessa cadastros",async({page})=>{
  await mocks(page,viewer);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('a[href="/admin/users"]')).toHaveCount(0);
});
test("Usuários mantém editor em popup",async({page})=>{
  await mocks(page,admin);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading",{name:"Usuários"})).toBeVisible();
  await page.locator('[data-edit-user-id="conf1"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Editar usuário"})).toBeVisible();
  await expect(page.locator(".registry-role").first()).toBeVisible();
});
test("Conferente repete recebido e volta para aguardando",async({page})=>{
  await mocks(page,storeUser);
  await page.goto("/app");
  await expect(page.getByText("Fornecedor Teste").first()).toBeVisible();
  await page.locator('[data-testid="agenda-desktop-row"] [data-status="recebido"]').click();
  await expect.poll(()=>changes.length).toBe(1);
  expect(changes[0]).toEqual({status:"aguardando",observation:null});
  await expect(page.locator('[data-metric="aguardando"]')).toHaveText("1");
});
test("Importação rejeita arquivo não permitido antes de gravar",async({page})=>{
  await mocks(page,admin);
  await page.goto("/admin/import");
  await page.locator("[data-import-file]").setInputFiles({
    name:"arquivo.exe",mimeType:"application/octet-stream",buffer:Buffer.from("x")
  });
  await expect(page.getByText("Selecione um arquivo CSV ou PDF.")).toBeVisible();
  expect(changes).toHaveLength(0);
});test("Importação em popup localiza o seletor, mantém foco e fecha com Escape",async({page})=>{
  await mocks(page,admin);
  await page.goto("/admin");
  const trigger=page.locator("[data-open-import]");
  await trigger.click();
  const dialog=page.locator('[data-import-backdrop] [role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(page.locator("#import-agenda-title")).toBeFocused();
  await expect(page.getByRole("button",{name:"Selecionar arquivo"})).toBeVisible();
  await expect(page.locator("[data-import-file-name]")).toHaveText("Nenhum arquivo selecionado");
  await page.evaluate(()=>{document.documentElement.dataset.theme="dark";});
  await expect(page.locator("[data-import-body]")).toHaveCSS("overflow-x","hidden");
  await page.locator("[data-import-file]").setInputFiles({
    name:"arquivo.exe",mimeType:"application/octet-stream",buffer:Buffer.from("x")
  });
  await expect(page.locator("[data-import-file-name]")).toHaveText("arquivo.exe");
  await expect(page.getByText("Selecione um arquivo CSV ou PDF.")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.locator("[data-import-close]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(changes).toHaveLength(0);
});