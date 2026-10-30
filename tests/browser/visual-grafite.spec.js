import { test, expect } from "@playwright/test";

// Contrato visual em dados sintéticos; nunca acessa D1 remoto.
const admin={id:"adm",nome:"Administrador",papel:"admin",login:"admin"};
const conferente={id:"conf",nome:"Conferente",papel:"conferente",login:"conf",lojaId:"s1",lojaCodigo:"F01",lojaNome:"Centro"};
const lojas=[{id:"s1",codigo:"F01",nome:"Centro",ativo:true,temConferenteAtivo:true}];
const compromisso={id:"a1",supplier:"Fornecedor exemplo",protocol:"P001",type:"Nota fiscal",
  startTime:"09:00",endTime:"09:30",status:"aguardando",ativo:true,
  items:1,volumes:1,pallets:0,cargaBatida:null,nfe:[],orders:[],hasExchanges:false,origin:"importado"};
async function mock(page,user) {
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    const json=value=>route.fulfill({json:value});
    if(path==="/api/auth/me")return json(user);
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path==="/api/admin/stores")return json(lojas);
    if(path==="/api/admin/users")return json([admin,conferente]);
    if(path==="/api/admin/agendas")return json([]);
    if(path==="/api/admin/presence")return json([]);
    if(path==="/api/admin/reports")return json({rows:[],suppliers:[]});
    if(path==="/api/admin/reports/occurrences")return json({total:0,offset:0,limit:50,rows:[]});
    if(path==="/api/admin/reports/latest")return json({total:0,offset:0,limit:50,rows:[]});
    if(path.startsWith("/api/store/tags/agenda/"))return json({tags:[],assignments:{}});
    if(path==="/api/store/today"||path.startsWith("/api/store/history/"))return json({
      agenda:{id:"agenda",date:"2026-10-20",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",completedAt:null},
      appointments:[compromisso]
    });
    if(path==="/api/store/presence")return route.fulfill({status:204});
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    throw Error("API inesperada: "+path);
  });
}

test("Fundação visual preserva páginas e tokens corporativos",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await mock(page,admin);
  await page.goto("/admin");
  await expect(page.getByRole("heading",{name:"Recebimento",exact:true})).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color","rgb(16, 25, 35)");
  await expect(page.locator(".prado-side-nav .nav-link.active")).toBeVisible();
  await expect(page.locator(".dashboard-operation-summary")).toBeVisible();
  await expect(page.locator(".dashboard-operation-table")).toBeVisible();
  const tokens=await page.evaluate(()=>{
    const style=getComputedStyle(document.documentElement);
    return {surface:style.getPropertyValue("--prado-surface").trim(),
      border:style.getPropertyValue("--prado-border").trim(),
      accent:style.getPropertyValue("--prado-action").trim()};
  });
  expect(tokens).toEqual({surface:"#172635",border:"#344d66",accent:"#70aeff"});
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
  await expect(page.locator(".manager-report .report-filters")).toBeAttached();
  await page.goto("/admin/stores");
  await expect(page.getByRole("heading",{name:"Lojas"})).toBeVisible();
  await expect(page.locator(".registry-toolbar")).toBeVisible();
  await page.goto("/admin/users");
  await expect(page.getByRole("heading",{name:"Usuários"})).toBeVisible();
  await expect(page.locator(".registry-toolbar")).toBeVisible();
});

test("Navegação do administrador recolhe em telas de notebook e memoriza a escolha",async({page})=>{
  await page.setViewportSize({width:1288,height:686});
  await mock(page,admin);
  await page.goto("/admin");
  const shell=page.locator(".prado-admin.admin-shell");
  const sidebar=page.locator(".prado-sidebar");
  const toggle=page.locator("[data-sidebar-toggle]");
  await expect(shell).toHaveAttribute("data-sidebar-collapsed","true");
  await expect(toggle).toHaveAttribute("aria-expanded","false");
  await expect(sidebar).toHaveCSS("width","72px");
  await expect(page.locator(".prado-side-nav").getByRole("link",{name:"Recebimento",exact:true})).toBeVisible();
  await toggle.click();
  await expect(shell).toHaveAttribute("data-sidebar-collapsed","false");
  await expect(toggle).toHaveAttribute("aria-expanded","true");
  await expect(sidebar).toHaveCSS("width","232px");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded","true");
  await expect(sidebar).toHaveCSS("width","232px");
});

test("Navegação do conferente compacta a tabela sem rolar a página para o lado",async({page})=>{
  await page.setViewportSize({width:1288,height:686});
  await mock(page,conferente);
  await page.goto("/app");
  const shell=page.locator(".prado-store-layout.store-shell");
  const sidebar=page.locator(".prado-store-sidebar");
  const toggle=page.locator("[data-sidebar-toggle]");
  await expect(shell).toHaveAttribute("data-sidebar-collapsed","true");
  await expect(toggle).toHaveAttribute("aria-expanded","false");
  await expect(sidebar).toHaveCSS("width","72px");
  await expect(page.getByRole("link",{name:"Conferência"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await toggle.click();
  await expect(shell).toHaveAttribute("data-sidebar-collapsed","false");
  await expect(sidebar).toHaveCSS("width","224px");
});
test("Conferente mantém layout móvel e usa o mesmo grafite",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mock(page,conferente);
  await page.goto("/app");
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  await expect(page.locator(".prado-store-sidebar")).toBeHidden();
  await expect(page.locator(".agenda-metrics [data-metric]")).toHaveCount(5);
  await expect(page.locator(".prado-store-agenda-view .agenda-metrics > span").first())
    .toHaveCSS("background-image",/linear-gradient/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});