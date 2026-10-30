import { test, expect } from "@playwright/test";

const conf = { id:"c1",nome:"Conferente Doca",papel:"conferente",lojaId:"s1",lojaCodigo:"F03",lojaNome:"Loja Central" };
const entry = { id:"a1",supplier:"FORNECEDOR TESTE",protocol:"1234567",type:"Nota fiscal",
  startTime:"08:00",endTime:"08:30",status:"aguardando",hasExchanges:false,observation:null,origin:"imported" };
async function setup(page, { conflict = false, empty = false, completed = false } = {}) {
  const requests = [];
  let data = { agenda:empty?null:{ id:"agenda1",date:"2026-10-30",storeCode:"F03",
    storeName:"Loja Central",dayStatus:completed?"concluido":"aberto",completedAt:null },
    appointments:empty?[]:[entry,{...entry,id:"a2",supplier:"Outro Fornecedor",protocol:"99988877",startTime:"09:00"}],
  };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    requests.push({ path:url.pathname,method,payload:method==="GET"||!route.request().postData()?null:route.request().postDataJSON() });
    if(url.pathname==="/api/auth/me")return route.fulfill({json:conf});
    if(url.pathname.startsWith("/api/store/tags/agenda/"))return route.fulfill({json:{tags:[],assignments:{}}});
    if(url.pathname==="/api/store/today"||url.pathname.startsWith("/api/store/history/"))return route.fulfill({json:data});
    if(url.pathname==="/api/store/appointments/a1/status" && method==="PATCH"){
      if(conflict)return route.fulfill({status:409,json:{error:"CONFLITO_ESTADO",message:"Este registro mudou. Atualize a tela e tente novamente."}});
      const {status,observation}=route.request().postDataJSON();
      data={...data,appointments:data.appointments.map(x=>x.id==="a1"?{...x,status,observation}:x)};
      return route.fulfill({json:data.appointments[0]});
    }
    if(url.pathname==="/api/store/appointments/a1/exchanges" && method==="PATCH"){
      const {hasExchanges}=route.request().postDataJSON();
      data={...data,appointments:data.appointments.map(x=>x.id==="a1"?{...x,hasExchanges}:x)};
      return route.fulfill({json:data.appointments[0]});
    }
    if(url.pathname==="/api/store/agenda/2026-10-30/complete"&&method==="POST"){
      if(conflict)return route.fulfill({status:409,json:{error:"CONFLITO_ESTADO",message:"Este registro mudou."}});
      data={...data,agenda:{...data.agenda,dayStatus:"concluido"}};
      return route.fulfill({json:data.agenda});
    }
    throw Error("Rota de Conferente não preparada: "+method+" "+url.pathname);
  });
  await page.goto("/app");
  return requests;
}

test("Conferente React exibe cinco métricas e lista com dados da API",async({page})=>{
  await setup(page);
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  await expect(page.getByLabel("Resumo da agenda").locator("strong")).toHaveText(["2","2","0","0","0"]);
  await expect(page.getByTestId("conference-row-a1")).toContainText("FORNECEDOR TESTE");
  await page.getByRole("searchbox",{name:"Pesquisar fornecedor ou protocolo"}).fill("outro");
  await expect(page.getByTestId("conference-row-a1")).toHaveCount(0);
  await expect(page.getByTestId("conference-row-a2")).toBeVisible();
  await page.getByRole("searchbox",{name:"Pesquisar fornecedor ou protocolo"}).fill("inexistente");
  await expect(page.getByText("Nenhum fornecedor ou protocolo encontrado.")).toBeVisible();
});

test("Conferente React só altera status após confirmação da API",async({page})=>{
  const requests=await setup(page);
  const row=page.getByTestId("conference-row-a1");
  await row.getByRole("button",{name:"Recebido",exact:true}).click();
  await expect(row.getByRole("button",{name:"Desmarcar recebido"})).toBeVisible();
  await expect(page.getByLabel("Resumo da agenda").locator("strong")).toHaveText(["2","1","1","0","0"]);
  await row.getByRole("button",{name:"Desmarcar recebido"}).click();
  await expect(row.getByRole("button",{name:"Recebido",exact:true})).toBeVisible();
  expect(requests.filter(x=>x.path.endsWith("/a1/status")&&x.method==="PATCH").map(x=>x.payload.status)).toEqual(["recebido","aguardando"]);
});

test("Conferente React exige motivo para Não recebido e permite Trocas",async({page})=>{
  const requests=await setup(page);
  const row=page.getByTestId("conference-row-a1");
  await row.getByRole("button",{name:"Não recebido",exact:true}).click();
  await expect(row.getByRole("button",{name:"Confirmar motivo"})).toBeDisabled();
  expect(requests.filter(x=>x.path.endsWith("/a1/status"))).toHaveLength(0);
  await row.getByRole("combobox",{name:"Motivo de FORNECEDOR TESTE"}).selectOption("Não veio");
  await row.getByRole("button",{name:"Confirmar motivo"}).click();
  await expect(row.getByRole("button",{name:"Desmarcar não recebido"})).toBeVisible();
  await row.getByRole("checkbox",{name:"Trocas de FORNECEDOR TESTE"}).click();
  await expect(row.getByRole("checkbox",{name:"Trocas de FORNECEDOR TESTE"})).toBeChecked();
  const sent=requests.find(x=>x.path.endsWith("/a1/status"));expect(sent.payload.observation).toBe("Não veio");
  expect(requests.some(x=>x.path.endsWith("/a1/exchanges")&&x.payload.hasExchanges===true)).toBe(true);
});

test("Conferente React confirma conclusão e bloqueia mudanças depois",async({page})=>{
  const requests=await setup(page);
  await page.getByRole("button",{name:"Concluir dia"}).click();
  await expect(page.getByLabel("Confirmar conclusão do dia")).toBeVisible();
  expect(requests.filter(x=>x.path.includes("/complete"))).toHaveLength(0);
  await page.getByRole("button",{name:"Confirmar conclusão"}).click();
  await expect(page.getByText("Dia concluído")).toBeVisible();
  await expect(page.getByTestId("conference-row-a1").getByRole("button",{name:"Recebido"})).toHaveCount(0);
  expect(requests.filter(x=>x.path.includes("/complete")&&x.method==="POST")).toHaveLength(1);
});

test("Conferente React trata conflitos 409 sem atualizar o estado da tela",async({page})=>{
  await setup(page,{conflict:true});
  const row=page.getByTestId("conference-row-a1");
  await row.getByRole("button",{name:"Recebido",exact:true}).click();
  await expect(row.getByRole("alert")).toContainText("Este registro mudou.");
  await expect(row.getByRole("button",{name:"Recebido",exact:true})).toBeVisible();
});

test("Conferente React preserva somente leitura de dia concluído e ausência de agenda",async({page})=>{
  await setup(page,{completed:true});
  await expect(page.getByTestId("conference-row-a1").getByRole("button",{name:"Recebido"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Concluir dia"})).toHaveCount(0);
  await page.getByLabel("Data da conferência").fill("2026-10-29");
  await expect(page.getByTestId("conference-row-a1")).toBeVisible();
});
test("Conferente React mostra tela sem agenda, sem oferecer conclusões",async({page})=>{
  await setup(page,{empty:true});
  await expect(page.getByText(/Nenhuma agenda em/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Concluir dia"})).toHaveCount(0);
});
test("Conferente React é responsivo e não cria rolagem horizontal da página",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});
