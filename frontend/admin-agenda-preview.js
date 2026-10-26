import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { renderAgendaList,normalizeAgendaSearch,sortAgendaAppointments } from "./agenda-list.js";
import { storeAgendaMetrics,formatStoreDate } from "./store-agenda-model.js";
import { openAdminManualDialog } from "./admin-manual-dialog.js";
import { activateModal } from "./dialog-focus.js";
import { openCrossAgendaImport } from "./cross-agenda-import.js";

// Popup AdminAgendaPreview da main: consulta primeiro, edita só após autorização manual.
export function openAdminAgendaPreview(root,{
  agendaId,canReopen=false,canEdit=false,request=apiFetch,
  realtime=null,onAgendaChanged=()=>{},onClose=()=>{}
}={}) {
  let disposed=false,loading=true,error=null,detail=null,editMode=false;
  let reopening=false,search="",list=null,manualClose=null,crossClose=null,requestToken=0;
  let releaseFocus=()=>{};
  const backdrop=root.ownerDocument.createElement("div");
  backdrop.className="modal-backdrop";
  backdrop.setAttribute("role","presentation");
  backdrop.innerHTML=`<div class="modal-card agenda-preview-modal" role="dialog" aria-modal="true"
    aria-labelledby="admin-agenda-preview-title">
    <div class="modal-heading"><div><span class="eyebrow">Consulta</span>
      <h2 id="admin-agenda-preview-title" data-preview-heading tabindex="-1">Detalhes da agenda</h2></div>
      <button class="ghost-button" type="button" data-preview-close>Fechar</button>
    </div>
    <p class="muted-state" data-preview-loading>Carregando agenda...</p>
    <p class="form-error" data-preview-error hidden></p>
    <section class="store-page admin-agenda-preview" data-preview-content hidden>
      <div class="agenda-preview-context"><div>
        <strong data-preview-date></strong><span>Visualização do conferente</span>
      </div><div class="agenda-preview-status">
        <button class="status-pill warning agenda-preview-reopen" type="button"
          data-preview-reopen hidden>Reabrir para conferente</button>
        <span class="status-pill agenda-preview-day-status" data-preview-day-status></span>
        ${canEdit ? '<button class="ghost-button" type="button" data-preview-cross-import hidden>Importar Cross</button>' : ""}
        <span class="status-pill muted" data-preview-cross-note hidden>Cross importado</span>
        ${canEdit ? '<button class="ghost-button" type="button" aria-pressed="false" data-preview-edit>Editar agenda</button>':""}
        <span class="status-pill muted" data-preview-edit-state>Somente leitura</span>
      </div></div>
      <section class="agenda-metrics" aria-label="Resumo da agenda">
        <span class="agenda-metric agenda-metric-total"><strong data-preview-count="total">0</strong> total</span>
        <span class="agenda-metric agenda-metric-pending"><strong data-preview-count="aguardando">0</strong> aguardando</span>
        <span class="agenda-metric agenda-metric-success"><strong data-preview-count="recebido">0</strong> recebidos</span>
        <span class="agenda-metric agenda-metric-danger"><strong data-preview-count="naoChegou">0</strong> não recebidos</span>
        <span class="agenda-metric agenda-metric-exchange"><strong data-preview-count="trocas">0</strong> trocas</span>
      </section>
      <div class="agenda-toolbar">
        <label class="agenda-search"><span class="sr-only">Pesquisar fornecedor ou protocolo</span>
          <input type="search" data-preview-search
            aria-label="Pesquisar fornecedor ou protocolo" placeholder="Pesquisar fornecedor ou protocolo" autocomplete="off">
        </label>
        <button class="ghost-button agenda-manual-button" type="button" data-preview-add hidden>+ Fornecedor sem agenda</button>
      </div>
      <div data-preview-list></div>
      <div class="empty-panel agenda-search-empty" data-preview-empty hidden>Nenhum fornecedor ou protocolo encontrado.</div>
    </section>
  </div>`;
  root.appendChild(backdrop);
  const body=root.ownerDocument.body;
  const previousBodyOverflow=body.style.overflow;
  body.style.overflow="hidden";
  const field=selector=>backdrop.querySelector(selector);
  const close=()=>{
    if(disposed)return;
    disposed=true;requestToken++;
    body.style.overflow=previousBodyOverflow;
    crossClose?.();crossClose=null;
    manualClose?.();list?.destroy();
    offRealtime();
    releaseFocus();
    backdrop.remove();
    onClose();
  };
  const setError=value=>{
    error=value;
    field("[data-preview-error]").textContent=error||"";
    field("[data-preview-error]").hidden=!error;
  };
  const effectiveEditable=()=>canEdit&&editMode;
  const isDock01=()=>detail?.agenda?.storeCode?.trim().toUpperCase()==="CD DOCA 01";
  const openCross=()=>{
    if(!canEdit||!isDock01()||!detail||detail.agenda.dayStatus==="concluido"||crossClose)return;
    crossClose=openCrossAgendaImport(root,{
      agenda:detail.agenda,appointments:detail.appointments,request,
      onClose:()=>{crossClose=null;},
      onImported:()=>{
        const badge=field("[data-preview-cross-note]");
        if(badge)badge.hidden=false;
      }
    });
  };
  const appointmentChanged=updated=>{
    if(!detail||!effectiveEditable())return;
    detail={...detail,appointments:detail.appointments.map(x=>x.id===updated.id?updated:x)};
    renderDetail();
    onAgendaChanged();
  };
  const openManual=(editing,startDelete=false)=>{
    if(!effectiveEditable()||!detail)return;
    manualClose?.();
    manualClose=openAdminManualDialog(root,{
      editing,startDelete,agendaId,request,
      onSaved:(saved,wasEditing)=>{
        if(!detail)return;
        detail={...detail,appointments:wasEditing
          ?detail.appointments.map(x=>x.id===saved.id?saved:x)
          :[...detail.appointments,saved]};
        search="";field("[data-preview-search]").value="";
        renderDetail();onAgendaChanged();
      },
      onDeleted:id=>{
        if(!detail)return;
        detail={...detail,appointments:detail.appointments.filter(x=>x.id!==id)};
        renderDetail();onAgendaChanged();
      }
    });
  };
  function renderDetail(){
    if(disposed)return;
    field("[data-preview-loading]").hidden=!loading;
    const section=field("[data-preview-content]");
    section.hidden=loading||Boolean(error)||!detail;
    if(section.hidden)return;
    const agenda=detail.agenda;
    field("[data-preview-heading]").textContent=`Agenda ${agenda.storeCode} - ${agenda.storeName}`;
    section.classList.toggle("is-completed",agenda.dayStatus==="concluido");
    section.classList.toggle("is-open",agenda.dayStatus!=="concluido");
    field("[data-preview-date]").textContent=formatStoreDate(agenda.date);
    const state=field("[data-preview-day-status]");
    const completed=agenda.dayStatus==="concluido";
    state.className=`status-pill agenda-preview-day-status ${completed?"success":"warning"}`;
    state.textContent=completed?"✓ Concluído":"Em andamento";
    field("[data-preview-edit-state]").textContent=effectiveEditable()?"Modo edição":"Somente leitura";
    const toggle=field("[data-preview-edit]");
    if(toggle){
      toggle.className=editMode?"primary-button":"ghost-button";
      toggle.textContent=editMode?"Sair da edição":"Editar agenda";
      toggle.setAttribute("aria-pressed",String(editMode));
    }
    const crossButton=field("[data-preview-cross-import]");
    if(crossButton){
      crossButton.hidden=!isDock01();
      crossButton.disabled=completed;
      crossButton.title=completed?"Agenda concluída: Cross disponível apenas para consulta.":"Importar Cross para um fornecedor da Doca 1";
    }
    const reopen=field("[data-preview-reopen]");
    reopen.hidden=!(canReopen&&editMode&&completed);
    reopen.disabled=reopening;
    reopen.textContent=reopening?"Reabrindo...":"Reabrir para conferente";
    const summary=storeAgendaMetrics(detail.appointments);
    for(const [key,value] of Object.entries(summary)){
      const el=field(`[data-preview-count="${key}"]`);
      if(el.textContent!==String(value))el.textContent=String(value);
    }
    field("[data-preview-add]").hidden=!effectiveEditable();
    const query=normalizeAgendaSearch(search);
    const filtered=sortAgendaAppointments(detail.appointments).filter(x=>
      !query||normalizeAgendaSearch(`${x.supplier} ${x.protocol}`).includes(query));
    field("[data-preview-empty]").hidden=filtered.length>0;
    const opts={
      appointments:filtered,editable:effectiveEditable(),
      request,appointmentApiBase:"/api/admin/appointments",
      highlightPositiveExchanges:true,
      onChanged:effectiveEditable()?appointmentChanged:null,
      onEditManual:effectiveEditable()?openManual:null,
      onDeleteManual:effectiveEditable()?item=>openManual(item,true):null
    };
    if(list)list.update(filtered,opts);
    else list=renderAgendaList(field("[data-preview-list]"),opts);
  }
  const load=async(silent=false)=>{
    const token=++requestToken;
    if(!silent){loading=true;setError(null);renderDetail();}
    try{
      const data=await request(`/api/admin/agendas/${encodeURIComponent(agendaId)}`);
      if(disposed||token!==requestToken)return;
      detail=data;setError(null);
    }catch{
      if(!disposed&&token===requestToken&&!silent)setError("Não foi possível carregar os detalhes desta agenda.");
    }finally{
      if(!disposed&&token===requestToken){loading=false;renderDetail();}
    }
  };
  const reopen=async()=>{
    if(!canReopen||!effectiveEditable()||!detail||reopening||detail.agenda.dayStatus!=="concluido")return;
    reopening=true;setError(null);renderDetail();
    try{
      const updated=await request(`/api/admin/agendas/${encodeURIComponent(detail.agenda.id)}/status`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status:"aberto"})
      });
      if(disposed||!detail)return;
      detail={...detail,agenda:updated};
      onAgendaChanged();
    }catch{
      if(!disposed)setError("Não foi possível reabrir o dia para o conferente.");
    }finally{reopening=false;renderDetail();}
  };
  const onClick=event=>{
    const button=event.target.closest?.("button");
    if(!button||!backdrop.contains(button))return;
    if(button.matches("[data-preview-close]"))return close();
    if(button.matches("[data-preview-edit]")&&canEdit){
      editMode=!editMode;
      if(!editMode){manualClose?.();manualClose=null;}
      renderDetail();
    }else if(button.matches("[data-preview-reopen]"))void reopen();
    else if(button.matches("[data-preview-cross-import]"))openCross();
    else if(button.matches("[data-preview-add]"))openManual(null);
  };
  const onInput=event=>{
    if(!event.target.matches("[data-preview-search]"))return;
    search=event.target.value;renderDetail();
  };
  backdrop.addEventListener("click",onClick);
  backdrop.addEventListener("input",onInput);
  releaseFocus=activateModal(()=>field('[role="dialog"]'),{
    initialFocus:()=>field("[data-preview-heading]"),onEscape:close
  });
  const offRealtime=realtime?.onEvent?.(event=>{
    if(event.type==="agenda.changed"&&event.agendaId===agendaId)void load(true);
  })||(()=>{});
  void load();
  return close;
}