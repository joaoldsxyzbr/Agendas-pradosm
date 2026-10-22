import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { extractPdfText } from "./import/extractPdfText.js";
import { readCsvText } from "./import/readCsvText.js";
import { sendDiagnostic, newCorrelationId } from "./diagnostic-client.js";
import { parseAgendaCsv, parseAgendaPdfText } from "./import/parseAgendaBatch.js";
import { activateModal } from "./dialog-focus.js";

export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
const ERROR_LABELS = {
  FILIAL_NAO_IDENTIFICADA: "Filial não identificada no arquivo.",
  DATA_NAO_IDENTIFICADA: "Data não identificada no arquivo.",
  SEM_AGENDAMENTOS_VALIDOS: "Nenhum agendamento válido foi encontrado.",
  REGISTROS_NAO_INTERPRETADOS: "Há registros que não puderam ser interpretados com segurança.",
  TOTAL_DIVERGENTE: "O total informado no arquivo diverge dos registros encontrados.",
  PROTOCOLO_DUPLICADO: "Há protocolo duplicado na agenda.",
  DATAS_DIVERGENTES: "O arquivo contém mais de uma data de agenda.",
  DATA_DIVERGENTE: "A data dos registros diverge da data informada no filtro do arquivo.",
  FORMATO_CSV_NAO_RECONHECIDO: "O CSV não possui as colunas esperadas da agenda de recebimento."
};
export function importErrorLabel(error) {
  const code=String(error).split(":")[0];
  return ERROR_LABELS[code] ? `${ERROR_LABELS[code]} (${error})` : String(error);
}
export const isCsvAgenda = file => file?.type === "text/csv" ||
  file?.type === "application/csv" || file?.name?.toLowerCase().endsWith(".csv");
export const isPdfAgenda = file => file?.type === "application/pdf" ||
  file?.name?.toLowerCase().endsWith(".pdf");
export const countAgendaLabel = count => count === 1 ? "1 agendamento" : `${count} agendamentos`;
export const countStoreLabel = count => count === 1 ? "1 loja" : `${count} lojas`;
export function importDate(value) {
  if (!value) return "Data não identificada";
  const [year,month,day]=value.split("-");
  return day&&month&&year ? `${day}/${month}/${year}`:value;
}
export function buildImportPayload(file,preview,replace=false) {
  if(!file||!preview)return null;
  const agendas=preview.agendas.flatMap(agenda => {
    if(!agenda.storeCode||!agenda.date)return [];
    return [{
      storeCode:agenda.storeCode,date:agenda.date,originalFileName:file.name,
      appointments:agenda.appointments.map(({status:_status,...appointment})=>appointment),
      ...(replace?{replace:true}:{})
    }];
  });
  if(!agendas.length||agendas.length!==preview.agendas.length)return null;
  return {agendas};
}
export function canConfirmImport(file,preview,submitting=false) {
  return Boolean(file&&preview&&preview.agendas.length>0&&preview.totalAppointments>0&&
    preview.agendas.every(agenda=>agenda.storeCode&&agenda.date)&&
    preview.blockingErrors.length===0&&!submitting);
}

function messageNode(root,message,success) {
  const node=root.querySelector("[data-import-message]");
  node.textContent=message||"";
  node.className=success?"success-message":"feedback-message";
  node.hidden=!message;
}
function previewHtml(preview, file, busy, replacePending) {
  const esc=escapeHtml;
  const rows=preview.agendas.flatMap(agenda=>agenda.appointments.map(item=>({
    storeCode:agenda.storeCode??"—",item
  })));
  const errors=preview.blockingErrors.length
    ? `<section class="validation-panel error-panel" role="alert" aria-label="Erros da importação">
       <h2>Corrija antes de importar</h2><ul>
       ${preview.blockingErrors.map(error=>`<li>${esc(importErrorLabel(error))}</li>`).join("")}
       </ul></section>` : "";
  const warnings=preview.warnings.length
    ? `<section class="validation-panel warning-panel" aria-label="Avisos da importação">
       <h2>Avisos</h2><ul>${preview.warnings.map(warning=>`<li>${esc(warning)}</li>`).join("")}</ul>
       </section>` : "";
  return `<div class="preview-stack">
    <section class="preview-summary">
      <div><span>Lojas</span><strong>${countStoreLabel(preview.agendas.length)}</strong></div>
      <div><span>Data</span><strong>${esc(importDate(preview.date))}</strong></div>
      <div><span>Total</span><strong>${countAgendaLabel(preview.totalAppointments)}</strong></div>
    </section>
    ${errors}${warnings}
    <div class="table-card"><div class="table-scroll"><table>
      <thead><tr>
        <th>Loja</th><th>Horário</th><th>Protocolo</th><th>Fornecedor</th>
        <th>Itens</th><th>Volumes</th><th>Tipo</th>
      </tr></thead>
      <tbody>${rows.length ? rows.map(({storeCode,item})=>`<tr>
        <td>${esc(storeCode)}</td><td>${esc(item.startTime)} - ${esc(item.endTime)}</td>
        <td>${esc(item.protocol)}</td><td>${esc(item.supplier)}</td>
        <td>${esc(item.items??"-")}</td><td>${esc(item.volumes??"-")}</td>
        <td>${esc(item.type)}</td></tr>`).join("")
        : '<tr><td colspan="7" class="empty-cell">Nenhum agendamento interpretado.</td></tr>'}
      </tbody></table></div></div>
    <div class="action-row">
      <button class="primary-button" type="button" data-import-submit
        ${canConfirmImport(file,preview,busy)?"":"disabled"}>
        ${busy?"Importando...":"Confirmar importação"}</button>
    </div>
    ${replacePending ? `<section class="replace-panel" role="alert">
      <div><strong>Há agendas já existentes</strong>
      <p>A substituição atualiza somente os dados importados e preserva status,
        histórico e fornecedores adicionados manualmente.</p></div>
      <button class="danger-button" type="button" data-import-replace
        ${busy?"disabled":""}>Substituir agendas existentes</button>
    </section>` : ""}
  </div>`;
}

