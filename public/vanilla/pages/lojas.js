import { filterStores } from "../features/filtros.js";
import { auditMarkup, bindAudit } from "../features/auditoria.js";
export async function showStores(ctx){
 const {state,root,$,$$,loadStores,heading,panel,table,esc,badge,isCurrent}=ctx;await loadStores();if(!isCurrent())return;
 const rows=items=>items.map(s=>`<tr><td class="cell-primary">${esc(s.codigo)}</td><td>${esc(s.nome)}</td><td>${badge(s.ativo?"ativo":"inativo")}</td><td><button class="mini-button" data-edit-store="${esc(s.id)}">Editar</button></td></tr>`);
 root.innerHTML=heading("Cadastros","Lojas","Administração das unidades e vínculos de conferentes.",'<button class="primary" id="new-store">Nova loja</button>')+
 `<div class="filter-panel catalog-filters"><div class="filter-grid"><label class="field wide">Pesquisar loja<input type="search" id="store-search" placeholder="Código ou nome" value="${esc(state.storeSearch||"")}"></label>
 <label class="field">Situação<select id="store-status"><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></label>
 <span class="catalog-count" id="store-count" aria-live="polite"></span></div></div>`+
 panel("Lojas cadastradas",`${state.stores.length} registros`,`<div id="stores-list">${table(["Código","Nome","Situação","Ação"],[])}</div>`);
 $("#store-status").value=state.storeStatus||"todas";
 const render=()=>{const visible=filterStores(state.stores,state.storeSearch,state.storeStatus);$("#stores-list tbody").innerHTML=rows(visible).join("")||'<tr><td class="empty" colspan="4">Nenhuma loja corresponde aos filtros.</td></tr>';
  $("#store-count").textContent=`${visible.length} de ${state.stores.length} lojas`;
  $$("[data-edit-store]",$("#stores-list")).forEach(b=>b.onclick=()=>{const item=state.stores.find(s=>s.id===b.dataset.editStore);if(item)storeDialog(ctx,item);});};
 $("#new-store").onclick=()=>storeDialog(ctx);
 $("#store-search").oninput=e=>{state.storeSearch=e.target.value;render();};
 $("#store-status").onchange=e=>{state.storeStatus=e.target.value;render();};
 render();
}
function storeDialog(ctx,store=null){
 const {field,modal,json,navigate,tell,api,asyncAction,$}=ctx;
 const body=field("Código","codigo",store?.codigo||"")+field("Nome","nome",store?.nome||"")+
 (store?`<label class="field">Situação<select name="ativo"><option value="true" ${store.ativo?"selected":""}>Ativa</option><option value="false" ${store.ativo?"":"selected"}>Inativa</option></select></label>`:"")+(store?auditMarkup():"")+
 (store?`<section class="store-danger"><div><strong>Excluir loja</strong><small>Preserva agendas e histórico. Bloqueado se houver usuários vinculados.</small></div><button type="button" class="secondary" id="delete-store">Excluir loja</button></section>`:"");
 const d=modal(store?"Editar loja":"Nova loja",body,"Salvar",async data=>{
  await json(store?"PATCH":"POST","/api/admin/stores",{...(store?{id:store.id}:{}),codigo:data.codigo.trim().toUpperCase(),nome:data.nome.trim(),...(store?{ativo:data.ativo==="true"}:{})});
  await navigate();tell("Loja salva.");
 });
 if(store) {
   bindAudit(ctx,d.host,"loja",store.id);
   $("#delete-store",d.host).onclick=()=>asyncAction(async()=>{
     if(!confirm(`Excluir a loja ${store.codigo} · ${store.nome}? A operação não apaga agendas nem histórico.`))return;
     await api("/api/admin/stores/"+encodeURIComponent(store.id),{method:"DELETE"});
     d.close();
     await navigate();
     tell("Loja excluída do cadastro; histórico preservado.");
   });
 }
}
