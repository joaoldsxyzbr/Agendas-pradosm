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
      <div><span class="prado-store-eyebrow">ORGANIZAÇÃO DA LOJA</span>
        <h2>Personalize suas etiquetas</h2>
        <p>Crie identificações rápidas para reconhecer fornecedores durante a conferência.</p>
      </div>
      <span class="tags-page-count" data-tags-count aria-live="polite">0 de 100 tags</span>
    </div>
    <section class="tags-creator" aria-labelledby="tags-create-title">
      <div class="tags-section-heading"><span class="tags-section-icon" aria-hidden="true">+</span>
        <div><h3 id="tags-create-title">Nova etiqueta</h3><p>Escolha um nome curto e uma cor para identificá-la.</p></div>
      </div>
      <form data-tags-form class="tags-form">
        <label class="tags-name-field">Nome da tag<input name="name" maxlength="32" placeholder="Ex.: Descarga prioritária" required autocomplete="off"></label>
        <label class="tags-color-field">Cor<select name="color">${TAG_COLORS.map(color => `<option value="${color.value}">${color.label}</option>`).join("")}</select></label>
        <div class="tags-preview"><span>Prévia</span><span data-tags-preview class="supplier-tag supplier-tag-azul">Nome da tag</span></div>
        <button class="primary-button tags-create-button" type="submit">+ Criar tag</button>
      </form>
      <p class="form-error" data-tags-error role="alert" hidden></p>
    </section>
    <section class="tags-panel" aria-labelledby="tags-library-title">
      <div class="tags-panel-title"><div><h3 id="tags-library-title">Biblioteca de tags</h3>
        <p>Etiquetas disponíveis para os conferentes desta loja.</p></div>
        <label class="tags-search"><span class="sr-only">Buscar tags</span>
          <input type="search" data-tags-search placeholder="Buscar etiqueta..." aria-label="Buscar tags"></label>
      </div>
      <p class="muted-state" data-tags-loading>Carregando tags...</p>
      <div data-tags-list></div>
    </section>
  </section>`;
  const field=root.querySelector('[name="name"]');
  const errorNode=root.querySelector("[data-tags-error]");
  const search=root.querySelector("[data-tags-search]");
  const colorField=root.querySelector('[name="color"]');
  const preview=root.querySelector("[data-tags-preview]");
  const refreshPreview=()=>{
    const color=TAG_COLORS.some(item=>item.value===colorField.value)?colorField.value:"cinza";
    preview.className="supplier-tag supplier-tag-"+color;
    preview.textContent=field.value.trim()||"Nome da tag";
  };
  const onSearch=()=>render();
  field.addEventListener("input",refreshPreview);
  colorField.addEventListener("change",refreshPreview);
  search.addEventListener("input",onSearch);
  const showError=text=>{errorNode.textContent=text||"";errorNode.hidden=!text;};
  const render=()=>{
    root.querySelector("[data-tags-count]").textContent=`${tags.length} de 100 tags`;
    const query=search.value.trim().toLocaleLowerCase("pt-BR");
    const visible=tags.filter(tag=>tag.name.toLocaleLowerCase("pt-BR").includes(query));
    root.querySelector("[data-tags-list]").innerHTML=visible.length
      ? `<ul class="tags-list">${visible.map(tag => `<li class="tags-list-item">
          <div class="tags-list-info"><span class="tags-list-color supplier-tag-${escapeHtml(tag.color)}" aria-hidden="true"></span>
            <strong>${escapeHtml(tag.name)}</strong><span class="tags-list-subtitle">Etiqueta da loja</span></div>
          <div class="tags-list-actions">${tagChips([tag])}<button class="ghost-button" type="button" data-tag-archive="${escapeHtml(tag.id)}"
            aria-label="Arquivar tag ${escapeHtml(tag.name)}">Arquivar</button></div>
        </li>`).join("")}</ul>`
      : `<div class="tags-empty"><span aria-hidden="true">⌗</span><strong>${query?"Nenhuma tag encontrada":"Sua biblioteca está vazia"}</strong>
          <p>${query?"Tente buscar por outro nome.":"Crie uma etiqueta acima para organizar seus recebimentos."}</p></div>`;
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
      field.value="";refreshPreview();render();field.focus();
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
  return ()=>{disposed=true;root.removeEventListener("click",onClick);
    field.removeEventListener("input",refreshPreview);
    colorField.removeEventListener("change",refreshPreview);
    search.removeEventListener("input",onSearch);};
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
