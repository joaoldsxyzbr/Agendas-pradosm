import { test, expect } from "@playwright/test";
const admin={id:"adm",nome:"ADM de testes",papel:"admin",login:"admin"};
const stores=Array.from({length:10},(_,i)=>({
  id:"s"+i,codigo:"F"+String(i+1).padStart(2,"0"),nome:"Loja de Exemplo "+(i+1),ativo:true,temConferenteAtivo:true
}));
const agendas=stores.slice(0,9).map((s,i)=>({
  id:"agenda"+i,storeCode:s.codigo,storeName:s.nome,date:"2026-10-20",
  dayStatus:i===0?"concluido":"aberto",total:20,
  recebido:i===0?20:i+3,aguardando:i===0?0:17-i,
  naoChegou:0,recusado:0,semAgenda:0
}));
async function mock(page){
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    const json=data=>route.fulfill({json:data});
    if(path==="/api/auth/me")return json(admin);
    if(path==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
    if(path==="/api/admin/stores")return json(stores);
    if(path==="/api/admin/agendas")return json(agendas);
    if(path==="/api/admin/presence")return json([]);
    if(path==="/api/auth/bootstrap-status")return json({available:false});
    if(path==="/api/store/presence")return route.fulfill({status:204});
    throw Error("Rota não simulada: "+path);
  });
}
test("Recebimento: seis colunas sem blocos azuis nem sticky, com ações visíveis no desktop",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-operation-row")).toHaveCount(10);
  await expect(page.locator(".dashboard-summary-metric")).toHaveCount(5);
  await expect(page.locator(".dashboard-summary-glyph")).toHaveCount(5);
  await expect(page.locator(".dashboard-header-actions [data-refresh]")).toBeVisible();
  await expect(page.locator(".dashboard-import-action")).toBeVisible();
  await expect(page.locator(".dashboard-date-controls .agenda-calendar-trigger")).toBeVisible();
  await expect(page.locator(".dashboard-operation-table thead th")).toHaveCount(6);
  await expect(page.locator(".dashboard-operation-row").first().locator("td")).toHaveCount(6);
  await expect(page.locator(".dashboard-operation-row").first().locator("progress")).toHaveAttribute("max","20");
  await expect(page.locator(".dashboard-operation-row").first()).toHaveClass(/is-open/);
  await expect(page.locator(".dashboard-operation-row").last()).toHaveClass(/is-completed/);
  await expect(page.locator(".dashboard-operation-row").first().locator("progress")).toHaveAttribute("value","4");
  await expect(page.locator(".dashboard-operation-row").first().locator(".dashboard-pending-cell")).not.toContainText("0 não recebidos");
  await expect(page.locator(".dashboard-operation-row.is-completed .dashboard-pending-cell")).toContainText("Sem pendências");
  await expect(page.locator("[data-selected-date]")).toHaveCount(0);
  await expect(page.locator('.dashboard-operation-row.is-empty').first().locator(".dashboard-agenda-mark")).toBeVisible();
  await expect(page.locator(".dashboard-operation-row").first().locator("[data-agenda-id]")).toHaveCount(1);
  const layout=await page.evaluate(()=>{
    const wrap=document.querySelector(".dashboard-operation-table .table-scroll");
    const r=el=>el.getBoundingClientRect();
    const table=document.querySelector(".dashboard-operation-table table");
    const row=document.querySelector(".dashboard-operation-row");
    const action=row.querySelector(".dashboard-store-details");
    const cells=[...row.querySelectorAll("td")];
    const rect=r(wrap),tr=r(table);
    const colors=cells.map(c=>getComputedStyle(c).backgroundColor);
    return {right:tr.right,visibleRight:rect.right,documentOverflow:document.documentElement.scrollWidth-window.innerWidth,
      sticky:cells.some(c=>getComputedStyle(c).position==="sticky"),
      actionRight:action?.getBoundingClientRect().right,
      colors,overflow:wrap.scrollWidth-wrap.clientWidth};
  });
  expect(layout.sticky).toBe(false);
  expect(new Set(layout.colors).size).toBe(1);
  expect(layout.colors[0]).toBe("rgb(20, 34, 53)");
  expect(layout.documentOverflow).toBeLessThanOrEqual(2);
  expect(layout.overflow).toBeLessThanOrEqual(2);
  expect(layout.right).toBeLessThanOrEqual(layout.visibleRight+2);
  expect(layout.actionRight).toBeLessThanOrEqual(layout.visibleRight+1);
});
test("Recebimento no celular rola a tabela sem cortar a página ou o botão de detalhes",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-operation-row")).toHaveCount(10);
  const scroll=page.locator(".dashboard-operation-table .table-scroll");
  const layout=await page.evaluate(()=>{
    const el=document.querySelector(".dashboard-operation-table .table-scroll");
    return {scroll:el.scrollWidth-el.clientWidth,overflow:document.documentElement.scrollWidth-window.innerWidth};
  });
  expect(layout.scroll).toBeGreaterThan(100);
  expect(layout.overflow).toBeLessThanOrEqual(2);
  await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
  await expect(page.locator(".dashboard-operation-row").first().locator("[data-agenda-id]")).toBeVisible();
});
test("Recebimento: cartões, botões e estados têm acabamento azul-grafite",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-operation-row")).toHaveCount(10);
  const summary=page.locator(".dashboard-operation-summary");
  await expect(summary).toHaveCSS("grid-template-columns",/px/);
  await expect(page.locator(".dashboard-summary-total .dashboard-summary-icon")).toBeVisible();
  await expect(page.locator(".dashboard-summary-open .dashboard-summary-icon")).toBeVisible();
  await expect(page.locator(".dashboard-summary-completed .dashboard-summary-icon")).toBeVisible();
  await expect(page.locator(".dashboard-operation-table")).toHaveCSS("border-top-left-radius","10px");
  await expect(page.locator(".dashboard-operation-row.is-open .status-pill").first()).toContainText("Em andamento");
  await expect(page.locator(".dashboard-operation-row.is-completed .status-pill").first()).toContainText("Concluído");
  await expect(page.locator("[data-day-prev]")).toBeVisible();
  await expect(page.locator("[data-day-next]")).toBeVisible();
});

