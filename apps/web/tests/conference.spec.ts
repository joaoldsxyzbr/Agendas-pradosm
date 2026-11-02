import { test, expect } from "@playwright/test";

const conf = { id:"c1",nome:"Conferente Doca",papel:"conferente",lojaId:"s1",lojaCodigo:"F03",lojaNome:"Loja Central" };
const entry = { id:"a1",supplier:"FORNECEDOR TESTE",protocol:"1234567",type:"Nota fiscal",
  startTime:"08:00",endTime:"08:30",status:"aguardando",hasExchanges:false,observation:null,origin:"imported" };
async function setup(page, { conflict = false, empty = false, completed = false, noShow = false } = {}) {
  const requests = [];
  let manualSeq = 0;
  let data = { agenda:empty?null:{ id:"agenda1",date:"2026-10-30",storeCode:"F03",
    storeName:"Loja Central",dayStatus:completed?"concluido":"aberto",completedAt:null },
    appointments:empty?[]:[{...entry,status:noShow?"nao_chegou":"aguardando",observation:noShow?"Não compareceu":null},
      {...entry,id:"a2",supplier:"Outro Fornecedor",protocol:"99988877",startTime:"09:00"}],
  };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    requests.push({ path:url.pathname,method,payload:method==="GET"||!route.request().postData()?null:route.request().postDataJSON() });
    if(url.pathname==="/api/auth/me")return route.fulfill({json:conf});
    if(url.pathname==="/api/realtime/config")return route.fulfill({json:{mode:"off",protocolVersion:1}});
    if(url.pathname.startsWith("/api/store/tags/agenda/"))return route.fulfill({json:{tags:[],assignments:{}}});
    if(url.pathname==="/api/store/today"||url.pathname.startsWith("/api/store/history/"))return route.fulfill({json:data});
    if(url.pathname==="/api/store/appointments/a1/status" && method==="PATCH"){
      if(conflict)return route.fulfill({status:409,json:{error:"CONFLITO_ESTADO",message:"Este registro mudou. Atualize a tela e tente novamente."}});
      const {status,observation}=route.request().postDataJSON();
      data={...data,appointments:data.appointments.map(x=>x.id==="a1"?{...x,status,observation}:x)};
      return route.fulfill({json:data.appointments.find(x=>x.id==="a1")});
    }
    if(url.pathname==="/api/store/appointments/a1/exchanges" && method==="PATCH"){
      const {hasExchanges}=route.request().postDataJSON();
      data={...data,appointments:data.appointments.map(x=>x.id==="a1"?{...x,hasExchanges}:x)};
      return route.fulfill({json:data.appointments.find(x=>x.id==="a1")});
    }
    if(url.pathname==="/api/store/appointments/a1/observation" && method==="PATCH"){
      if(conflict)return route.fulfill({status:409,json:{error:"CONFLITO_ESTADO",message:"Este registro mudou."}});
      const {observation}=route.request().postDataJSON();
      data={...data,appointments:data.appointments.map(x=>x.id==="a1"?{...x,observation}:x)};
      return route.fulfill({json:data.appointments.find(x=>x.id==="a1")});
    }
    if(/^\/api\/store\/agenda\/\d{4}-\d{2}-\d{2}\/manual$/.test(url.pathname) && method==="POST"){
      if(conflict)return route.fulfill({status:409,json:{error:"CONFLITO_ESTADO",message:"Este registro mudou."}});
      const {supplier}=route.request().postDataJSON();
      const created={ id:"m"+(++manualSeq),supplier,protocol:"Sem agenda",type:"Sem agenda",
        startTime:"10:00",endTime:"10:00",status:"aguardando",hasExchanges:false,observation:null,
        origin:"manual",nfe:[],orders:[] };
      data={...data,appointments:[...data.appointments,created]};
      return route.fulfill({json:created});
    }
    if(/^\/api\/store\/appointments\/m\d+\/manual$/.test(url.pathname)){
      const id=url.pathname.split("/")[4];
      if(method==="PATCH"){
        const {supplier}=route.request().postDataJSON();
        data={...data,appointments:data.appointments.map(x=>x.id===id?{...x,supplier}:x)};
        return route.fulfill({json:data.appointments.find(x=>x.id===id)});
      }
      if(method==="DELETE"){
        data={...data,appointments:data.appointments.filter(x=>x.id!==id)};
        return route.fulfill({status:204,body:""});
      }
    }
    if(url.pathname==="/api/store/appointments/a1" && method==="GET"){
      return route.fulfill({json:{...data.appointments.find(x=>x.id==="a1"),
        items:"12",volumes:"5",pallets:"2",cargaBatida:null,
        history:[{id:"h1",statusAnterior:"aguardando",statusNovo:"nao_chegou",observation:"Não veio",
          alteradoEm:"2026-10-30T09:00:00.000Z",usuario:{id:"c1",nome:"Conferente Doca"}}]}});
    }
    if(/^\/api\/store\/agenda\/\d{4}-\d{2}-\d{2}\/complete$/.test(url.pathname)&&method==="POST"){
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

test("Conferente React registra fornecedor sem agenda",async({page})=>{
  const requests=await setup(page);
  await page.getByRole("button",{name:"Fornecedor sem agenda"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Fornecedor sem agenda");
  await dialog.getByLabel("Nome do fornecedor").fill("Distribuidora Manual");
  await dialog.getByRole("button",{name:"Adicionar",exact:true}).click();
  const row=page.getByTestId("conference-row-m1");
  await expect(row).toBeVisible();
  await expect(row).toContainText("Distribuidora Manual");
  await expect(row).toContainText("Fornecedor sem agenda");
  const sent=requests.find(x=>x.method==="POST"&&/\/manual$/.test(x.path));
  expect(sent.payload).toEqual({supplier:"Distribuidora Manual"});
  await expect(page.getByLabel("Resumo da agenda").locator("strong")).toHaveText(["3","3","0","0","0"]);
});

test("Conferente React edita e remove fornecedor manual",async({page})=>{
  const requests=await setup(page);
  await page.getByRole("button",{name:"Fornecedor sem agenda"}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Nome do fornecedor").fill("Distribuidora Manual");
  await dialog.getByRole("button",{name:"Adicionar",exact:true}).click();
  const row=page.getByTestId("conference-row-m1");
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Editar fornecedor Distribuidora Manual"}).click();
  await dialog.getByLabel("Nome do fornecedor").fill("Distribuidora Renomeada");
  await dialog.getByRole("button",{name:"Salvar",exact:true}).click();
  await expect(row).toContainText("Distribuidora Renomeada");
  expect(requests.find(x=>x.method==="PATCH"&&/\/m1\/manual$/.test(x.path)).payload)
    .toEqual({supplier:"Distribuidora Renomeada"});
  await row.getByRole("button",{name:"Editar fornecedor Distribuidora Renomeada"}).click();
  await dialog.getByRole("button",{name:"Remover",exact:true}).click();
  await expect(dialog).toContainText("O registro ficará preservado");
  await dialog.getByRole("button",{name:"Remover",exact:true}).click();
  await expect(page.getByTestId("conference-row-m1")).toHaveCount(0);
  expect(requests.some(x=>x.method==="DELETE"&&/\/m1\/manual$/.test(x.path))).toBe(true);
  await expect(page.getByLabel("Resumo da agenda").locator("strong")).toHaveText(["2","2","0","0","0"]);
});

test("Conferente React edita e limpa observação opcional",async({page})=>{
  const requests=await setup(page);
  const row=page.getByTestId("conference-row-a1");
  await row.getByRole("button",{name:"Observação de FORNECEDOR TESTE"}).click();
  await row.getByLabel("Editar observação de FORNECEDOR TESTE").selectOption("Sem pedido");
  await row.getByRole("button",{name:"Confirmar",exact:true}).click();
  await expect(row).toContainText("Obs.: Sem pedido");
  expect(requests.find(x=>x.path.endsWith("/a1/observation")).payload).toEqual({observation:"Sem pedido"});
  await row.getByRole("button",{name:"Observação de FORNECEDOR TESTE"}).click();
  await row.getByLabel("Editar observação de FORNECEDOR TESTE").selectOption("");
  await row.getByRole("button",{name:"Confirmar",exact:true}).click();
  await expect(row.getByText("Obs.: Sem pedido")).toHaveCount(0);
  const cleared=requests.filter(x=>x.path.endsWith("/a1/observation")).at(-1);
  expect(cleared.payload).toEqual({observation:null});
});

test("Conferente React exporta a agenda em PDF",async({page})=>{
  await setup(page);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Exportar PDF"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe("agenda-F03-30-10-2026.pdf");
});

test("Conferente React consulta detalhes e histórico em dia concluído",async({page})=>{
  const requests=await setup(page,{completed:true});
  await page.getByTestId("conference-row-a1").getByRole("button",{name:"Detalhes de FORNECEDOR TESTE"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Detalhes do agendamento");
  await expect(dialog).toContainText("Histórico de alterações");
  await expect(dialog).toContainText("Aguardando → Não recebido");
  await expect(dialog).toContainText("Conferente Doca");
  await expect(dialog).toContainText("Não veio");
  expect(requests.some(x=>x.method==="GET"&&x.path==="/api/store/appointments/a1")).toBe(true);
});

test("Conferente React classifica automaticamente quem não compareceu",async({page})=>{
  await setup(page,{completed:true,noShow:true});
  await expect(page.getByTestId("conference-row-a1")).toContainText("Não compareceu");
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
  await expect(page.getByRole("button",{name:"Fornecedor sem agenda"})).toHaveCount(0);
  await page.getByLabel("Data da conferência").fill("2026-10-29");
  await expect(page.getByTestId("conference-row-a1")).toBeVisible();
});
test("Conferente React mostra tela sem agenda, sem oferecer conclusões",async({page})=>{
  await setup(page,{empty:true});
  await expect(page.getByText(/Nenhuma agenda em/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Concluir dia"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Exportar PDF"})).toHaveCount(0);
});
test("Conferente React é responsivo e não cria rolagem horizontal da página",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  await expect(page.getByRole("heading",{name:"Conferência de recebimentos"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});
