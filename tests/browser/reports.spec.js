import { test,expect } from "@playwright/test";
const viewer={id:"v1",nome:"Visualizador",papel:"visualizador",login:"viewer"};
const admin={id:"a1",nome:"Administrador",papel:"admin",login:"admin"};
const stores=[{id:"s1",codigo:"F01",nome:"Centro",ativo:true,temConferenteAtivo:true},
 {id:"s2",codigo:"F02",nome:"Sul",ativo:true,temConferenteAtivo:true}];
const report={start:"2026-10-01",end:"2026-10-19",storeCode:null,
 rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",
 total:5,recebido:3,naoChegou:1,aguardando:1,naoCompareceu:0,recusado:0,semAgenda:1},
 {date:"2026-10-18",storeCode:"F01",storeName:"Centro",dayStatus:"concluido",
 total:2,recebido:1,naoChegou:0,aguardando:0,naoCompareceu:1,recusado:0,semAgenda:0}],
 suppliers:[{supplier:"Fornecedor Teste",total:4,recebido:3,naoChegou:1}]};
const occ={total:2,offset:0,limit:50,rows:[{date:"2026-10-19",storeCode:"F01",storeName:"Centro",
 supplier:"Fornecedor Teste",protocol:"123456",observation:"Sem pedido",origin:"importado",occurrenceType:"nao_recebido",classificationOrigin:"manual"},
 {date:"2026-10-18",storeCode:"F01",storeName:"Centro",supplier:"Fornecedor B",
 protocol:"654321",observation:null,origin:"importado",occurrenceType:"nao_compareceu",classificationOrigin:"historico"}]};
