import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { createBusinessDateMonitor } from "./business-date.js";
import { renderAgendaDatePicker } from "./agenda-date-picker.js";
import { renderAgendaList } from "./agenda-list.js";
import { openAgendaDetails } from "./agenda-details.js";
import { openAppointmentTagsDialog } from "./tags.js";
import { openSupplierModal, openCompleteDayModal } from "./store-modals.js";
import { downloadAgendaPdf } from "./agenda/exportAgendaPdf.js";
import {
  storeAgendaMetrics, filterStoreAppointments, storeAgendaEndpoint,
  formatStoreDate, addStoreDays
} from "./store-agenda-model.js";

// TodayPage da main, com DOM estável (sem o piscar de uma navegação global).
export function renderToday(root,{
  request=apiFetch, realtime=null, commandSlot=null,
  doc=document, win=window, exportPdf=downloadAgendaPdf
}={}) {
  let disposed=false, loading=true, selectedDate, agenda=null, error=null;
  let searchQuery="", generation=0, refreshTimer=null, list=null;
  let closeModal=null, closeDetails=null, tagCatalog=[], tagsUnavailable=false;
  const monitor=createBusinessDateMonitor({
    doc,timers:win,
    onChange:next=>{
      const previous=today;
      today=next;
      datePicker.setToday(next);
      if (selectedDate===previous) changeDate(next);
      else updateCommandBar();
    }
  });
  let today=monitor.today;
  selectedDate=today;

  root.innerHTML=`<section class="store-page">
    <h1 class="sr-only">Agenda de recebimento</h1>
    <div data-command-fallback></div>
    <p class="muted-state" data-store-loading>Carregando agenda...</p>
    <p class="form-error" data-store-error hidden></p>
    <div class="empty-panel store-empty" data-no-agenda hidden></div>
    <div class="prado-store-agenda-view" data-agenda-view hidden>
      <div class="agenda-completed-banner" data-completed hidden></div>
      <section class="agenda-metrics" aria-label="Resumo da agenda">
        <span class="metric-total"><span class="metric-icon" aria-hidden="true">▣</span><span class="metric-label">Total</span><strong data-metric="total">0</strong><small data-percent="total">100% do dia</small></span>
        <span class="metric-waiting"><span class="metric-icon" aria-hidden="true">◷</span><span class="metric-label">Aguardando</span><strong data-metric="aguardando">0</strong><small data-percent="aguardando">0%</small></span>
        <span class="metric-received"><span class="metric-icon" aria-hidden="true">✓</span><span class="metric-label">Recebidos</span><strong data-metric="recebido">0</strong><small data-percent="recebido">0%</small></span>
        <span class="metric-missing"><span class="metric-icon" aria-hidden="true">×</span><span class="metric-label">Não recebidos</span><strong data-metric="naoChegou">0</strong><small data-percent="naoChegou">0%</small></span>
        <span class="metric-exchanges"><span class="metric-icon" aria-hidden="true">⇄</span><span class="metric-label">Trocas</span><strong data-metric="trocas">0</strong><small data-percent="trocas">0%</small></span>
      </section>
      <section class="prado-store-agenda-panel" aria-label="Agenda de recebimento">
        <div class="prado-store-agenda-panel-heading">
          <div>
            <h2>Agenda do dia</h2>
            <p>Fornecedores agendados para recebimento.</p>
          </div>
          <div class="agenda-toolbar">
            <label class="agenda-search"><span class="sr-only">Pesquisar fornecedor ou protocolo</span>
              <input type="search" data-agenda-search aria-label="Pesquisar fornecedor ou protocolo"
                placeholder="Pesquisar fornecedor ou protocolo" autocomplete="off"></label>
            <button class="ghost-button agenda-manual-button" type="button"
              data-add-manual hidden>+ Fornecedor sem agenda</button>
          </div>
        </div>
        <p class="form-error" data-tags-unavailable hidden>As tags não estão disponíveis. Verifique a atualização do D1 de testes.</p>
        <div data-agenda-list></div>
        <div class="empty-panel agenda-search-empty" data-search-empty hidden>
          Nenhum fornecedor ou protocolo encontrado.
        </div>
      </section>
      <div data-appointment-details></div>
    </div>
  </section>`;

  const commandHost=doc.createElement("section");
  commandHost.className="agenda-command-bar";
  commandHost.setAttribute("aria-label","Selecionar dia da agenda");
  commandHost.innerHTML=`<div class="agenda-date-controls">
    <button class="ghost-button agenda-date-step" type="button" aria-label="Dia anterior" data-store-previous>‹</button>
    <div data-store-picker></div>
    <button class="ghost-button agenda-date-step" type="button" aria-label="Dia seguinte" data-store-next>›</button>
    </div><div class="agenda-command-actions">
    <span class="agenda-day-chip empty" data-day-state>Sem agenda</span>
    <button class="ghost-button agenda-today-button" type="button" data-store-today hidden>Hoje</button>
    <button class="primary-button agenda-complete-button" type="button" data-store-complete hidden>Concluir dia</button>
    <button class="ghost-button agenda-export-button" type="button" data-store-pdf hidden>Exportar PDF</button>
  </div>`;
  const fallback=root.querySelector("[data-command-fallback]");
  (commandSlot || fallback).appendChild(commandHost);
  const datePicker=renderAgendaDatePicker(commandHost.querySelector("[data-store-picker]"),{
    value:selectedDate,today,onChange:value=>changeDate(value)
  });

  const editable=()=>agenda?.agenda?.dayStatus==="aberto";
  const isToday=()=>selectedDate===today;
  const updateCommandBar=()=>{
    const chip=commandHost.querySelector("[data-day-state]");
    const hasAgenda=Boolean(agenda?.agenda);
    chip.className=`agenda-day-chip ${!hasAgenda?"empty":editable()?"open":"closed"}`;
    chip.textContent=!hasAgenda?"Sem agenda":editable()?"Em aberto":"Concluído";
    commandHost.querySelector("[data-store-today]").hidden=isToday();
    commandHost.querySelector("[data-store-complete]").hidden=!hasAgenda||!editable();
    commandHost.querySelector("[data-store-pdf]").hidden=!hasAgenda;
  };
  const updateError=()=>{
    const node=root.querySelector("[data-store-error]");
    node.textContent=error||"";
    node.hidden=!error;
  };
  const destroyList=()=>{list?.destroy();list=null;};
  const resetDateState=()=>{
    searchQuery="";
    const input=root.querySelector("[data-agenda-search]");
    if(input)input.value="";
    closeModal?.();closeModal=null;
    closeDetails?.();closeDetails=null;
    destroyList();
  };
  const changeDate=value=>{
    if(disposed||value===selectedDate)return;
    selectedDate=value;
    datePicker.setValue(value);
    resetDateState();
    void load();
  };
  const onAppointmentChanged=updated=>{
    if(!agenda||!editable())return;
    agenda={...agenda,appointments:agenda.appointments.map(item=>item.id===updated.id?{...updated,tags:item.tags||[]}:item)};
    renderContent();
  };
  function renderContent() {
    if(disposed)return;
    root.querySelector("[data-store-loading]").hidden=!loading;
    updateError();
    updateCommandBar();
    const absent=!loading&&!error&&agenda?.agenda===null;
    const empty=root.querySelector("[data-no-agenda]");
    empty.hidden=!absent;
    if(absent)empty.innerHTML=`<strong>${isToday()?"Nenhuma agenda para hoje.":`Nenhuma agenda em ${formatStoreDate(selectedDate)}.`}</strong>
      <span>${isToday()?"Quando a administração importar a agenda do dia, ela aparecerá aqui.":"Escolha outra data para consultar os recebimentos."}</span>`;
    const visible=!loading&&!error&&Boolean(agenda?.agenda);
    root.querySelector("[data-agenda-view]").hidden=!visible;
    if(!visible){return;}
    const summary=storeAgendaMetrics(agenda.appointments);
    const total=summary.total||0;
    for(const [metric,value] of Object.entries(summary)){
      const node=root.querySelector(`[data-metric="${metric}"]`)?.parentElement;
      if(node)node.style.setProperty("--metric-fraction",String(total?Math.min(1,value/total):0));
      const percent=root.querySelector(`[data-percent="${metric}"]`);
      if(percent)percent.textContent=metric==="total"?"100% do dia":`${total?(value/total*100).toLocaleString("pt-BR",{maximumFractionDigits:1}):0}%`;
    }
    for(const [key,value] of Object.entries(summary)){
      const el=root.querySelector(`[data-metric="${key}"]`);
      if(el.textContent!==String(value))el.textContent=String(value);
    }
    const completed=root.querySelector("[data-completed]");
    const closed=!editable();
    completed.hidden=!closed||!agenda.agenda.completedAt;
    if(!completed.hidden){
      const who=agenda.agenda.completedBy?.name??"Usuário";
      const date=new Intl.DateTimeFormat("pt-BR",{
        timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"
      }).format(new Date(agenda.agenda.completedAt));
      const text=`<strong>Dia concluído</strong><span>${escapeHtml(who)} em ${escapeHtml(date)}</span>`;
      if(completed.innerHTML!==text)completed.innerHTML=text;
    }
    const manual=root.querySelector("[data-add-manual]");
    manual.hidden=!editable();
    root.querySelector("[data-tags-unavailable]").hidden=!tagsUnavailable;
    const filtered=filterStoreAppointments(agenda.appointments,searchQuery);
    root.querySelector("[data-search-empty]").hidden=filtered.length>0;
    const listRoot=root.querySelector("[data-agenda-list]");
    const options={
      editable:editable(),request,appointments:filtered,
      onChanged:editable()?onAppointmentChanged:null,
      onEditTags:editable() && !tagsUnavailable ? openTags : null,
      onEditManual:editable()?openEditManual:null,
      onOpen:closed?openDetails:null
    };
    if(list)list.update(filtered,options);
    else list=renderAgendaList(listRoot,options);
  }
  async function load({silent=false}={}) {
    const token=++generation,requested=selectedDate;
    if(!silent){
      loading=true;error=null;agenda=null;
      renderContent();
    }
    try{
      const data=await request(storeAgendaEndpoint(requested,today));
      let tagData={tags:[],assignments:{}};
      let tagFailure=false;
      try {tagData=await request(`/api/store/tags/agenda/${encodeURIComponent(requested)}`);}
      catch {tagFailure=true;}
      if(disposed||token!==generation)return;
      tagCatalog=tagData.tags || [];
      tagsUnavailable=tagFailure;
      agenda={...data,appointments:(data.appointments||[]).map(item=>({...item,tags:tagData.assignments?.[item.id]||[]}))};error=null;
    }catch(err){
      if(disposed||token!==generation)return;
      if(err instanceof ApiError&&err.status===404)agenda={agenda:null,appointments:[]},error=null;
      else if(!silent)error="Não foi possível carregar a agenda selecionada.";
    }finally{
      if(!disposed&&token===generation){
        loading=false;renderContent();
      }
    }
  }
  const openModal=render=>{
    closeModal?.();
    closeModal=render();
  };
  const openTags=(item,trigger)=>{
    if(!editable()||tagsUnavailable)return;
    openModal(()=>openAppointmentTagsDialog(root,{
      appointment:item,tags:tagCatalog,request,trigger,
      onSaved:tags=>{
        agenda={...agenda,appointments:agenda.appointments.map(entry=>entry.id===item.id?{...entry,tags}:entry)};
        renderContent();
      }
    }));
  };
  const openEditManual=item=>{
    if(!editable())return;
    openModal(()=>openSupplierModal(root,{
      editing:item,selectedDate,request,
      onSaved:saved=>{
        agenda={...agenda,appointments:agenda.appointments.map(x=>x.id===saved.id?{...saved,tags:x.tags||[]}:x)};
        searchQuery="";root.querySelector("[data-agenda-search]").value="";
        renderContent();
      },
      onDeleted:id=>{
        agenda={...agenda,appointments:agenda.appointments.filter(x=>x.id!==id)};
        renderContent();
      }
    }));
  };
  const openDetails=id=>{
    closeDetails?.();
    closeDetails=openAgendaDetails(root.querySelector("[data-appointment-details]"),id,{request});
  };
  const onCommandClick=event=>{
    const button=event.target.closest?.("button");
    if(!button||!commandHost.contains(button))return;
    if(button.matches("[data-store-previous]"))changeDate(addStoreDays(selectedDate,-1));
    else if(button.matches("[data-store-next]"))changeDate(addStoreDays(selectedDate,1));
    else if(button.matches("[data-store-today]"))changeDate(today);
    else if(button.matches("[data-store-pdf]")&&agenda?.agenda){
      exportPdf(agenda.agenda,[...agenda.appointments].sort(
        (a,b)=>a.startTime.localeCompare(b.startTime)||a.protocol.localeCompare(b.protocol)));
    }else if(button.matches("[data-store-complete]")&&editable()){
      openModal(()=>openCompleteDayModal(root,{
        selectedDate,request,
        onComplete:updated=>{
          agenda={...agenda,agenda:updated};renderContent();
        }
      }));
    }
  };
  const onPageClick=event=>{
    const button=event.target.closest?.("button");
    if(button?.matches("[data-add-manual]")&&editable()){
      openModal(()=>openSupplierModal(root,{
        selectedDate,request,
        onSaved:updated=>{
          agenda={...agenda,appointments:[...agenda.appointments,updated]};
          searchQuery="";root.querySelector("[data-agenda-search]").value="";
          renderContent();
        }
      }));
    }
  };
  const onSearch=event=>{
    if(!event.target.matches("[data-agenda-search]"))return;
    searchQuery=event.target.value;renderContent();
  };
  const onRealtime=event=>{
    if(event.type!=="agenda.changed"||event.date!==selectedDate)return;
    if(refreshTimer!==null)return;
    refreshTimer=win.setTimeout(()=>{
      refreshTimer=null;
      if(!disposed)void load({silent:true});
    },75);
  };
  const offRealtime=realtime?.onEvent?.(onRealtime)||(()=>{});
  commandHost.addEventListener("click",onCommandClick);
  root.addEventListener("click",onPageClick);
  root.addEventListener("input",onSearch);
  monitor.start();
  void load();
  return ()=>{
    disposed=true;
    generation++;
    offRealtime();
    if(refreshTimer!==null)win.clearTimeout(refreshTimer);
    monitor.stop();datePicker.destroy();
    destroyList();
    closeModal?.();closeDetails?.();
    commandHost.removeEventListener("click",onCommandClick);
    root.removeEventListener("click",onPageClick);
    root.removeEventListener("input",onSearch);
    commandHost.remove();
  };
}