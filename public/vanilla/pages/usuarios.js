import { filterUsers } from "../features/filtros.js";
import { auditMarkup, bindAudit } from "../features/auditoria.js";
export async function showUsers(ctx){
 const {state,root,$,$$,api,loadStores,heading,panel,table,badge,esc,statusLabel,isCurrent}=ctx;
 const [users]=await Promise.all([api("/api/admin/users"),loadStores()]);if(!isCurrent())return;state.users=users;
 const rows=items=>items.map(u=>`<tr><td class="cell-primary">${esc(u.nome)}</td><td>${esc(u.login)}</td><td>${esc(state.stores.find(s=>s.id===u.lojaId)?.nome||"—")}</td><td>${esc(statusLabel(u.papel))}</td><td>${badge(u.ativo?"ativo":"inativo")}</td><td><button class="mini-button" data-edit-user="${esc(u.id)}">Editar</button></td></tr>`);
 root.innerHTML=heading("Cadastros","Usuários","Controle de acesso e permissões, sem apagar o histórico.",'<button class="primary" id="new-user">Novo usuário</button>')+
 `<div class="filter-panel catalog-filters"><div class="filter-grid">
 <label class="field wide">Pesquisar usuário<input type="search" id="user-search" placeholder="Nome, login ou loja" value="${esc(state.userSearch||"")}"></label>
 <label class="field">Perfil<select id="user-role"><option value="todos">Todos</option><option value="admin">Administrador</option><option value="visualizador">Visualizador</option><option value="conferente">Conferente</option></select></label>
 <label class="field">Situação<select id="user-status"><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
 <span id="user-count" class="catalog-count" aria-live="polite"></span></div></div>`+
 panel("Usuários cadastrados",`${users.length} registros`,`<div id="users-list">${table(["Nome","Login","Loja","Perfil","Situação","Ação"],[])}</div>`);
 $("#user-role").value=state.userRole||"todos";$("#user-status").value=state.userStatus||"todos";
 const render=()=>{const visible=filterUsers(users,state.stores,state.userSearch,state.userRole,state.userStatus);
  $("#users-list tbody").innerHTML=rows(visible).join("")||'<tr><td class="empty" colspan="6">Nenhum usuário corresponde aos filtros.</td></tr>';
  $("#user-count").textContent=`${visible.length} de ${users.length} usuários`;
  $$("[data-edit-user]",$("#users-list")).forEach(b=>b.onclick=()=>{const item=users.find(u=>u.id===b.dataset.editUser);if(item)userDialog(ctx,item);});};
 $("#new-user").onclick=()=>userDialog(ctx);
 $("#user-search").oninput=e=>{state.userSearch=e.target.value;render();};
 $("#user-role").onchange=e=>{state.userRole=e.target.value;render();};
 $("#user-status").onchange=e=>{state.userStatus=e.target.value;render();};render();
}
function userDialog(ctx,user=null){
 const {state,$,esc,field,modal,json,navigate,tell}=ctx,roles=[["conferente","Conferente"],["visualizador","Visualizador"],["admin","Administrador"]];
 const body=field("Nome","nome",user?.nome||"")+field("Login","login",user?.login||"")+
 `<label class="field">Perfil<select name="papel" id="role-selector">${roles.map(([id,name])=>`<option value="${id}" ${id===(user?.papel||"conferente")?"selected":""}>${name}</option>`).join("")}</select></label>
 <label class="field" id="store-selector">Loja<select name="lojaId"><option value="">Selecione</option>${state.stores.map(s=>`<option value="${esc(s.id)}" ${s.id===user?.lojaId?"selected":""}>${esc(s.codigo)} · ${esc(s.nome)}</option>`).join("")}</select></label>
 <label class="field">${user?"Nova senha (opcional)":"Senha (mínimo 12 caracteres)"}<input name="senha" type="password" autocomplete="new-password" minlength="12" ${user?"":"required"}></label>
 ${user?`<label class="field">Acesso<select name="ativo"><option value="true" ${user.ativo?"selected":""}>Ativo</option><option value="false" ${user.ativo?"":"selected"}>Desativado</option></select></label>`:""}
 ${user?auditMarkup():""}`;
 const dialog=modal(user?"Editar usuário":"Novo usuário",body,"Salvar",async data=>{
  if(data.papel==="conferente"&&!data.lojaId)throw Error("Selecione uma loja para o conferente.");
  await json(user?"PATCH":"POST","/api/admin/users",{...(user?{id:user.id}:{}),nome:data.nome.trim(),login:data.login.trim(),papel:data.papel,...(data.papel==="conferente"?{lojaId:data.lojaId}:{}),...(data.senha?{senha:data.senha}:{}),...(user?{ativo:data.ativo==="true"}:{})});
  await navigate();tell("Usuário salvo.");
 });
 const role=$("#role-selector",dialog.host),sync=()=>{$("#store-selector",dialog.host).hidden=role.value!=="conferente";};role.onchange=sync;sync();
 if(user)bindAudit(ctx,dialog.host,"usuario",user.id);
}