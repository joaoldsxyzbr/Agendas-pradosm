export function formatWhen(value){const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(date);}

export function auditMarkup(){return `<section class="audit-section"><div class="audit-heading"><div><strong>Histórico de alterações</strong><small>Auditoria deste cadastro</small></div><button type="button" class="secondary" data-audit-toggle aria-expanded="false">Ver histórico</button></div><div data-audit-content class="audit-content" hidden></div></section>`;}

export function auditValues(value,esc){
 if(!value||typeof value!=="object")return "";
 const labels={nome:"Nome",login:"Login",codigo:"Código",ativo:"Ativo",lojaId:"Loja",papel:"Perfil",senhaAlterada:"Senha alterada"};
 return Object.entries(value).filter(([key])=>!/(senha_hash|password|token|secret)/i.test(key)).map(([key,v])=>`${esc(labels[key]||key)}: ${esc(typeof v==="boolean"?(v?"Sim":"Não"):String(v??"—"))}`).join(" · ");
}

export function renderHistory(items,esc,type="audit"){
 if(!items?.length)return '<p class="history-empty">Nenhuma alteração registrada.</p>';
 const labels={usuario_criado:"Usuário criado",usuario_atualizado:"Usuário atualizado",usuario_removido:"Usuário removido",loja_criada:"Loja criada",loja_atualizada:"Loja atualizada",loja_removida:"Loja removida",admin_bootstrap_preparado:"Administrador preparado"};
 return `<ol class="history-items">${items.map(item=>{
   const title=type==="status"?`${item.statusAnterior??"—"} → ${item.statusNovo??"—"}`:(labels[item.action]||item.details||item.action?.replaceAll("_"," ")||"Alteração");
   const who=item.user?.name||item.usuario?.nome||"Sistema",when=item.createdAt||item.changedAt||item.alteradoEm;
   return `<li><strong>${esc(title)}</strong><small>${esc(who)} · ${esc(formatWhen(when))}</small>
     ${item.details&&item.details!==title?`<p>${esc(item.details)}</p>`:""}
     ${item.before?`<p>Antes: ${auditValues(item.before,esc)}</p>`:""}
     ${item.after?`<p>Depois: ${auditValues(item.after,esc)}</p>`:""}</li>`;
 }).join("")}</ol>`;
}

export function bindAudit(ctx,host,entity,id){
 const button=host.querySelector("[data-audit-toggle]"),panel=host.querySelector("[data-audit-content]");
 if(!button||!panel)return;let loaded=false;
 button.onclick=async()=>{
  panel.hidden=!panel.hidden;button.textContent=panel.hidden?"Ver histórico":"Ocultar histórico";button.setAttribute("aria-expanded",String(!panel.hidden));
  if(panel.hidden||loaded)return;
  button.disabled=true;panel.innerHTML='<p class="loading" role="status">Carregando histórico…</p>';
  try{const query=new URLSearchParams({entity,entityId:id,limit:"50"});const records=await ctx.api(`/api/admin/audit?${query}`);
   if(!panel.isConnected)return;panel.innerHTML=renderHistory(records,ctx.esc);loaded=true;
  }catch(e){if(panel.isConnected)panel.innerHTML=`<p class="history-error" role="alert">${ctx.esc(e.message||"Não foi possível consultar o histórico.")}</p>`;}
  finally{button.disabled=false;}
 };
}