async function mocks(page,user,{emptyPrevious=false}={}){
 const requests=[];const searches=[];
 await page.route("**/api/**",route=>{
   const u=new URL(route.request().url());requests.push(u.pathname);searches.push(u.search);
   const json=data=>route.fulfill({json:data});
   if(u.pathname==="/api/auth/me")return json(user);
   if(u.pathname==="/api/realtime/config")return json({mode:"off",protocolVersion:1});
   if(u.pathname==="/api/admin/stores")return json(stores);
   if(u.pathname==="/api/admin/presence")return json([]);
   if(u.pathname==="/api/admin/agendas")return json([]);
   if(u.pathname==="/api/admin/reports"){
     const noBaseline=emptyPrevious&&u.searchParams.get("end")==="2026-09-30";
     return json(noBaseline?{...report,rows:[],suppliers:[]}:report);
   }
   if(u.pathname==="/api/admin/reports/occurrences")return json(occ);
   if(u.pathname==="/api/admin/reports/latest")return json({total:1,limit:50,offset:Number(u.searchParams.get("offset")||0),rows:[{date:"2026-10-19",time:"10:00",storeCode:"F01",supplier:"Fornecedor Teste",status:"recebido"}]});
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
   await expect(page.getByRole("tab")).toHaveCount(0);
   await expect(page.locator(".report-kpis .report-metric")).toHaveCount(5);
   await expect(page.locator(".report-metric-heading")).toContainText(["Agendamentos","Recebidos","Não recebidos","Não compareceu","Aguardando"]);
   await expect(page.locator(".report-reference-rate-card")).toContainText("57,1%");
   await expect(page.locator(".report-reference-latest-card")).toContainText("Fornecedor Teste");
   await page.getByRole("button",{name:/Ver todas as ocorrências/}).click();
   const occurrences=page.locator('[data-report-dialog="occurrences"]');
   await expect(occurrences).toBeVisible();
   await expect(occurrences.locator("tbody tr")).toHaveCount(2);
   await expect(occurrences).toContainText("Sem pedido");
   await expect(occurrences).toContainText("Sistema · agenda antiga concluída");
   await occurrences.getByRole("button",{name:/Fechar Todas as ocorrências/}).click();
   await page.getByRole("button",{name:/Ver todas as lojas/}).click();
   await expect(page.locator(".report-store-table")).toBeVisible();
   await page.getByRole("button",{name:/Fechar Todas as lojas/}).click();
   const filters=page.locator("[data-report-filters]");
   await page.locator("#report-overview .report-filter-trigger").click();
   await filters.locator("[data-report-store-select] summary").click();
   await filters.locator('input[name="stores"][value="F01"]').check();
   await expect(page.locator("[data-report-popover]")).toHaveAttribute("open","");
   await filters.locator("[data-report-store-select] summary").click();
   await filters.getByRole("button",{name:"Aplicar filtros"}).click();
   await expect(page.locator(".report-kpis")).toBeVisible();
   expect(requests.some(x=>/\/api\/admin\/(?:users|agendas\/import)/.test(x))).toBe(false);
 });
}
test("Redesign executivo: cinco indicadores, taxa em destaque e popups",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mocks(page,admin);
 await page.goto("/admin/reports");
 await expect(page.locator(".report-metric")).toHaveCount(5);
 await expect(page.locator(".report-kpis")).not.toContainText("Recusados");
 await expect(page.locator(".report-kpis")).not.toContainText("Taxa de recebimento");
 const featured=page.locator(".report-reference-rate-card");
 await expect(featured).toContainText("57,1%");
 await expect(featured.locator(".report-reference-rate-track span")).toHaveAttribute("style",/57\.1%/);
 await expect(page.locator(".report-reference-distribution-list")).toContainText("Recusados");
 await page.getByRole("button",{name:/Ver todas as lojas/}).click();
 const storesModal=page.locator('[data-report-dialog="stores"]');
 await expect(storesModal).toBeVisible();
 await expect(storesModal.locator(".report-store-table .report-rate-cell")).toHaveCount(1);
 await expect(storesModal.locator(".report-store-table .report-rate-track i")).toHaveAttribute("style",/57\.1%/);
 await page.keyboard.press("Escape");
 await expect(storesModal).toBeHidden();
 await page.getByRole("button",{name:/Ver todas as ocorrências/}).click();
 await expect(page.locator(".report-status-tag.is-automatic")).toContainText("Não compareceu");
 await expect(page.locator(".report-status-tag.is-manual")).toContainText("Não recebido");
 await page.getByRole("button",{name:/Fechar Todas as ocorrências/}).click();
});
test("Redesign executivo: responsivo em celular e tablet nos dois temas",async({page})=>{
 await mocks(page,viewer);
 await page.goto("/admin/reports");
 await expect(page.locator(".report-reference-rate-card")).toBeVisible();
 await expect(page.locator(".report-reference-latest-card")).toContainText("Fornecedor Teste");
 for(const theme of ["dark","light"]){
   await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
   for(const width of [390,768,1440]){
     await page.setViewportSize({width,height:900});
     const geometry=await page.locator(".report-kpis").evaluate(el=>{
       const hero=el.querySelector(".report-metric");
       const rect=hero.getBoundingClientRect();
       const grid=el.getBoundingClientRect();
       return {heroWidth:rect.width,gridWidth:grid.width,
         pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
         heroVisible:getComputedStyle(hero).display!=="none"};
     });
     expect(geometry.heroVisible).toBe(true);
     expect(geometry.pageOverflow,JSON.stringify({theme,width,geometry})).toBeLessThanOrEqual(2);
     expect(geometry.heroWidth).toBeLessThanOrEqual(geometry.gridWidth+2);
     if(width===390)expect(geometry.heroWidth).toBeLessThan(geometry.gridWidth*.55);
   }
 }
});
test("Relatório seleciona várias lojas e aplica filtros em indicadores e ocorrências",async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 const {searches}=await mocks(page,admin);
 await page.goto("/admin/reports");
 const filters=page.locator("[data-report-filters]");
 const picker=filters.locator("[data-report-store-select]");
 await page.locator("#report-overview .report-filter-trigger").click();
 await picker.locator("summary").click();
 await expect(picker.locator('input[name="stores"]')).toHaveCount(2);
 await picker.locator('input[value="F01"]').check();
 await picker.locator('input[value="F02"]').check();
 await expect(picker.locator("summary")).toHaveText("2 lojas selecionadas");
 await expect(picker.locator("[data-report-store-all]")).not.toBeChecked();
 await expect(page.locator("[data-report-popover]")).toHaveAttribute("open","");
 await picker.locator("summary").click();
 await filters.getByRole("button",{name:"Aplicar filtros"}).click();
 await expect(page.locator(".report-range-summary")).toContainText("2 lojas selecionadas");
 const scoped=searches.filter(q=>new URLSearchParams(q).getAll("storeCode").length===2);
 expect(scoped.length).toBeGreaterThanOrEqual(3);
 for(const q of scoped)expect(new URLSearchParams(q).getAll("storeCode")).toEqual(["F01","F02"]);
 await page.reload();
 await expect(filters.locator("[data-report-store-select] summary")).toHaveText("2 lojas selecionadas");
 await page.locator("#report-overview .report-filter-trigger").click();
 await picker.locator("summary").click();
 await expect(picker.locator('input[value="F01"]')).toBeChecked();
 await expect(picker.locator('input[value="F02"]')).toBeChecked();
 await picker.locator("[data-report-store-all]").check();
 await expect(picker.locator('input[name="stores"]:checked')).toHaveCount(0);
 await expect(picker.locator("summary")).toHaveText("Todas as lojas");
 await expect(page.locator("[data-report-popover]")).toHaveAttribute("open","");
 await picker.locator("summary").click();
 await filters.getByRole("button",{name:"Aplicar filtros"}).click();
 await expect(page.locator(".report-range-summary")).toContainText("Todas as lojas");
 expect(searches.slice(-3).every(q=>!new URLSearchParams(q).has("storeCode"))).toBe(true);
});
test("Filtro múltiplo é operável no celular com teclado e sem rolagem horizontal da página",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mocks(page,viewer);
 await page.goto("/admin/reports");
 const picker=page.locator("[data-report-store-select]");
 await page.locator("#report-overview .report-filter-trigger").click();
 await picker.locator("summary").click();
 await expect(picker).toHaveAttribute("open","");
 await picker.locator('input[value="F02"]').check();
 await expect(picker.locator("summary")).toContainText("F02");
 await picker.locator('input[value="F02"]').press("Escape");
 await expect(picker).not.toHaveAttribute("open","");
 await expect(picker.locator("summary")).toBeFocused();
 const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2);
 expect(noOverflow).toBe(true);
});
test("Relatório: edita datas diretamente e esclarece comparação sem base anterior",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await mocks(page,admin,{emptyPrevious:true});
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
  await page.locator("#report-overview .report-filter-trigger").click();
  await page.locator("[name=start]").fill("2026-10-01");
  await page.locator("[name=end]").fill("2026-10-19");
  await expect(page.locator('[data-report-date-input="start"]')).toHaveValue("2026-10-01");
  await expect(page.locator('[data-report-date-input="end"]')).toHaveValue("2026-10-19");
  await page.getByRole("button",{name:"Aplicar filtros"}).click();
  await expect(page.locator(".report-insight")).toContainText("0 agendamentos");
  await expect(page.locator(".report-insight")).toContainText("sem base para comparar a taxa de recebimento");
  await expect(page.locator(".report-kpis")).not.toContainText("Taxa de recebimento");
  await expect(page.locator(".report-reference-rate-card")).toContainText("Sem comparação disponível");
  await expect(page.locator(".report-metric-delta")).toHaveCount(0);
});
test("Atalhos de período, alternância do gráfico, busca de ocorrências e padrão semanal",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  const {requests,searches}=await mocks(page,viewer);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
  await expect(page.locator("[data-report-preset]")).toHaveCount(4);
  await expect(page.locator("[data-report-preset=\"30\"]")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".report-metric-delta").first()).toContainText("vs. período anterior");
  await expect(page.getByRole("heading",{name:"Padrão por dia da semana"})).toBeHidden();
  await expect(page.locator(".report-weekdays .report-progress-item span").first()).toHaveText("Segunda-feira");
  await expect(page.locator(".manager-report")).toContainText("Taxa de recebimento no período");
  const today=businessDay();
  await page.locator("#report-overview .report-filter-trigger").click();
  await page.locator("[name=start]").fill("2026-09-01");
  await page.locator("[name=end]").fill("2026-09-30");
  await page.getByRole("button",{name:"Aplicar filtros"}).click();
  await expect(page.locator("[name=end]")).toHaveValue("2026-09-30");
  await page.locator("#report-overview .report-filter-trigger").click();
  await page.getByRole("button",{name:"Últimos 7 dias"}).click();
  await expect(page.locator("[name=\"start\"]")).toHaveValue(shift(today,-6));
  await expect(page.locator("[name=\"end\"]")).toHaveValue(today);
  await expect(page.locator("[data-report-preset=\"7\"]")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("[data-report-preset=\"30\"]")).toHaveAttribute("aria-pressed","false");
  const chartRequests=()=>requests.filter(x=>x==="/api/admin/reports").length;
  const beforeToggle=chartRequests();
  await page.getByRole("button",{name:/Ver análises completas/}).click();
  await expect(page.getByRole("heading",{name:"Padrão por dia da semana"})).toBeVisible();
  await page.locator("[data-report-chart-mode=\"rate\"]").click();
  const lineType=await page.locator("[data-report-chart-canvas]").evaluate(canvas=>window.Chart?.getChart(canvas)?.config.type);
  expect(lineType).toBe("line");
  await expect(page.locator("[data-report-native-chart]")).toBeHidden();
  await expect(page.locator("[data-report-rate-native]")).toBeHidden();
  await page.locator("[data-report-chart-mode=\"volume\"]").click();
  const barType=await page.locator("[data-report-chart-canvas]").evaluate(canvas=>window.Chart?.getChart(canvas)?.config.type);
  expect(barType).toBe("bar");
  expect(chartRequests()).toBe(beforeToggle);
  await page.getByRole("button",{name:/Fechar Análises completas/}).click();
  await page.getByRole("button",{name:/Ver todas as ocorrências/}).click();
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
  await page.getByRole("button",{name:/Ver análises completas/}).click();
  await expect(page.locator("[data-report-native-chart] .report-chart")).toBeVisible();
  await expect(page.locator("[data-report-chart-wrap]")).toBeHidden();
  await expect(page.locator(".report-kpis")).toContainText("Recebidos");
});test("Relatório mantém a identificação da loja durante a rolagem horizontal",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mocks(page,viewer);
  await page.goto("/admin/reports");
  await page.getByRole("button",{name:/Ver todas as lojas/}).click();
  await expect(page.getByRole("heading",{name:"Por loja",exact:true})).toBeVisible();
  await page.evaluate(()=>{document.documentElement.dataset.theme="dark";});
  const geometry=await page.locator(".report-store-table").evaluate(el=>{
    const cell=el.querySelector("tbody td:first-child");
    el.scrollLeft=el.scrollWidth;
    return {position:getComputedStyle(cell).position,
      scroll:el.scrollWidth-el.clientWidth,
      leftOffset:cell.getBoundingClientRect().left-el.getBoundingClientRect().left,
      pageOverflow:document.documentElement.scrollWidth-window.innerWidth};
  });
  expect(geometry.position).toBe("sticky");
  expect(geometry.scroll,JSON.stringify(geometry)).toBeGreaterThan(0);
  expect(geometry.leftOffset).toBeGreaterThanOrEqual(-1);
  expect(geometry.leftOffset).toBeLessThanOrEqual(2);
  expect(geometry.pageOverflow).toBeLessThanOrEqual(2);
});