// ImportAgendaPage da main: leitura local, revisão, bloqueios e substituição 409.
export function renderImportAgenda(root,{
  modal=false,request=apiFetch,onClose=()=>{},onImported=()=>{},
  parseCsv=parseAgendaCsv,parsePdf=parseAgendaPdfText,extractPdf=extractPdfText
}={}) {
  let disposed=false,preview=null,file=null,loading=false,submitting=false;
  let replacePending=false,message=null,success=false,selectionToken=0;
  let correlacao=newCorrelationId();
  const formatOf=selected=>isCsvAgenda(selected)?"csv":isPdfAgenda(selected)?"pdf":"outro";
  const log=(evento,nivel,extra={})=>void sendDiagnostic(evento,{
    nivel, operacao:"importacao", correlacao, formato:formatOf(file), ...extra
  });
  const dialogTrigger=modal?root.ownerDocument.activeElement:null;
  let releaseFocus=()=>{};
  if(modal)root.innerHTML=`<div class="modal-backdrop" role="presentation" data-import-backdrop>
    <section class="modal-card import-agenda-modal" role="dialog" tabindex="-1" aria-modal="true"
      aria-labelledby="import-agenda-title"><div data-import-body></div></section>
  </div>`;
  const body=modal?root.querySelector("[data-import-body]"):root;
  body.innerHTML=`<div class="admin-page import-agenda-content">
    <header class="${modal?"modal-heading":"page-heading"}">
      <div><span class="eyebrow">Agenda diária</span>
        <${modal?"h2":"h1"} id="import-agenda-title"${modal?' tabindex="-1"':""}>Importar agenda</${modal?"h2":"h1"}>
        <p>Importe o CSV com todas as lojas de uma vez. O PDF continua disponível como formato de reserva.</p>
      </div>
      ${modal?'<button class="ghost-button" type="button" data-import-close>Fechar</button>':""}
    </header>
    <div class="upload-card"><div class="file-field"><span>Arquivo CSV ou PDF</span>
      <div class="file-picker-controls">
        <input id="import-agenda-file" type="file" data-import-file hidden
          accept=".csv,text/csv,.pdf,application/pdf">
        <button class="ghost-button file-picker-button" type="button" data-import-browse
          aria-controls="import-agenda-file">Selecionar arquivo</button>
        <span class="file-picker-name" data-import-file-name aria-live="polite">Nenhum arquivo selecionado</span>
      </div></div>
      <p class="field-help">O arquivo é interpretado no navegador. Nenhuma agenda é gravada até você conferir a prévia e confirmar.</p>
    </div>
    <p class="muted-state" data-import-loading hidden>Lendo arquivo...</p>
    <p data-import-message role="status" aria-live="polite" hidden></p>
    <div data-import-preview></div>
  </div>`;
  const render=()=>{
    if(disposed)return;
    body.querySelector("[data-import-loading]").hidden=!loading;
    const fileName=body.querySelector("[data-import-file-name]");
    if(fileName)fileName.textContent=file?.name||"Nenhum arquivo selecionado";
    messageNode(body,message,success);
    body.querySelector("[data-import-preview]").innerHTML=preview
      ?previewHtml(preview,file,submitting,replacePending):"";
  };
  const close=(force=false)=>{if((submitting&&!force)||disposed)return;disposed=true;selectionToken++;releaseFocus();onClose();};
  const changeFile=async event=>{
    const startedAt=Date.now();
    const selected=event.target.files?.[0]??null;
    const token=++selectionToken;
    file=selected;preview=null;message=null;success=false;replacePending=false;
    if(selected){correlacao=newCorrelationId();log("IMPORT_SELECTED","info");}
    if(!selected){render();return;}
    if(selected.size>MAX_SOURCE_FILE_BYTES){message="O arquivo excede o limite de 10 MB.";log("IMPORT_VALIDATION_FAILED","warning");render();return;}
    if(selected.size===0){message="O arquivo está vazio. Selecione um CSV ou PDF com dados.";log("IMPORT_VALIDATION_FAILED","warning");render();return;}
    if(!isCsvAgenda(selected)&&!isPdfAgenda(selected)){message="Selecione um arquivo CSV ou PDF.";log("IMPORT_VALIDATION_FAILED","warning");render();return;}
    loading=true;render();
    try{
      const parsed=isCsvAgenda(selected) ?parseCsv(await readCsvText(selected))
        :parsePdf(await extractPdf(selected));
      if(disposed||token!==selectionToken)return;
      preview=parsed;
      if(parsed.blockingErrors?.length){
        message="O arquivo foi lido, mas precisa de correções. Confira os erros da prévia.";
        log("IMPORT_VALIDATION_FAILED","warning");
      } else log("IMPORT_PREVIEW_READY","info",{
        quantidade:parsed.totalAppointments,duracaoMs:Math.min(120000,Date.now()-startedAt)
      });
    }catch{
      if(disposed||token!==selectionToken)return;
      log("IMPORT_READ_FAILED","error",{duracaoMs:Math.min(120000,Date.now()-startedAt)});
      message=isCsvAgenda(selected)?"Não foi possível ler o CSV selecionado."
        :"Não foi possível ler o PDF selecionado.";
    }finally{
      if(!disposed&&token===selectionToken){loading=false;render();}
    }
  };
  const submit=async replace=>{
    if(submitting||!canConfirmImport(file,preview))return;
    const payload=buildImportPayload(file,preview,replace);
    if(!payload)return;
    const startedAt=Date.now();
    submitting=true;message=null;success=false;render();
    try{
      const response=await request("/api/admin/agendas/import/bulk",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      if(disposed)return;
      replacePending=false;
      log("IMPORT_SUCCEEDED","info",{
        quantidade:response.totalAppointments,duracaoMs:Math.min(120000,Date.now()-startedAt)
      });
      success=true;
      message=`Importação concluída: ${countStoreLabel(response.totalAgendas)} e ${countAgendaLabel(response.totalAppointments)}.`;
      onImported();
      if(modal)close(true);
    }catch(err){
      if(disposed)return;
      if(err instanceof ApiError && err.correlationId)correlacao=err.correlationId;
      log("IMPORT_REQUEST_FAILED",err instanceof ApiError&&err.status===409?"warning":"error",{
        httpStatus:err instanceof ApiError?err.status:undefined,
        duracaoMs:Math.min(120000,Date.now()-startedAt)
      });
      if(err instanceof ApiError&&err.status===409){
        replacePending=true;
        message="Já existe agenda para uma ou mais lojas e datas deste arquivo.";
      }else message=err instanceof ApiError?err.message:"Não foi possível importar as agendas.";
    }finally{
      submitting=false;render();
      if(disposed)return;
    }
  };
  const onChange=event=>{
    if(event.target.matches("[data-import-file]")){
      void changeFile(event);
      // Permite selecionar novamente o mesmo arquivo após uma correção.
      event.target.value="";
    }
  };
  const onClick=event=>{
    const button=event.target.closest?.("button");
    if(!button||!root.contains(button))return;
    if(button.matches("[data-import-browse]"))return body.querySelector("[data-import-file]").click();
    if(button.matches("[data-import-close]"))close();
    else if(button.matches("[data-import-submit]"))void submit(false);
    else if(button.matches("[data-import-replace]"))void submit(true);
  };
  const onBackdrop=event=>{
    if(!modal||event.target!==event.currentTarget||!event.target.matches("[data-import-backdrop]"))return;
    close();
  };
  root.addEventListener("change",onChange);
  root.addEventListener("click",onClick);
  root.querySelector("[data-import-backdrop]")?.addEventListener("mousedown",onBackdrop);
  render();
  if(modal)releaseFocus=activateModal(()=>root.querySelector('[data-import-backdrop] [role="dialog"]'),{
    initialFocus:()=>root.querySelector("#import-agenda-title"),onEscape:close,trigger:dialogTrigger
  });
  return ()=>{
    disposed=true;selectionToken++;
    releaseFocus();
    root.removeEventListener("change",onChange);
    root.removeEventListener("click",onClick);
    root.querySelector("[data-import-backdrop]")?.removeEventListener("mousedown",onBackdrop);
  };
}