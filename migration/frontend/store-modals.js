import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";

export function openSupplierModal(root, {
  editing = null, request = apiFetch, selectedDate,
  onSaved = () => {}, onDeleted = () => {}
} = {}) {
  let disposed = false, saving = false, deleting = false, confirmDelete = false;
  let supplier = editing?.supplier || "", message = null;
  const rootModal = root.ownerDocument.createElement("div");
  rootModal.className = "modal-backdrop";
  rootModal.setAttribute("role","presentation");
  root.appendChild(rootModal);
  const draw = () => {
    if (disposed) return;
    rootModal.innerHTML = `<div class="modal-card manual-supplier-modal" role="dialog" aria-modal="true"
      aria-labelledby="${confirmDelete ? "delete-manual-title" : "manual-supplier-title"}">
    <div class="modal-heading"><div><span class="eyebrow">Recebimento</span>
    <h2 id="${confirmDelete ? "delete-manual-title" : "manual-supplier-title"}">
      ${confirmDelete ? "Remover fornecedor" : editing ? "Editar fornecedor" : "Fornecedor sem agenda"}
    </h2></div>
    ${confirmDelete ? "" : '<button class="ghost-button" type="button" data-manual-close>Fechar</button>'}
    </div>
    ${confirmDelete ? `<p>Remover ${escapeHtml(editing.supplier)}? O registro ficará preservado no histórico de auditoria.</p>
      <p class="form-error" role="alert" ${message ? "" : "hidden"}>${escapeHtml(message || "")}</p>
      <div class="modal-actions">
        <button class="ghost-button" type="button" data-manual-cancel>Cancelar</button>
        <button class="danger-button" type="button" data-manual-confirm ${deleting?"disabled":""}>
          ${deleting?"Removendo...":"Remover"}</button>
      </div>` :
    `<form class="modal-form" data-manual-form>
       <label>Nome do fornecedor
         <input type="text" name="supplier" maxlength="160" required value="${escapeHtml(supplier)}">
       </label>
       <p class="form-error" role="alert" ${message ? "" : "hidden"}>${escapeHtml(message || "")}</p>
       <div class="modal-actions" style="${editing?"justify-content:space-between;gap:0.75rem":""}">
         ${editing ? '<button class="danger-button" type="button" data-manual-request-delete>Remover</button>' : ""}
         <div style="display:flex;align-items:center;justify-content:flex-end;gap:0.5rem">
           <button class="ghost-button" type="button" data-manual-close>Cancelar</button>
           <button class="primary-button" type="submit" ${saving?"disabled":""}>
             ${saving ? editing?"Salvando...":"Adicionando..." : editing?"Salvar":"Adicionar"}</button>
         </div>
       </div>
     </form>`}
    </div>`;
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    rootModal.remove();
  };
  const onClick = async event => {
    const control = event.target.closest?.("button");
    if (!control || !rootModal.contains(control) || saving || deleting) return;
    if (control.matches("[data-manual-close]")) return close();
    if (control.matches("[data-manual-request-delete]")) {
      supplier = rootModal.querySelector('[name="supplier"]')?.value || supplier;
      confirmDelete = true; message = null; draw(); return;
    }
    if (control.matches("[data-manual-cancel]")) {
      confirmDelete = false; message = null; draw(); return;
    }
    if (control.matches("[data-manual-confirm]") && editing) {
      deleting = true; message = null; draw();
      try {
        await request(`/api/store/appointments/${encodeURIComponent(editing.id)}/manual`,{
          method:"DELETE"
        });
        if (disposed) return;
        onDeleted(editing.id);
        close();
      } catch(err) {
        message = err instanceof ApiError ? err.message : "Não foi possível remover o fornecedor.";
      } finally { deleting=false; draw(); }
    }
  };
  const onSubmit = async event => {
    if (!event.target.matches("[data-manual-form]")) return;
    event.preventDefault();
    if (saving) return;
    supplier = event.target.elements.namedItem("supplier").value.trim();
    if (!supplier) return;
    saving = true; message = null; draw();
    try {
      const saved = await request(editing
        ? `/api/store/appointments/${encodeURIComponent(editing.id)}/manual`
        : `/api/store/agenda/${encodeURIComponent(selectedDate)}/manual`,{
          method: editing?"PATCH":"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({supplier})
      });
      if (disposed) return;
      onSaved(saved,Boolean(editing));
      close();
    } catch(err) {
      message = err instanceof Error ? err.message : "Não foi possível adicionar o fornecedor.";
    } finally { saving=false; draw(); }
  };
  rootModal.addEventListener("click",onClick);
  rootModal.addEventListener("submit",onSubmit);
  draw();
  rootModal.querySelector("input")?.focus();
  return close;
}

export function openCompleteDayModal(root, {
  selectedDate, request = apiFetch, onComplete = () => {}
} = {}) {
  let disposed = false, busy = false, message = null;
  const backdrop = root.ownerDocument.createElement("div");
  backdrop.className="modal-backdrop";
  backdrop.setAttribute("role","presentation");
  root.appendChild(backdrop);
  const draw=()=>{
    if (disposed) return;
    backdrop.innerHTML=`<div class="modal-card manual-supplier-modal"
      role="dialog" aria-modal="true" aria-labelledby="complete-day-title">
      <div class="modal-heading"><div><span class="eyebrow">Fechamento</span>
        <h2 id="complete-day-title">Concluir dia</h2></div></div>
      <p>Depois de concluir, a agenda ficará somente para consulta até que um administrador a reabra.</p>
      <p class="form-error" ${message?"": "hidden"}>${escapeHtml(message || "")}</p>
      <div class="modal-actions">
        <button class="ghost-button" type="button" data-complete-cancel ${busy?"disabled":""}>Cancelar</button>
        <button class="primary-button" type="button" data-complete-confirm ${busy?"disabled":""}>
          ${busy?"Concluindo...":"Concluir dia"}</button>
      </div></div>`;
  };
  const close=()=>{disposed=true;backdrop.remove();};
  backdrop.addEventListener("click",async event=>{
    const button=event.target.closest?.("button");
    if(!button||busy) return;
    if(button.matches("[data-complete-cancel]"))return close();
    if(!button.matches("[data-complete-confirm]"))return;
    busy=true;message=null;draw();
    try{
      const agenda=await request(`/api/store/agenda/${encodeURIComponent(selectedDate)}/complete`,{
        method:"POST"
      });
      if(disposed)return;
      onComplete(agenda);
      close();
    }catch(err){
      message=err instanceof ApiError ? err.message : "Não foi possível concluir o dia.";
    }finally{busy=false;draw();}
  });
  draw();
  return close;
}