// Regressão: o overlay invisível não pode bloquear a digitação nem o calendário nativo.
test("Relatório: datas são campos nativos visíveis, editáveis e com calendário clicável",async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  const {searches}=await mocks(page,admin);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading",{name:"Relatório Gerencial"})).toBeVisible();
  await page.locator("#report-overview .report-filter-trigger").click();
  for(const theme of ["dark","light"]){
    await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
    for(const name of ["start","end"]){
      const input=page.locator('[data-report-date-input="'+name+'"]');
      await expect(input).toHaveAttribute("type","date");
      await expect(input).toBeVisible();
      await expect(input).toHaveCSS("opacity","1");
      await expect(input).toHaveCSS("pointer-events","auto");
      await input.click({position:{x:14,y:20}});
      await expect(input).toBeFocused();
      // O indicador deve estar no próprio campo, acessível com o mouse.
      const bounds=await input.boundingBox();
      await input.click({position:{x:Math.floor(bounds.width)-16,y:20}});
      await input.press("Escape");
    }
  }
  await page.locator('[data-report-date-input="start"]').fill("2026-10-01");
  await page.locator('[data-report-date-input="end"]').fill("2026-10-19");
  await page.getByRole("button",{name:"Aplicar filtros"}).click();
  await expect(page.locator('[data-report-date-input="start"]')).toHaveValue("2026-10-01");
  await expect(page.locator('[data-report-date-input="end"]')).toHaveValue("2026-10-19");
  await expect.poll(()=>searches.some(q=>q.includes("start=2026-10-01")&&q.includes("end=2026-10-19"))).toBe(true);
});


