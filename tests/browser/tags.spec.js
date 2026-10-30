import { test, expect } from "@playwright/test";
const user={id:"conf",nome:"Conferente",papel:"conferente",lojaId:"s1",lojaNome:"CD Doca 01",lojaCodigo:"CD"};
const tag={id:"00000000-0000-4000-8000-000000000001",name:"Prioridade",color:"roxo"};
const appointment={id:"a1",supplier:"FORNECEDOR SINTÉTICO",protocol:"1",startTime:"08:00",endTime:"09:00",
  type:"Nota fiscal",status:"aguardando",hasExchanges:false,origin:"imported",observation:null};
test("conferente cadastra tag e marca fornecedor no mesmo fluxo",async({page})=>{
  let tags=[],assigned=[];
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    const method=route.request().method();
    const json=data=>route.fulfill({json:data});
    if(path==="/api/auth/me")return json(user);
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path==="/api/store/presence")return route.fulfill({status:204});
    if(path==="/api/store/tags"&&method==="GET")return json(tags);
    if(path==="/api/store/tags"&&method==="POST"){tags=[{...tag,...route.request().postDataJSON()}];return route.fulfill({status:201,json:tags[0]});}
    if(path.startsWith("/api/store/tags/agenda/"))return json({tags,assignments:{a1:assigned}});
    if(path==="/api/store/tags/appointments/a1"&&method==="PUT"){
      assigned=tags.filter(x=>route.request().postDataJSON().tagIds.includes(x.id));return json({tags:assigned});
    }
    if(path==="/api/store/today")return json({agenda:{id:"agenda1",date:"2026-10-30",dayStatus:"aberto"},appointments:[appointment]});
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    throw Error("Rota não mockada: "+method+" "+path);
  });
  await page.goto("/app/tags");
  await expect(page.locator(".tags-page").getByRole("heading",{name:"Tags de fornecedores"})).toBeVisible();
  await page.locator('[name="name"]').fill("Prioridade");
  await page.locator('[name="color"]').selectOption("roxo");
  await page.getByRole("button",{name:"Criar tag"}).click();
  await expect(page.locator(".tags-list-item .supplier-tag")).toHaveText("Prioridade");
  await page.locator('.prado-store-side-nav a[href="/app"]').click();
  await expect(page.locator(".agenda-desktop .supplier-tag-add")).toBeVisible();
  await page.locator(".agenda-desktop .supplier-tag-add").click();
  await page.getByRole("dialog").getByText("Prioridade").click();
  await page.getByRole("dialog").getByRole("button",{name:"Salvar tags"}).click();
  await expect(page.locator(".agenda-desktop .supplier-tag")).toHaveText("Prioridade");
  await expect(page.locator(".agenda-desktop td").nth(1)).toContainText("FORNECEDOR SINTÉTICO");
  await expect(page.locator(".prado-store-side-nav a.active")).toHaveAttribute("href","/app");
});
