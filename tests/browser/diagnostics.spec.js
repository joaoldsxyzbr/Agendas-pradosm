import { test, expect } from "@playwright/test";
const admin = {id:"admin1",nome:"Administrador teste",papel:"admin"};
const viewer = {id:"viewer1",nome:"Visualizador teste",papel:"visualizador"};

test("administrador vê abas e filtra diagnósticos sem exibir segredos", async ({page}) => {
  const requests = [];
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/auth/me")return route.fulfill({json:admin});
    if(path==="/api/realtime/config")return route.fulfill({json:{mode:"off"}});
    if(path==="/api/admin/diagnostics"){
      requests.push(route.request().url());
      return route.fulfill({json:[{
        id:"d1",createdAt:"2026-10-22T10:30:00Z",source:"browser",
        level:"error",event:"IMPORT_READ_FAILED",operation:"importacao",
        format:"csv",count:null,httpStatus:null,correlationId:"a7650091-1122-4333-8444-555566667777",
        user:{id:"admin1",name:"Administrador teste"}
      }]});
    }
    if(path==="/api/admin/audit")return route.fulfill({json:[{
      id:"a1",createdAt:"2026-10-22T10:20:00Z",action:"agenda_importada",
      entity:"agenda",details:"9 lojas",user:{id:"admin1",name:"Administrador teste"}
    }]});
    return route.fulfill({status:404,json:{error:"NOT_FOUND"}});
  });
  await page.goto("/admin/diagnostics");
  await expect(page.getByRole("heading",{name:"Logs e Auditoria"})).toBeVisible();
  await expect(page.getByText("Falha na leitura do arquivo")).toBeVisible();
  await expect(page.locator("[data-diagnostics-results]")).not.toContainText("segredo");
  await page.locator('[name="operacao"]').selectOption("importacao");
  await page.locator("[data-diagnostics-form] button").click();
  await expect.poll(()=>requests.some(x=>x.includes("operacao=importacao"))).toBe(true);
  await page.locator('[data-diagnostics-tab="audit"]').click();
  await expect(page.getByText("agenda_importada")).toBeVisible();
  await page.locator('[data-diagnostics-tab="operations"]').click();
  await expect(page.getByText("Falha na leitura do arquivo")).toHaveCount(0);
});
test("visualizador não acessa logs técnicos", async ({page})=>{
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/auth/me")return route.fulfill({json:viewer});
    if(path==="/api/realtime/config")return route.fulfill({json:{mode:"off"}});
    if(path==="/api/admin/stores"||path==="/api/admin/agendas"||path==="/api/admin/presence")
      return route.fulfill({json:[]});
    return route.fulfill({json:[]});
  });
  await page.goto("/admin/diagnostics");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('a[href="/admin/diagnostics"]')).toHaveCount(0);
});