test("Popups abrem no mesmo relatório, mantêm filtros e fecham por teclado",async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 const {requests,searches}=await mocks(page,admin);
 await page.goto("/admin/reports");
 const summary=page.locator(".report-reference-overview");
 await expect(summary).toBeVisible();
 await expect(page.getByRole("tab")).toHaveCount(0);
 await expect(page.locator(".report-detail-dialog")).toHaveCount(4);
 const count=()=>requests.filter(x=>x==="/api/admin/reports").length;
 const before=count();
 const shopButton=page.getByRole("button",{name:/Ver todas as lojas/});
 await shopButton.click();
 const shops=page.locator('[data-report-dialog="stores"]');
 await expect(shops).toBeVisible();
 await expect(shops.locator(".report-store-table")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(shops).toBeHidden();
 await expect(shopButton).toBeFocused();
 await page.getByRole("button",{name:/Ver todas as ocorrências/}).click();
 const occurrences=page.locator('[data-report-dialog="occurrences"]');
 await expect(occurrences).toBeVisible();
 await occurrences.getByRole("searchbox",{name:/Buscar ocorrência/}).fill("Fornecedor");
 await occurrences.getByRole("button",{name:"Buscar"}).click();
 await expect.poll(()=>searches.some(q=>q.includes("q=Fornecedor"))).toBe(true);
 await expect(occurrences).toBeVisible();
 await occurrences.getByRole("button",{name:/Fechar Todas as ocorrências/}).click();
 await page.getByRole("button",{name:/Ver detalhamento/}).click();
 const appointments=page.locator('[data-report-dialog="appointments"]');
 await expect(appointments).toBeVisible();
 await expect(appointments).toContainText("Fornecedor Teste");
 await expect(appointments.getByRole("button",{name:"Próxima"})).toBeDisabled();
 await appointments.getByRole("button",{name:/Fechar Agendamentos por data de entrega/}).click();
 await page.getByRole("button",{name:/Ver análises completas/}).click();
 await expect(page.locator('[data-report-dialog="analysis"]')).toBeVisible();
 await expect(page.getByRole("heading",{name:"Padrão por dia da semana"})).toBeVisible();
 await page.getByRole("button",{name:/Fechar Análises completas/}).click();
 await expect(summary).toBeVisible();
 expect(count()).toBeGreaterThanOrEqual(before);
});