test("Recebimento compacto: indicadores, ações e tabela mantêm densidade operacional",async({page})=>{
  await page.setViewportSize({width:1288,height:686});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-operation-row")).toHaveCount(10);
  const sizes=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const summary=rect(".dashboard-operation-summary");
    const row=rect(".dashboard-operation-row");
    const date=rect(".dashboard-date-controls");
    const refresh=rect("[data-refresh]");
    const heading=rect(".receiving-page .page-heading");
    const th=rect(".dashboard-operation-table thead th");
    return {summary:summary.height,row:row.height,date:date.height,refresh:refresh.height,
      heading:heading.height,th:th.height,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(sizes.summary).toBeLessThanOrEqual(82);
  expect(sizes.row).toBeLessThanOrEqual(68);
  expect(sizes.th).toBeLessThanOrEqual(43);
  expect(sizes.date).toBeLessThanOrEqual(43);
  expect(sizes.refresh).toBeLessThanOrEqual(43);
  expect(sizes.heading).toBeLessThanOrEqual(80);
  expect(sizes.overflow).toBeLessThanOrEqual(2);
});

test("Recebimento compacto no celular mantém os indicadores e a rolagem isolada",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-summary-metric")).toHaveCount(5);
  const sizes=await page.evaluate(()=>{
    const summary=document.querySelector(".dashboard-operation-summary").getBoundingClientRect();
    const row=document.querySelector(".dashboard-operation-row").getBoundingClientRect();
    const scroll=document.querySelector(".dashboard-operation-table .table-scroll");
    return {summary:summary.height,row:row.height,
      tableScroll:scroll.scrollWidth-scroll.clientWidth,
      overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(sizes.summary).toBeLessThanOrEqual(235);
  expect(sizes.row).toBeLessThanOrEqual(76);
  expect(sizes.tableScroll).toBeGreaterThan(100);
  expect(sizes.overflow).toBeLessThanOrEqual(2);
});

test("Tailwind v4 aplica utilities sem resetar a pagina Recebimento",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await mock(page);
  await page.goto("/admin");
  await expect(page.locator(".dashboard-summary-metric")).toHaveCount(5);
  await expect(page.locator(".dashboard-summary-copy > span").first()).toHaveCSS("font-weight","500");
  await expect(page.locator(".dashboard-operation-row")).toHaveCount(10);
  await expect(page.locator(".dashboard-operation-table thead th")).toHaveCount(6);
  await expect(page.locator(".dashboard-header-actions [data-refresh]")).toBeVisible();
});
