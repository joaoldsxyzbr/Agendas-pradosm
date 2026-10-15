// Protótipo isolado de HTML/CSS/JavaScript puro. Não faz chamadas HTTP nem acessa o D1.
// Dados fictícios para revisar UX. A integração segura com D1 será feita por Worker.
const stores = [
  { code: "001", name: "Centro", area: "Florianópolis", active: true },
  { code: "002", name: "Kobrasol", area: "São José", active: true },
  { code: "003", name: "Biguaçu", area: "Biguaçu", active: true },
  { code: "004", name: "Palhoça", area: "Palhoça", active: true }
];
const users = [
  { id: 1, name: "Administrador de demonstração", role: "Administrador", store: "Todas", active: true },
  { id: 2, name: "Conferente Centro", role: "Conferente", store: "Centro", active: true },
  { id: 3, name: "Conferente Kobrasol", role: "Conferente", store: "Kobrasol", active: true },
  { id: 4, name: "Visualizador gerencial", role: "Visualizador", store: "Todas", active: true },
  { id: 5, name: "Conferente Palhoça", role: "Conferente", store: "Palhoça", active: false }
];
const appointments = [
  ["001","07:00","Distribuidora Serra Sul","AG-1082","recebido",12],
  ["001","07:30","Transvale Alimentos","AG-1083","aguardando",7],
  ["001","08:15","Frigorífico Santa Catarina","AG-1084","nao_chegou",15],
  ["002","08:30","Hortifruti Primavera","AG-1085","recebido",22],
  ["002","09:00","Distribuidora Serra Sul","AG-1086","recebido",10],
  ["003","09:30","Cooperativa Litoral","AG-1087","aguardando",13],
  ["003","10:00","Logística Vale do Itajaí","AG-1088","nao_chegou",8],
  ["003","10:45","Produtos Catarinenses","AG-1089","recebido",5],
  ["004","11:30","Transvale Alimentos","AG-1090","recebido",17],
  ["004","12:00","Hortifruti Primavera","AG-1091","aguardando",14]
].map(([store,time,supplier,protocol,status,volumes], i) => ({
  id:i+1,store,time,supplier,protocol,status,volumes,
  observation:status==="nao_chegou"?(i===2?"Transportadora informou atraso por problema mecânico.":"Fornecedor não compareceu no horário agendado."):"",
  exchanges:false
}));
const sections = {
  recebimento:"Recebimento", relatorios:"Relatórios gerenciais",
  conferente:"Conferente", lojas:"Lojas", usuarios:"Usuários"
};
const state = { view:"recebimento", store:"", search:"", reportStore:"", compare:true, date:new Date().toISOString().slice(0,10) };
const main = document.querySelector("#main");
let dialogReturnFocus = null;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
const byCode = code => stores.find(store => store.code === code);
const fmt = value => new Intl.NumberFormat("pt-BR").format(value);
const formatDate = value => value?.split("-").reverse().join("/") ?? "";
const statusName = status => ({ recebido:"Recebido", aguardando:"Aguardando", nao_chegou:"Não recebido" }[status] ?? status);
const statusChip = status => `<span class="status ${escapeHTML(status)}">${escapeHTML(statusName(status))}</span>`;
const count = (items, status) => items.filter(item => item.status === status).length;
const todayRows = () => appointments.filter(item => !state.store || item.store === state.store);
const rate = (received,total) => total ? (100*received/total).toFixed(1).replace(".",",")+"%" : "0%";
const stat = (label,value,foot,tone="var(--accent)") => `<div class="stat" style="--stat-tone:${tone}"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><small class="stat-foot">${foot}</small></div>`;
const pageHeading = (eyebrow,title,description,actions="") => `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="heading-note">${description}</p></div><div class="page-actions">${actions}</div></header>`;
const options = (selected,withAll=true) => `${withAll?'<option value="">Todas as lojas</option>':""}${stores.map(store=>`<option value="${store.code}" ${store.code===selected?"selected":""}>${store.code} · ${escapeHTML(store.name)}</option>`).join("")}`;
const tagMock = '<div class="alert"><strong>Prévia de interface:</strong> números e nomes abaixo são fictícios. Alterações são locais e não afetam agendas ou usuários reais.</div>';
const render = () => {
  document.title = "Agenda Prado | " + sections[state.view];
  document.querySelector("#breadcrumb").textContent = sections[state.view];
  document.querySelectorAll("[data-view-link]").forEach(el => {
    el.classList.toggle("active",el.dataset.viewLink===state.view);
    if (el.dataset.viewLink===state.view) el.setAttribute("aria-current","page");
    else el.removeAttribute("aria-current");
  });
  const content = ({recebimento:renderReceiving,relatorios:renderReports,conferente:renderStore,lojas:renderStores,usuarios:renderUsers})[state.view]();
  main.innerHTML = tagMock + content;
  main.querySelectorAll("[data-observation-id]").forEach(element => {
    const item=appointments.find(x => x.id === Number(element.dataset.observationId));
    element.textContent = item?.observation || "Sem motivo";
  });
  bindCurrentScreen();
};
function renderReceiving() {
  const rows = todayRows();
  const received=count(rows,"recebido");
  const missed=count(rows,"nao_chegou");
  const pending=count(rows,"aguardando");
  const summary = stores.map(store=> {
    const entries=rows.filter(item=>item.store===store.code);
    return {store,entries,received:count(entries,"recebido"),missed:count(entries,"nao_chegou")};
  }).filter(x=>x.entries.length>0);
  return pageHeading("Painel administrativo","Visão geral do recebimento","Acompanhe a operação por loja, com indicadores claros e acesso rápido às agendas.",
    '<button class="secondary" data-action="reset">Atualizar visualização</button>') +
    `<div class="stats">${stat("Agendamentos",fmt(rows.length),"Total do período")}${stat("Recebidos",fmt(received),rate(received,rows.length)+" do total","var(--positive)")}${stat("Não recebidos",fmt(missed),"Ocorrências registradas","var(--negative)")}${stat("Aguardando",fmt(pending),"Pendentes de conferência","var(--warning)")}</div>
    <div class="toolbar"><div><h2>Operação por loja</h2><p>Resumo diário das unidades</p></div><div class="filters-inline"><label class="field date">Data<input type="date" id="receiving-date" value=""></label><label class="field">Filtrar loja<select id="receiving-store">${options(state.store)}</select></label></div></div>
    <section class="card"><div class="table-scroll"><table><thead><tr><th>Unidade</th><th class="numeric">Agendamentos</th><th class="numeric">Recebidos</th><th class="numeric">Não recebidos</th><th>Desempenho</th><th>Acesso</th></tr></thead><tbody>
    ${summary.map(({store,entries,received,missed})=>`<tr><td><span class="cell-primary">${escapeHTML(store.code)} · ${escapeHTML(store.name)}</span><span class="cell-secondary">${escapeHTML(store.area)}</span></td><td class="numeric">${fmt(entries.length)}</td><td class="numeric">${received}</td><td class="numeric">${missed}</td><td><div class="progress"><span class="progress-track"><span style="width:${received*100/entries.length}%"></span></span><small>${rate(received,entries.length)}</small></div></td><td><button class="mini-button" data-go-store="${store.code}">Ver agenda</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">Nenhuma loja encontrada.</td></tr>'}
    </tbody></table></div></section>`;
}
function reportRows() {
  return stores.filter(store=>!state.reportStore||state.reportStore===store.code).map(store=>{
    const list=appointments.filter(a=>a.store===store.code);
    return {store,total:list.length,received:count(list,"recebido"),missed:count(list,"nao_chegou"),pending:count(list,"aguardando")};
  });
}
function renderReports() {
  const rows=reportRows(), total=rows.reduce((n,x)=>n+x.total,0), received=rows.reduce((n,x)=>n+x.received,0), missed=rows.reduce((n,x)=>n+x.missed,0);
  const occurrences=appointments.filter(a=>a.status==="nao_chegou"&&(!state.reportStore||a.store===state.reportStore));
  const suppliers=Object.entries(occurrences.reduce((result,a)=>(result[a.supplier]=(result[a.supplier]??0)+1,result),{})).sort((a,b)=>b[1]-a[1]);
  return pageHeading("Indicadores de gestão","Relatórios gerenciais","Resultados por unidade, ocorrências e comparativos para apoiar decisões.",
    '<button class="secondary" id="export-report">Exportar CSV</button>') +
    `<section class="filter-panel"><div class="filter-grid"><label class="field">De<input id="report-start" type="date" value=""></label><label class="field">Até<input id="report-end" type="date" value=""></label><label class="field wide">Loja<select id="report-store">${options(state.reportStore)}</select></label><label class="checkbox-line"><input id="report-compare" type="checkbox" ${state.compare?"checked":""}> Comparar com período anterior</label><button class="primary" id="apply-report">Aplicar filtros</button></div><p class="data-note">Nesta demonstração os registros são fictícios e não mudam com as datas selecionadas. A versão integrada consultará o D1.</p></section>
    <div class="stats">${stat("Total agendado",fmt(total),"No conjunto fictício")}${stat("Taxa de recebimento",rate(received,total),"Indicador do período","var(--positive)")}${stat("Não recebidos",fmt(missed),"Com motivo registrado","var(--negative)")}${stat("Lojas analisadas",rows.length,"Unidades no filtro","var(--warning)")}</div>
    <div class="grid-2"><section class="card"><div class="card-header"><div><h2>Desempenho por loja</h2><p>Volume e taxa de recebimento</p></div></div><div class="table-scroll"><table><thead><tr><th>Loja</th><th class="numeric">Total</th><th class="numeric">Recebidos</th><th class="numeric">Não recebidos</th><th class="numeric">Taxa</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td class="cell-primary">${escapeHTML(r.store.name)}</td><td class="numeric">${r.total}</td><td class="numeric">${r.received}</td><td class="numeric">${r.missed}</td><td class="numeric">${rate(r.received,r.total)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><div class="card-header"><div><h2>Fornecedores com ocorrências</h2><p>Não recebimentos registrados</p></div></div><div class="ranking">${suppliers.map(([name,n],i)=>`<div class="ranking-item"><span class="ranking-order">${String(i+1).padStart(2,"0")}</span><span class="ranking-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span><span class="ranking-count">${n}</span></div>`).join("") || '<div class="empty">Nenhuma ocorrência.</div>'}</div></section></div>
    <section class="card"><div class="card-header"><div><h2>Ocorrências e justificativas</h2><p>Registro de motivos por fornecedor</p></div></div><div class="table-scroll"><table><thead><tr><th>Loja</th><th>Fornecedor</th><th>Protocolo</th><th>Observação</th></tr></thead><tbody>${occurrences.map(a=>`<tr><td>${escapeHTML(byCode(a.store).name)}</td><td class="cell-primary">${escapeHTML(a.supplier)}</td><td>${escapeHTML(a.protocol)}</td><td class="detail-line"><span data-observation-id="${a.id}"></span></td></tr>`).join("") || '<tr><td colspan="4" class="empty">Nenhuma ocorrência.</td></tr>'}</tbody></table></div></section>`;
}
function renderStore() {
  const list=appointments.filter(a=>a.store==="003").filter(a=>!state.search||[a.supplier,a.protocol,a.observation].some(v=>v.toLowerCase().includes(state.search.toLowerCase())));
  const total=appointments.filter(a=>a.store==="003");
  const received=count(total,"recebido"),pending=count(total,"aguardando"),missed=count(total,"nao_chegou");
  return pageHeading("Operação de loja","Conferência de recebimentos","Loja 003 · Biguaçu · Visão operacional do conferente",
    `<button class="subtle-button" data-action="reset-search">Limpar busca</button>`) +
    `<div class="stats">${stat("Total do dia",fmt(total.length),"Agendamentos da loja")}${stat("Recebidos",received,"Confirmados","var(--positive)")}${stat("Aguardando",pending,"Pendentes","var(--warning)")}${stat("Não recebidos",missed,"Com justificativa","var(--negative)")}</div>
    <div class="toolbar"><div><h2>Agenda da loja</h2><p>Clique novamente no status selecionado para voltar a Aguardando</p></div><label class="field search">Buscar fornecedor ou protocolo<input id="store-search" type="search" placeholder="Pesquisar..." value=""></label></div>
    <section class="card"><div class="table-scroll"><table><thead><tr><th>Horário</th><th>Fornecedor</th><th>Protocolo</th><th>Status</th><th>Obs.</th><th>Ações</th></tr></thead><tbody>
    ${list.map(a=>`<tr><td>${escapeHTML(a.time)}</td><td class="cell-primary">${escapeHTML(a.supplier)}</td><td>${escapeHTML(a.protocol)}</td><td>${statusChip(a.status)}</td><td class="detail-line">${a.status==="nao_chegou"?`<span data-observation-id="${a.id}"></span>`:"—"}${a.status==="nao_chegou"?` <button class="mini-button" data-edit-reason="${a.id}" aria-label="Editar motivo de ${escapeHTML(a.supplier)}">Editar</button>`:""}</td><td><div class="inline-actions"><button class="mini-button ${a.status==="recebido"?"selected":""}" data-status-id="${a.id}" data-next-status="recebido" aria-label="Recebido: ${escapeHTML(a.supplier)}" aria-pressed="${a.status==="recebido"}">✓</button><button class="mini-button danger ${a.status==="nao_chegou"?"selected":""}" data-status-id="${a.id}" data-next-status="nao_chegou" aria-label="Não recebido: ${escapeHTML(a.supplier)}" aria-pressed="${a.status==="nao_chegou"}">✕</button></div></td></tr>`).join("") || '<tr><td colspan="6" class="empty">Nenhum fornecedor encontrado.</td></tr>'}
    </tbody></table></div><div class="section-help">Observações obrigatórias para “Não recebido”, limitadas a 240 caracteres. Esta prévia altera somente dados em memória.</div></section>`;
}
function renderStores() {
  return pageHeading("Cadastros","Lojas","Unidades organizadas para a administração diária.")+
    `<section class="card"><div class="card-header"><div><h2>Unidades cadastradas</h2><p>${stores.length} unidades · Dados de demonstração</p></div></div><div class="table-scroll"><table><thead><tr><th>Código</th><th>Loja</th><th>Cidade</th><th>Situação</th></tr></thead><tbody>${stores.map(s=>`<tr><td class="cell-primary">${s.code}</td><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.area)}</td><td>${statusChip(s.active?"ativo":"inativo")}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function renderUsers() {
  return pageHeading("Cadastros","Usuários","Acesso por perfil e situação do cadastro.")+
    `<section class="card"><div class="card-header"><div><h2>Usuários cadastrados</h2><p>Ativação e desativação serão ligadas à API segura na integração</p></div></div><div class="table-scroll"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Loja</th><th>Situação</th><th>Ação demonstrativa</th></tr></thead><tbody>${users.map(u=>`<tr><td class="cell-primary">${escapeHTML(u.name)}</td><td>${escapeHTML(u.role)}</td><td>${escapeHTML(u.store)}</td><td>${statusChip(u.active?"ativo":"inativo")}</td><td><button class="mini-button" data-toggle-user="${u.id}">${u.active?"Desativar":"Ativar"}</button></td></tr>`).join("")}</tbody></table></div></section>`;
}
function toast(message) {
  const host=document.querySelector("#toast-host");
  host.innerHTML=`<div class="toast">${escapeHTML(message)}</div>`;
}
function openReason(item) {
  dialogReturnFocus=document.activeElement;
  const host=document.querySelector("#dialog-host");
  host.innerHTML=`<div class="dialog-backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="reason-title"><h2 id="reason-title">Motivo do não recebimento</h2><p>${escapeHTML(item.supplier)} · ${escapeHTML(item.protocol)}</p><form id="reason-form"><label class="field">Observação (obrigatória)<textarea id="reason-value" maxlength="240" required placeholder="Descreva objetivamente o motivo."></textarea></label><span class="count" id="reason-count">0 / 240</span><div class="dialog-actions"><button class="secondary" type="button" id="reason-cancel">Cancelar</button><button class="primary" type="submit">Salvar motivo</button></div></form></div></div>`;
  const textarea=host.querySelector("#reason-value");
  textarea.value=item.observation ?? "";
  const updateCount=()=>{host.querySelector("#reason-count").textContent=`${textarea.value.length} / 240`;};
  updateCount(); textarea.addEventListener("input",updateCount);textarea.focus();
  const close=()=>{host.innerHTML="";dialogReturnFocus?.focus();dialogReturnFocus=null};
  host.querySelector("#reason-cancel").addEventListener("click",close);
  host.querySelector(".dialog-backdrop").addEventListener("click",e=>{if(e.target.classList.contains("dialog-backdrop"))close()});
  const onEscape=e=>{if(e.key==="Escape"){document.removeEventListener("keydown",onEscape);close()}};
  document.addEventListener("keydown",onEscape,{once:false});
  host.querySelector("#reason-form").addEventListener("submit",e=>{
    e.preventDefault();const value=textarea.value.trim();
    if(!value){textarea.setCustomValidity("Informe o motivo.");textarea.reportValidity();textarea.setCustomValidity("");return}
    if(value.length>240)return;
    item.status="nao_chegou";item.observation=value;document.removeEventListener("keydown",onEscape);
    close();render();toast("Motivo salvo apenas nesta demonstração.");
  });
}
function changeStatus(id,next) {
  const item=appointments.find(a=>a.id===id);if(!item)return;
  if(item.status===next){item.status="aguardando";item.observation="";render();toast("Status redefinido na prévia.");return}
  if(next==="nao_chegou"){openReason(item);return}
  item.status=next;item.observation="";render();toast("Status alterado somente nesta demonstração.");
}
function downloadCsv(){
  const rows=reportRows();
  const cell=v=>{let s=String(v);if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const content=[["Loja","Total","Recebidos","Não recebidos","Taxa"],...rows.map(r=>[r.store.name,r.total,r.received,r.missed,rate(r.received,r.total)])].map(line=>line.map(cell).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="relatorio-demo-agenda-prado.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bindCurrentScreen(){
  const dateInput=document.querySelector("#receiving-date"); if(dateInput)dateInput.value=state.date;
  const startInput=document.querySelector("#report-start"); if(startInput)startInput.value=state.start??state.date;
  const endInput=document.querySelector("#report-end"); if(endInput)endInput.value=state.end??state.date;
  const searchInput=document.querySelector("#store-search"); if(searchInput)searchInput.value=state.search;
  document.querySelector("#receiving-store")?.addEventListener("change",e=>{state.store=e.target.value;render()});
  document.querySelector("#receiving-date")?.addEventListener("change",e=>{state.date=e.target.value;render()});
  document.querySelector("#store-search")?.addEventListener("input",e=>{
    const cursor=e.target.selectionStart;
    state.search=e.target.value;
    render(); const input=document.querySelector("#store-search");input?.focus();input?.setSelectionRange(cursor,cursor);
  });
  document.querySelector("#report-store")?.addEventListener("change",e=>{state.reportStore=e.target.value;render()});
  document.querySelector("#report-compare")?.addEventListener("change",e=>{state.compare=e.target.checked});
  document.querySelector("#apply-report")?.addEventListener("click",()=>{
    const start=document.querySelector("#report-start").value,end=document.querySelector("#report-end").value;
    if(!start||!end||start>end){toast("Confira o intervalo selecionado.");return}
    const days=Math.round((Date.parse(end+"T00:00:00Z")-Date.parse(start+"T00:00:00Z"))/86400000)+1;
    if(days>93){toast("Selecione até 93 dias.");return}
    state.start=start;state.end=end;render();toast("Filtros aplicados aos dados demonstrativos.");
  });
  document.querySelector("#export-report")?.addEventListener("click",downloadCsv);
  main.querySelectorAll("[data-status-id]").forEach(el=>el.addEventListener("click",()=>changeStatus(Number(el.dataset.statusId),el.dataset.nextStatus)));
  main.querySelectorAll("[data-edit-reason]").forEach(el=>el.addEventListener("click",()=>{
    const item=appointments.find(x=>x.id===Number(el.dataset.editReason));if(item)openReason(item);
  }));
  main.querySelectorAll("[data-toggle-user]").forEach(el=>el.addEventListener("click",()=>{
    const user=users.find(x=>x.id===Number(el.dataset.toggleUser));if(user){user.active=!user.active;render();toast("Usuário alterado apenas na prévia.");}
  }));
  main.querySelectorAll("[data-go-store]").forEach(el=>el.addEventListener("click",()=>{state.view="conferente";location.hash="conferente";render()}));
  main.querySelectorAll("[data-action=reset-search]").forEach(el=>el.addEventListener("click",()=>{state.search="";render()}));
  main.querySelectorAll("[data-action=reset]").forEach(el=>el.addEventListener("click",()=>{state.store="";render();toast("Visualização atualizada.")}));
}
function navigate(){
  const next=location.hash.slice(1);
  state.view=Object.hasOwn(sections,next)?next:"recebimento";
  document.querySelector(".app-shell").classList.remove("nav-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded","false");
  render();
}
document.querySelector("#menu-toggle").addEventListener("click",()=>{
  const open=document.querySelector(".app-shell").classList.toggle("nav-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded",String(open));
});
window.addEventListener("hashchange",navigate);
navigate();
