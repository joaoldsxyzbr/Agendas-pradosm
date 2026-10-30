import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";

export const TAG_COLORS = Object.freeze([
  { value:"azul",label:"Azul" },{ value:"verde",label:"Verde" },
  { value:"amarelo",label:"Amarelo" },{ value:"vermelho",label:"Vermelho" },
  { value:"roxo",label:"Roxo" },{ value:"cinza",label:"Cinza" }
]);
export function tagChips(tags=[]) {
  return tags.map(tag => {
    const color = TAG_COLORS.some(option => option.value === tag.color) ? tag.color : "cinza";
    return `<span class="supplier-tag supplier-tag-${color}">${escapeHtml(tag.name)}</span>`;
  }).join("");
}

export function renderTags(root,{request=apiFetch}={}) {
  let disposed=false, tags=[],busy=false;
  root.innerHTML=`<section class="tags-page">
    <div class="tags-page-head">
      <div><span class="prado-store-eyebrow">ORGANIZAÇÃO</span>
        <h2>Tags de fornecedores</h2>
        <p>Crie etiquetas para identificar recebimentos na agenda da sua loja.</p>
      </div>
    </div>
    <form data-tags-form class="tags-form">
      <label>Nome da tag<input name="name" maxlength="32" placeholder="Ex.: Atenção na descarga" required autocomplete="off"></label>
      <label>Cor<select name="color">${TAG_COLORS.map(color => `<option value="${color.value}">${color.label}</option>`).join("")}</select></label>
      <button class="primary-button" type="submit">Criar tag</button>
    </form>
    <p class="form-error" data-tags-error role="alert" hidden></p>
    <div class="tags-panel"><div class="tags-panel-title"><h3>Tags cadastradas</h3>
       <span data-tags-count></span></div>
      <p class="muted-state" data-tags-loading>Carregando tags...</p>
      <div data-tags-list></div>
    </div>
  </section>`;
  const field=root.querySelector('[name="name"]');
  const errorNode=root.querySelector("[data-tags-error]");
  const showError=text=>{errorNode.textContent=text||"";errorNode.hidden=!text;};
  const render=()=>{
    root.querySelector("[data-tags-count]").textContent=`${tags.length} de 100`;
    root.querySelector("[data-tags-list]").innerHTML=tags.length
      ? `<ul class="tags-list">${tags.map(tag => `<li class="tags-list-item">
          ${tagChips([tag])}<button class="ghost-button" type="button" data-tag-archive="${escapeHtml(tag.id)}"
            aria-label="Arquivar tag ${escapeHtml(tag.name)}">Arquivar</button>
        </li>`).join("")}</ul>`
      : '<p class="tags-empty">Nenhuma tag criada. Cadastre a primeira acima.</p>';
  };
  const load=async()=>{
    try{tags=await request("/api/store/tags");if(!disposed)render();}
    catch {if(!disposed)showError("Não foi possível carregar as tags. Verifique se o banco de testes está atualizado.");}
    finally{if(!disposed)root.querySelector("[data-tags-loading]").hidden=true;}
  };
  const onSubmit=async event=>{
    event.preventDefault();
    if(busy)return;
    busy=true;showError("");
    const submit=root.querySelector('[data-tags-form] button[type="submit"]');
    submit.disabled=true;
    try{
      const name=field.value.trim();
      const color=root.querySelector('[name="color"]').value;
      if(!name)throw Error("Informe o nome da tag.");
      const created=await request("/api/store/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,color})});
      tags=[...tags,created].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
      field.value="";render();field.focus();
    }catch(error){showError(error instanceof ApiError?error.message:error.message||"Não foi possível criar a tag.");}
    finally{busy=false;submit.disabled=false;}
  };
  const onClick=async event=>{
    const button=event.target.closest?.("[data-tag-archive]");
    if(!button||busy)return;
    const tag=tags.find(entry=>entry.id===button.dataset.tagArchive);
    if(!tag||!root.ownerDocument.defaultView.confirm(`Arquivar a tag "${tag.name}"? Ela continuará visível nos registros anteriores, mas não poderá ser aplicada novamente.`))return;
    busy=true;button.disabled=true;showError("");
    try{
      await request(`/api/store/tags/${encodeURIComponent(tag.id)}`,{method:"DELETE"});
      tags=tags.filter(item=>item.id!==tag.id);
      render();
    }catch(error){showError(error instanceof ApiError?error.message:"Não foi possível arquivar a tag.");button.disabled=false;}
    finally{busy=false;}
  };
  root.querySelector("[data-tags-form]").addEventListener("submit",onSubmit);
  root.addEventListener("click",onClick);
  void load();
  return ()=>{disposed=true;root.removeEventListener("click",onClick);};
}

export function openAppointmentTagsDialog(root,{appointment,tags=[],request=apiFetch,onSaved=()=>{},trigger}={}) {
  let disposed=false,busy=false;
  const selected=new Set((appointment.tags||[]).map(tag=>tag.id));
  const overlay=root.ownerDocument.createElement("div");
  overlay.className="modal-backdrop supplier-tags-backdrop";
  overlay.innerHTML=`<form class="modal-card supplier-tags-dialog" role="dialog" aria-modal="true"
    aria-labelledby="supplier-tags-title">
    <div class="modal-heading"><div><span class="eyebrow">Conferência</span>
      <h2 id="supplier-tags-title">Tags do fornecedor</h2></div>
      <button type="button" class="ghost-button" data-tags-close>Fechar</button>
    </div>
    <p class="supplier-tags-supplier">${escapeHtml(appointment.supplier)}</p>
    <p class="supplier-tags-hint">Escolha até 5 etiquetas para este agendamento.</p>
    <div class="supplier-tags-choices">
      ${tags.length?tags.map(tag=>`<label class="supplier-tags-choice">
        <input type="checkbox" value="${escapeHtml(tag.id)}" ${selected.has(tag.id)?"checked":""}>
        ${tagChips([tag])}</label>`).join(""):'<p class="tags-empty">Nenhuma tag cadastrada. Crie etiquetas na aba Tags.</p>'}
    </div>
    <p class="form-error" data-tags-dialog-error role="alert" hidden></p>
    <div class="supplier-tags-actions"><button class="ghost-button" type="button" data-tags-close>Cancelar</button>
      <button class="primary-button" type="submit">Salvar tags</button></div>
  </form>`;
  root.ownerDocument.body.appendChild(overlay);
  const dialog=overlay.querySelector("form"),errorNode=overlay.querySelector("[data-tags-dialog-error]");
  const closeFocus=activateModal(dialog,{onEscape:()=>close(),trigger});
  const close=()=>{
    if(disposed)return;disposed=true;closeFocus();overlay.remove();
  };
  overlay.addEventListener("click",event=>{if(event.target===overlay||event.target.closest("[data-tags-close]"))close();});
  overlay.addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy)return;
    const ids=[...dialog.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
    if(ids.length>5){errorNode.hidden=false;errorNode.textContent="Selecione no máximo 5 tags.";return;}
    busy=true;dialog.querySelector('[type="submit"]').disabled=true;errorNode.hidden=true;
    try{
      const result=await request(`/api/store/tags/appointments/${encodeURIComponent(appointment.id)}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tagIds:ids})
      });
      if(!disposed){onSaved(result.tags);close();}
    }catch(error){
      if(disposed)return;
      errorNode.textContent=error instanceof ApiError?error.message:"Não foi possível salvar as tags.";
      errorNode.hidden=false;dialog.querySelector('[type="submit"]').disabled=false;busy=false;
    }
  });
  return close;
}
