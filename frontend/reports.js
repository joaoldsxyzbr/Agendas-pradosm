import { apiFetch } from "./api.js";
import { reportInfo, setupReportInfo } from "./report-info.js";
import { mountReportChart } from "./report-chart.js";
import { escapeHtml as esc } from "./shell.js";
import { businessDate } from "../shared/time.js";
import { sumReportRows, reportRate, groupDailyReport, groupStoreReport } from "./report-model.js";
const num=n=>Number(n||0).toLocaleString("pt-BR");
const pct=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const date=d=>{const a=String(d).split("-");return a[2]+"/"+a[1]+"/"+a[0];};
const shift=(day,n)=>{const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function validReportRange(start,end) {
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"") && Number.isFinite(Date.parse(d+"T00:00:00Z"))
    && new Date(Date.parse(d+"T00:00:00Z")).toISOString().slice(0,10)===d;
  return valid(start)&&valid(end)&&Date.parse(end)>=Date.parse(start)&&Date.parse(end)-Date.parse(start)<93*86400000;
}
function table(columns,rows) {
  return '<div class="report-table-scroll"><table><thead><tr>'+
    columns.map(x=>'<th>'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+
    (rows.length?rows.join(""):'<tr><td colspan="'+columns.length+'" class="report-empty">Nenhum registro no período.</td></tr>')+
    '</tbody></table></div>';
}
const cell=(text,numeric=false)=>'<td'+(numeric?' class="report-number"':'')+'>'+esc(text)+'</td>';
const panel=(title,description,inner)=>'<section class="report-panel"><header><div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div>'+reportInfo(title)+'</header>'+inner+'</section>';
const metric=(label,value,description)=>'<div class="report-metric"><div class="report-metric-heading"><span>'+esc(label)+'</span>'+reportInfo(label)+'</div><strong>'+esc(value)+'</strong><small>'+esc(description)+'</small></div>';
function chart(days) {
  if(!days.length)return '<p class="report-empty">Sem movimentação no período.</p>';
  const maximum=Math.max(1,...days.map(x=>x.total));
  const bars=days.map((d,i)=>{
    const total=d.total||0,height=total?Math.max(2,total/maximum*100):0;
    const segments=["recebido","naoChegou","aguardando","semConferencia","recusado"].map(k=>
      '<span class="report-segment-'+k+'" style="height:'+(total?((d[k]||0)/total*100).toFixed(2):0)+'%"></span>').join("");
    const description=date(d.date)+": "+num(d.total)+" agendamentos; "+num(d.recebido)+" recebidos; "+num(d.naoChegou)+" não recebidos; "+num(d.aguardando)+" aguardando; "+num(d.semConferencia)+" sem conferência";
    return '<div class="report-day" role="img" aria-label="'+esc(description)+'" title="'+esc(description)+'">'+
      '<div class="report-bar-area"><div class="report-bar" style="height:'+height.toFixed(2)+'%">'+segments+'</div></div>'+
      '<small>'+(i%Math.max(1,Math.ceil(days.length/12))===0?esc(d.date.slice(8)+"/"+d.date.slice(5,7)):"&nbsp;")+'</small></div>';
  }).join("");
  return '<div class="report-legend">'+
    [["recebido","Recebidos"],["naoChegou","Não recebidos"],["aguardando","Aguardando"],["semConferencia","Sem conferência"],["recusado","Recusados"]]
    .map(([k,t])=>'<span><i class="report-segment-'+k+'"></i>'+t+'</span>').join("")+'</div>'+
    '<div class="report-chart-scroll" data-report-native-chart><div class="report-chart">'+bars+'</div></div>'+
    '<div class="report-chart-canvas-scroll" data-report-chart-wrap hidden>'+
      '<div class="report-chart-canvas"><canvas data-report-chart-canvas role="img" aria-label="Evolução diária de recebimentos por status. O gráfico apresenta os totais diários por status."></canvas></div>'+
    '</div>';
}
const meter=(title,total,received,bad=false)=>'<div class="report-progress-item"><div><span>'+esc(title)+'</span>'+
  '<strong>'+esc(bad?num(received):pct(reportRate({total,recebido:received})))+'</strong></div>'+
  '<div class="report-progress'+(bad?' is-missed':'')+'"><span style="width:'+
  (bad?(total?received/total*100:0):reportRate({total,recebido:received})).toFixed(2)+'%"></span></div>'+
  (bad?"":'<small>'+num(received)+' de '+num(total)+' recebidos</small>')+'</div>';
export function renderReports(root,{request=apiFetch}={}) {
  let closed=false,sequence=0,storePromise=null,stores=[],error="";
  let disposeChart=()=>{};
  const disposeInfo=setupReportInfo(root);
  let settings={end:businessDate(),start:"",store:"",compare:true,offset:0};
  settings.start=shift(settings.end,-29);
  const params=(start,end,offset=null)=>{
    const q=new URLSearchParams({start,end});
    if(settings.store)q.set("storeCode",settings.store);
    if(offset!==null){q.set("limit","50");q.set("offset",String(offset));}
    return q.toString();
  };
  const paintShell=()=>{
    const options=stores.slice().sort((a,b)=>a.codigo.localeCompare(b.codigo,"pt-BR",{numeric:true}))
      .map(s=>'<option value="'+esc(s.codigo)+'"'+(s.codigo===settings.store?' selected':'')+'>'+esc(s.codigo+" · "+s.nome)+'</option>').join("");
    root.innerHTML='<section class="admin-page manager-report"><header class="page-heading"><div>'+
      '<span class="eyebrow">Indicadores de gestão</span><h1>Relatório Gerencial</h1>'+
      '<p>Acompanhe resultados, tendências e ocorrências por loja.</p></div></header>'+
      '<form class="report-filters" data-report-filters>'+
      '<label>De<input type="date" name="start" required value="'+esc(settings.start)+'"></label>'+
      '<label>Até<input type="date" name="end" required value="'+esc(settings.end)+'"></label>'+
      '<label>Loja<select name="store"><option value="">Todas as lojas</option>'+options+'</select></label>'+
      '<label class="report-compare"><input type="checkbox" name="compare"'+(settings.compare?' checked':'')+'>Comparar período anterior</label>'+
      '<button class="primary-button" type="submit">Aplicar filtros</button></form>'+
      '<p class="form-error" role="alert" data-report-error'+(error?'':' hidden')+'>'+esc(error)+'</p>'+
      '<p class="muted-state" data-report-loading>Carregando relatório...</p>'+
      '<div data-report-content></div></section>';
  };
  function paintContent(report,previous,occurrences,requestId){
    const sum=sumReportRows(report.rows),prior=sumReportRows(previous?.rows||[]),daily=groupDailyReport(report.rows),units=groupStoreReport(report.rows);
    const rate=x=>pct(reportRate(x));
    const days=Math.round((Date.parse(settings.end)-Date.parse(settings.start))/86400000)+1;
    const difference=reportRate(sum)-reportRate(prior);
    const compare=previous?'<p class="report-insight"><strong>Período anterior ('+num(days)+' dias):</strong> '+num(prior.total)+
      ' agendamentos · variação da taxa de recebimento: <strong>'+esc((difference>=0?"+":"")+difference.toLocaleString("pt-BR",{maximumFractionDigits:1})+' p.p.')+'</strong></p>':"";
    const open=sum.abertas?'<p class="report-open-note">'+num(sum.abertas)+' agenda(s) em aberto; os indicadores podem mudar até o fechamento.</p>':"";
    const storeBars=units.map(u=>meter(u.code+" · "+u.name,u.total,u.recebido)).join("")||'<p class="report-empty">Nenhuma loja.</p>';
    const highest=Math.max(1,...report.suppliers.map(x=>Number(x.naoChegou)||0));
    const supplierBars=report.suppliers.map((u,i)=>meter((i+1)+". "+u.supplier,highest,u.naoChegou,true)).join("")||'<p class="report-empty">Sem ocorrências.</p>';
    const byStore=units.map(u=>'<tr>'+cell(u.code+" · "+u.name)+[u.total,u.recebido,u.naoChegou,u.aguardando,u.semConferencia,u.recusado,u.semAgenda].map(x=>cell(num(x),true)).join("")+cell(rate(u),true)+'</tr>');
    const rows=occurrences.rows.map(r=>'<tr>'+cell(date(r.date))+cell(r.storeCode+" · "+r.storeName)+cell(r.supplier)+cell(r.protocol)+cell(r.observation||"Motivo não registrado")+'</tr>');
    const pager='<div class="report-pagination"><span>'+num(occurrences.total)+' ocorrência(s) · '+
      num(occurrences.total?settings.offset+1:0)+'–'+num(Math.min(settings.offset+50,occurrences.total))+'</span><div>'+
      '<button type="button" class="ghost-button" data-report-prev'+(settings.offset===0?' disabled':'')+'>Anterior</button> '+
      '<button type="button" class="ghost-button" data-report-next'+(settings.offset+50>=occurrences.total?' disabled':'')+'>Próxima</button></div></div>';
    root.querySelector("[data-report-content]").innerHTML=
      '<div class="report-kpis">'+
      metric("Agendamentos",num(sum.total),num(sum.agendas)+" agendas")+
      metric("Recebidos",num(sum.recebido),rate(sum)+" do total")+
      metric("Não recebidos",num(sum.naoChegou),"Não chegaram")+
      metric("Taxa de recebimento",rate(sum),"Recebidos / total")+
      metric("Aguardando",num(sum.aguardando),"Agendas abertas")+
      metric("Sem conferência",num(sum.semConferencia),"Agendas concluídas")+
      metric("Recusados",num(sum.recusado),"Entregas recusadas")+'</div>'+compare+open+
      panel("Evolução diária","Agendamentos por status em cada dia",chart(daily))+
      '<div class="report-analytics-grid">'+
      panel("Comparativo por loja","Taxa de recebimento por unidade",'<div class="report-progress-list">'+storeBars+'</div>')+
      panel("Fornecedores com ocorrências","Ranking de não recebidos",'<div class="report-progress-list">'+supplierBars+'</div>')+'</div>'+
      panel("Por loja","Indicadores consolidados",table(["Loja","Total","Recebidos","Não recebidos","Aguardando","Sem conferência","Recusados","Sem agenda","Taxa"],byStore))+
      panel("Ocorrências e observações","Motivos dos não recebimentos",table(["Data","Loja","Fornecedor","Protocolo","Motivo"],rows)+pager);
    disposeChart=mountReportChart(root,daily,()=>!closed && sequence===requestId);
  }
  async function load(){
    const id=++sequence;error="";disposeChart();disposeChart=()=>{};paintShell();
    try{
      if(!storePromise)storePromise=request("/api/admin/stores").catch(e=>{storePromise=null;throw e;});
      stores=await storePromise;
      if(closed||id!==sequence)return;
      paintShell();
      const days=Math.round((Date.parse(settings.end)-Date.parse(settings.start))/86400000)+1;
      const before=shift(settings.start,-1),earlier=shift(before,-days+1);
      const [report,previous,occurrences]=await Promise.all([
        request("/api/admin/reports?"+params(settings.start,settings.end)),
        settings.compare?request("/api/admin/reports?"+params(earlier,before)):Promise.resolve(null),
        request("/api/admin/reports/occurrences?"+params(settings.start,settings.end,settings.offset))
      ]);
      if(closed||id!==sequence)return;
      root.querySelector("[data-report-loading]").hidden=true;
      paintContent(report,previous,occurrences,id);
    }catch(e){
      if(closed||id!==sequence)return;
      root.querySelector("[data-report-loading]").hidden=true;
      const node=root.querySelector("[data-report-error]");
      node.textContent=e.message||"Não foi possível consultar o relatório.";node.hidden=false;
    }
  }
  const submit=e=>{
    if(!e.target.matches("[data-report-filters]"))return;
    e.preventDefault();
    const form=new FormData(e.target);
    const start=String(form.get("start")||""),end=String(form.get("end")||"");
    if(!validReportRange(start,end)){
      const node=root.querySelector("[data-report-error]");
      node.textContent="Selecione um período válido de até 93 dias.";node.hidden=false;return;
    }
    settings={start,end,store:String(form.get("store")||""),compare:form.has("compare"),offset:0};
    void load();
  };
  const click=e=>{
    const b=e.target.closest?.("[data-report-prev],[data-report-next]");
    if(!b||b.disabled||!root.contains(b))return;
    settings.offset=Math.max(0,settings.offset+(b.matches("[data-report-next]")?50:-50));
    void load();
  };
  root.addEventListener("submit",submit);
  root.addEventListener("click",click);
  void load();
  return ()=>{closed=true;sequence++;disposeChart();disposeInfo();root.removeEventListener("submit",submit);root.removeEventListener("click",click);};
}