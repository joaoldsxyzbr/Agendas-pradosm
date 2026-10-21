import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";

// Ações administrativas só são abertas após entrar no modo de edição.
export function openAdminManualDialog(root, {
  editing=null, startDelete=false, agendaId,request,onSaved=()=>{},onDeleted=()=>{}
}={}) {
  let closed=false,busy=false,deleteConfirm=Boolean(editing&&startDelete),error="";
  const trigger=root.ownerDocument.activeElement;
  let releaseFocus=()=>{};
  const backdrop=root.ownerDocument.createElement("div");
  backdrop.className="modal-backdrop";
  backdrop.setAttribute("role","presentation");
  root.appendChild(backdrop);
  let supplier=editing?.supplier||"";
  const draw=()=>{
    if(closed)return;
    backdrop.innerHTML=`<div class="modal-card manual-supplier-modal" role="dialog" tabindex="-1"
      aria-modal="true" aria-labelledby="admin-manual-supplier-title">
      <div class="modal-heading"><div><span class="eyebrow">${deleteConfirm?"Confirmação":"Ajuste administrativo"}</span>
        <h2 id="admin-manual-supplier-title">${deleteConfirm?"Excluir fornecedor":
          editing?"Editar fornecedor":"Fornecedor sem agenda"}</h2></div>
        <button class="ghost-button" type="button" data-admin-manual-close ${busy?"disabled":""}>Fechar</button>
      </div>
      ${deleteConfirm ? `<p>Excluir <strong>${escapeHtml(editing.supplier)}</strong> desta agenda?</p>
        <p class="muted-state">A remoção fica registrada na auditoria.</p>
        <p class="form-error" ${error?"":"hidden"}>${escapeHtml(error)}</p>
        <div class="modal-actions">
          <button class="ghost-button" type="button" data-admin-manual-cancel ${busy?"disabled":""}>Cancelar</button>
          <button class="primary-button" type="button" data-admin-manual-delete ${busy?"disabled":""}>
            ${busy?"Excluindo...":"Excluir fornecedor"}</button>
        </div>`:
      `<form class="modal-form" data-admin-manual-form>
        <label>Nome do fornecedor<input type="text" name="supplier" maxlength="160"
          required value="${escapeHtml(supplier)}"></label>
        <p class="form-error" ${error?"":"hidden"}>${escapeHtml(error)}</p>
        <div class="modal-actions">
          ${editing?'<button class="danger-button" type="button" data-admin-manual-request-delete>Excluir fornecedor</button>':""}
          <button class="ghost-button" type="button" data-admin-manual-close ${busy?"disabled":""}>Cancelar</button>
          <button class="primary-button" type="submit" ${busy?"disabled":""}>
            ${busy?editing?"Salvando...":"Adicionando...":editing?"Salvar":"Adicionar"}</button>
        </div></form>`}
      </div>`;
    const target=deleteConfirm?backdrop.querySelector("[data-admin-manual-cancel]"):backdrop.querySelector("[name=supplier]");
    (target&&!target.disabled?target:backdrop.querySelector('[role="dialog"]'))?.focus({preventScroll:true});
  };
  const close=()=>{if(closed)return;closed=true;releaseFocus();backdrop.remove();};
  backdrop.addEventListener("click",async event=>{
    const button=event.target.closest?.("button");
    if(!button||!backdrop.contains(button)||busy)return;
    if(button.matches("[data-admin-manual-close]"))return close();
    if(button.matches("[data-admin-manual-request-delete]")&&editing) {
      supplier=backdrop.querySelector("[name=supplier]")?.value||supplier;
      deleteConfirm=true;error="";draw();return;
    }
    if(button.matches("[data-admin-manual-cancel]")) {
      deleteConfirm=false;error="";draw();return;
    }
    if(button.matches("[data-admin-manual-delete]")&&editing){
      busy=true;error="";draw();
      try{
        await request(`/api/admin/appointments/${encodeURIComponent(editing.id)}/manual`,{
          method:"DELETE"
        });
        if(closed)return;
        onDeleted(editing.id);close();
      }catch(e){error=e instanceof Error?e.message:"Não foi possível excluir o fornecedor.";}
      finally{busy=false;draw();}
    }
  });
  backdrop.addEventListener("submit",async event=>{
    if(!event.target.matches("[data-admin-manual-form]"))return;
    event.preventDefault();if(busy)return;
    supplier=event.target.elements.namedItem("supplier").value.trim();
    if(!supplier)return;
    busy=true;error="";draw();
    try{
      const saved=await request(editing
        ?`/api/admin/appointments/${encodeURIComponent(editing.id)}/manual`
        :`/api/admin/agendas/${encodeURIComponent(agendaId)}/manual`,{
          method:editing?"PATCH":"POST",
          headers:{"Content-Type":"application/json"},body:JSON.stringify({supplier})
        });
      if(closed)return;
      onSaved(saved,Boolean(editing));close();
    }catch(e){error=e instanceof Error?e.message:"Não foi possível salvar o fornecedor.";}
    finally{busy=false;draw();}
  });
  draw();
  releaseFocus=activateModal(()=>backdrop.querySelector('[role="dialog"]'),{
    initialFocus:()=>deleteConfirm?backdrop.querySelector("[data-admin-manual-cancel]"):backdrop.querySelector("[name=supplier]"),
    onEscape:()=>{if(!busy)close();},trigger
  });
  return close;
}