test("Ajuda contextual aparece em todos os cards e explica últimos agendamentos",async({page})=>{
  await mocks(page,viewer);
  await page.goto("/admin/reports");
  const cards=page.locator(".report-reference-card");
  await expect(cards).toHaveCount(7);
  await expect(cards.locator("[data-report-info]")).toHaveCount(7);
  const last=page.locator(".report-reference-latest-card");
  const info=last.getByRole("button",{name:"Sobre: Agendamentos recentes por data de entrega"});
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded","true");
  const tooltip=last.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Não são necessariamente os últimos cadastrados");
  await page.keyboard.press("Escape");
  await expect(info).toHaveAttribute("aria-expanded","false");
});


test("resumos não têm rolagem lateral e gráfico mostra sete dias corridos",async({page})=>{
  await mocks(page,admin);
  await page.goto("/admin/reports");
  for(const width of [390,768,1366]){
    await page.setViewportSize({width,height:950});
    for(const selector of [".report-reference-occurrences-card",".report-reference-latest-card"]){
      const card=page.locator(selector);
      const dimensions=await card.evaluate(el=>({
        cardWidth:el.clientWidth,
        contentWidth:el.scrollWidth,
        listWidth:el.querySelector(".report-reference-compact-list")?.scrollWidth,
        listClient:el.querySelector(".report-reference-compact-list")?.clientWidth
      }));
      expect(dimensions.contentWidth,selector+" "+JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.cardWidth+2);
      expect(dimensions.listWidth,selector+" "+JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.listClient+2);
    }
  }
  await expect(page.locator(".report-reference-stack-card .report-reference-day")).toHaveCount(7);
  await expect(page.locator(".report-reference-latest-card")).toContainText("Ordenados pela data e hora da entrega");
});
