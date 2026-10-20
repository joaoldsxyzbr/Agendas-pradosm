import { apiFetch } from "./api.js";
import { reportInfo, setupReportInfo } from "./report-info.js";
import { mountReportChart } from "./report-chart.js";
import { escapeHtml as esc } from "./shell.js";
import { businessDate } from "../shared/time.js";
import { sumReportRows, reportRate, groupDailyReport, groupStoreReport, groupWeekdayReport, WEEKDAY_LABELS } from "./report-model.js";
const num=n=>Number(n||0).toLocaleString("pt-BR");
const pct=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const date=d=>{const a=String(d).split("-");return a[2]+"/"+a[1]+"/"+a[0];};
const shift=(day,n)=>{const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const FILTERS_STORAGE_KEY="agenda-prado-report-filters";
const PRESETS=[["7","Últimos 7 dias"],["30","Últimos 30 dias"],["90","Últimos 90 dias"],["month","Mês atual"]];
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
const panel=(title,description,inner,actions="",cls="")=>'<section class="report-panel'+(cls?" "+cls:"")+'"><header><div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div>'+
  (actions?'<div class="report-panel-actions">'+reportInfo(title)+actions+'</div>':reportInfo(title))+'</header>'+inner+'</section>';
const metric=(label,value,description,delta=null)=>'<div class="report-metric"><div class="report-metric-heading"><span>'+esc(label)+'</span>'+reportInfo(label)+'</div><strong>'+esc(value)+'</strong>'+
  (delta?'<small class="report-metric-delta '+delta.cls+'">'+esc(delta.text)+'</small>':"")+'<small>'+esc(description)+'</small></div>';
const delta=(current,previous,kind="neutral",unit="")=>{
  if(previous==null)return null;
  const value=Number(current||0)-Number(previous||0);
  const text=(value>0?"+":"")+value.toLocaleString("pt-BR",{maximumFractionDigits:1})+unit;
  let cls="is-neutral";
  if(kind==="good")cls=value>0?"is-up":value<0?"is-down":"is-flat";
  if(kind==="invert")cls=value>0?"is-down":value<0?"is-up":"is-flat";
  return {text:text+" vs. período anterior",cls};
};
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
  const rateBars=days.map((d,i)=>{
    const total=d.total||0,rate=total?d.recebido/total*100:0;
    const description=date(d.date)+": "+pct(rate)+" de recebimento ("+num(d.recebido)+" de "+num(total)+")";
    return '<div class="report-day" role="img" aria-label="'+esc(description)+'" title="'+esc(description)+'">'+
      '<div class="report-bar-area"><div class="report-bar" style="height:'+rate.toFixed(2)+'%"><span class="report-segment-recebido" style="height:100%"></span></div></div>'+
      '<small>'+(i%Math.max(1,Math.ceil(days.length/12))===0?esc(d.date.slice(8)+"/"+d.date.slice(5,7)):"&nbsp;")+'</small></div>';
  }).join("");
  return '<div class="report-chart-scroll" data-report-native-chart>'+
    '<div class="report-legend">'+
    [["recebido","Recebidos"],["naoChegou","Não recebidos"],["aguardando","Aguardando"],["semConferencia","Sem conferência"],["recusado","Recusados"]]
    .map(([k,t])=>'<span><i class="report-segment-'+k+'"></i>'+t+'</span>').join("")+'</div>'+
    '<div class="report-chart">'+bars+'</div></div>'+
    '<div class="report-chart-scroll" data-report-rate-native hidden><div class="report-chart">'+rateBars+'</div></div>'+
    '<div class="report-chart-canvas-scroll" data-report-chart-wrap hidden>'+
      '<div class="report-chart-canvas"><canvas data-report-chart-canvas role="img" aria-label="Evolução diária de recebimentos. O gráfico apresenta os totais diários por status ou a taxa de recebimento."></canvas></div>'+
    '</div>';
}
const meter=(title,total,received,bad=false,footnote="")=>'<div class="report-progress-item"><div><span>'+esc(title)+'</span>'+
  '<strong>'+esc(bad?num(received):pct(reportRate({total,recebido:received})))+'</strong></div>'+
  '<div class="report-progress'+(bad?' is-missed':'')+'"><span style="width:'+
  (bad?(total?received/total*100:0):reportRate({total,recebido:received})).toFixed(2)+'%"></span></div>'+
  (bad?"":'<small>'+num(received)+' de '+num(total)+' recebidos</small>')+
  (footnote?'<small class="report-meter-note">'+esc(footnote)+'</small>':"")+'</div>';
export function renderReports(root,{request=apiFetch}={}) {
  let closed=false,sequence=0,storePromise=null,stores=[],error="";
  let disposeChart=()=>{};
  let cached=null;
  const disposeInfo=setupReportInfo(root);
  let settings={end:businessDate(),start:"",store:"",compare:true,offset:0,occurrenceQuery:"",chartMode:"volume"};
  settings.start=shift(settings.end,-29);
  const restoreFilters=()=>{
    if(typeof window==="undefined")return null;
    try{
      const raw=window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if(!raw)return null;
      const saved=JSON.parse(raw);
      if(!saved||!validReportRange(String(saved.start),String(saved.end)))return null;
      return {start:String(saved.start),end:String(saved.end),store:String(saved.store||""),compare:!!saved.compare};
    }catch{return null;}
  };
  const savedFilters=restoreFilters();
  if(savedFilters)Object.assign(settings,savedFilters);
  const persistFilters=()=>{
    if(typeof window==="undefined")return;
    try{window.localStorage.setItem(FILTERS_STORAGE_KEY,JSON.stringify({start:settings.start,end:settings.end,store:settings.store,compare:settings.compare}));}catch{}
  };
  const presetRange=key=>{
    // Atalhos baseados no dia atual, mesmo se houver filtros salvos.
    const end=businessDate();
    if(key==="month")return [end.slice(0,8)+"01",end];
    const n=Number(key)||30;
    return [shift(end,-(n-1)),end];
  };
  const params=(start,end,offset=null)=>{
    const q=new URLSearchParams({start,end});
    if(settings.store)q.set("storeCode",settings.store);
    if(offset!==null){q.set("limit","50");q.set("offset",String(offset));if(settings.occurrenceQuery)q.set("q",settings.occurrenceQuery);}
    return q.toString();
  };
  const paintShell=()=>{
    const options=stores.slice().sort((a,b)=>a.codigo.localeCompare(b.codigo,"pt-BR",{numeric:true}))
      .map(s=>'<option value="'+esc(s.codigo)+'"'+(s.codigo===settings.store?' selected':'')+'>'+esc(s.codigo+" · "+s.nome)+'</option>').join("");
    const chips=PRESETS.map(([key,label])=>{
      const [chipStart,chipEnd]=presetRange(key);
      return '<button type="button" class="ghost-button report-chip" data-report-preset="'+key+'" aria-pressed="'+(chipStart===settings.start&&chipEnd===settings.end)+'">'+esc(label)+'</button>';
    }).join("");
    root.innerHTML='<section class="admin-page manager-report"><header class="page-heading"><div>'+
      '<span class="eyebrow">Indicadores de gestão</span><h1>Relatório Gerencial</h1>'+
      '<p>Resultados, tendências e pontos de atenção em um só lugar.</p></div><span class="report-heading-tag">Visão consolidada</span></header>'+
      '<form class="report-filters" data-report-filters>'+ 
      '<div class="report-filter-intro"><div><strong>Período e filtros</strong><span>Escolha os dados que deseja analisar.</span></div><small>Intervalo máximo de 93 dias</small></div>'+
      '<div class="report-presets" aria-label="Períodos rápidos">'+chips+'</div>'+
      '<label>De<input type="date" name="start" required value="'+esc(settings.start)+'"></label>'+
      '<label>Até<input type="date" name="end" required value="'+esc(settings.end)+'"></label>'+
      '<label class="report-store-filter">Loja<select name="store"><option value="">Todas as lojas</option>'+options+'</select></label>'+
      '<label class="report-compare"><input type="checkbox" name="compare"'+(settings.compare?' checked':'')+'>Comparar período anterior</label>'+
      '<button class="primary-button" type="submit">Aplicar filtros</button></form>'+
      '<p class="form-error" role="alert" data-report-error'+(error?'':' hidden')+'>'+esc(error)+'</p>'+
      '<p class="muted-state" data-report-loading>Carregando relatório...</p>'+
      '<div data-report-content></div></section>';
  };
  function paintContent(report,previous,occurrences,requestId){
    const sum=sumReportRows(report.rows),prior=sumReportRows(previous?.rows||[]),daily=groupDailyReport(report.rows),units=groupStoreReport(report.rows),weekdays=groupWeekdayReport(daily);
    const rate=x=>pct(reportRate(x));
    const prev=previous?prior:null;
    const days=Math.round((Date.parse(settings.end)-Date.parse(settings.start))/86400000)+1;
    const difference=reportRate(sum)-reportRate(prior);
    const compare=previous?'<p class="report-insight"><strong>Período anterior ('+num(days)+' dias):</strong> '+num(prior.total)+
      ' agendamentos · variação da taxa de recebimento: <strong>'+esc((difference>=0?"+":"")+difference.toLocaleString("pt-BR",{maximumFractionDigits:1})+' p.p.')+'</strong></p>':"";
    const open=sum.abertas?'<p class="report-open-note">'+num(sum.abertas)+' agenda(s) em aberto; os indicadores podem mudar até o fechamento.</p>':"";
    const storeBars=units.map(u=>meter(u.code+" · "+u.name,u.total,u.recebido)).join("")||'<p class="report-empty">Nenhuma loja.</p>';
    const highest=Math.max(1,...report.suppliers.map(x=>Number(x.naoChegou)||0));
    const supplierBars=report.suppliers.map((u,i)=>{
      const total=Number(u.total)||0,recebido=Number(u.recebido)||0,naoChegou=Number(u.naoChegou)||0;
      const footnote="Taxa de recebimento no período: "+pct(total?recebido/total*100:0)+" ("+num(recebido)+" de "+num(total)+")";
      return meter((i+1)+". "+u.supplier,highest,naoChegou,true,footnote);
    }).join("")||'<p class="report-empty">Sem ocorrências.</p>';
    const weekdayList=weekdays.map(w=>{
      const weekdayRate=reportRate(w);
      return '<div class="report-progress-item"><div><span>'+esc(WEEKDAY_LABELS[w.weekday])+'</span><strong>'+esc(pct(weekdayRate))+'</strong></div>'+
        '<div class="report-progress"><span style="width:'+weekdayRate.toFixed(2)+'%"></span></div>'+
        '<small>'+num(w.total)+' agendamento(s) em '+num(w.days)+' dia(s) · '+num(w.recebido)+' recebidos</small></div>';
    }).join("")||'<p class="report-empty">Sem movimentação no período.</p>';
    const byStore=units.map(u=>'<tr>'+cell(u.code+" · "+u.name)+[u.total,u.recebido,u.naoChegou,u.aguardando,u.semConferencia,u.recusado,u.semAgenda].map(x=>cell(num(x),true)).join("")+cell(rate(u),true)+'</tr>');
    const rows=occurrences.rows.map(r=>'<tr>'+cell(date(r.date))+cell(r.storeCode+" · "+r.storeName)+cell(r.supplier)+cell(r.protocol)+cell(r.observation||"Motivo não registrado")+'</tr>');
    const pager='<div class="report-pagination"><span>'+num(occurrences.total)+' ocorrência(s) · '+
      num(occurrences.total?settings.offset+1:0)+'–'+num(Math.min(settings.offset+50,occurrences.total))+'</span><div>'+
      '<button type="button" class="ghost-button" data-report-prev'+(settings.offset===0?' disabled':'')+'>Anterior</button> '+
      '<button type="button" class="ghost-button" data-report-next'+(settings.offset+50>=occurrences.total?' disabled':'')+'>Próxima</button></div></div>';
    const chartTools='<div class="report-chart-tools" role="group" aria-label="Modo do gráfico">'+
      '<button type="button" class="ghost-button report-mode-button" data-report-chart-mode="volume" aria-pressed="'+(settings.chartMode==="volume")+'">Volume</button>'+
      '<button type="button" class="ghost-button report-mode-button" data-report-chart-mode="rate" aria-pressed="'+(settings.chartMode==="rate")+'">Taxa de recebimento</button></div>';
    const search='<form class="report-occurrence-search" data-report-search>'+
      '<input type="search" name="q" maxlength="80" placeholder="Fornecedor ou protocolo" aria-label="Buscar ocorrência por fornecedor ou protocolo" value="'+esc(settings.occurrenceQuery)+'">'+
      '<button class="ghost-button" type="submit">Buscar</button>'+
      (settings.occurrenceQuery?'<button class="ghost-button" type="button" data-report-clear-search>Limpar</button>':"")+
      '</form>';
    root.querySelector("[data-report-content]").innerHTML=
      '<div class="report-section-heading" id="report-overview"><div><span class="report-section-kicker">VISÃO GERAL</span><h2>Resumo do período</h2><p>Indicadores consolidados das entregas.</p></div>'+ 
      '<span class="report-range-summary">'+esc(date(settings.start))+' a '+esc(date(settings.end))+' · '+esc(settings.store||"Todas as lojas")+'</span></div>'+ 
      '<div class="report-kpis">'+
      metric("Agendamentos",num(sum.total),num(sum.agendas)+" agendas",delta(sum.total,prev?.total))+
      metric("Recebidos",num(sum.recebido),rate(sum)+" do total",delta(sum.recebido,prev?.recebido,"good"))+
      metric("Não recebidos",num(sum.naoChegou),"Não chegaram",delta(sum.naoChegou,prev?.naoChegou,"invert"))+
      metric("Taxa de recebimento",rate(sum),"Recebidos / total",delta(reportRate(sum),prev?reportRate(prior):null,"good"," p.p."))+
      metric("Aguardando",num(sum.aguardando),"Agendas abertas",delta(sum.aguardando,prev?.aguardando))+
      metric("Sem conferência",num(sum.semConferencia),"Agendas concluídas",delta(sum.semConferencia,prev?.semConferencia))+
      metric("Recusados",num(sum.recusado),"Entregas recusadas",delta(sum.recusado,prev?.recusado))+'</div>'+compare+open+
      '<div class="report-section-heading" id="report-trends"><div><span class="report-section-kicker">DESEMPENHO</span><h2>Tendências e comparativos</h2><p>Evolução das entregas e padrões por unidade.</p></div></div>'+ 
      panel("Evolução diária","Volume por status ou taxa de recebimento em cada dia",chart(daily),chartTools)+
      '<div class="report-analytics-grid">'+
      panel("Comparativo por loja","Taxa de recebimento por unidade",'<div class="report-progress-list">'+storeBars+'</div>')+
      panel("Fornecedores com ocorrências","Ranking de não recebidos com a taxa de recebimento de cada um",'<div class="report-progress-list">'+supplierBars+'</div>')+
      panel("Padrão por dia da semana","Taxa de recebimento por dia da semana no período",'<div class="report-progress-list">'+weekdayList+'</div>',"","report-weekdays")+
      '</div>'+
      '<div class="report-section-heading" id="report-details"><div><span class="report-section-kicker">DETALHAMENTO</span><h2>Lojas e ocorrências</h2><p>Resultados individuais e os motivos registrados.</p></div></div>'+ 
      panel("Por loja","Indicadores consolidados",table(["Loja","Total","Recebidos","Não recebidos","Aguardando","Sem conferência","Recusados","Sem agenda","Taxa"],byStore))+
      panel("Ocorrências e observações","Motivos dos não recebimentos",table(["Data","Loja","Fornecedor","Protocolo","Motivo"],rows)+pager,search);
    disposeChart=mountReportChart(root,daily,()=>!closed && sequence===requestId,settings.chartMode);
  }
  async function load(){
    const id=++sequence;error="";cached=null;disposeChart();disposeChart=()=>{};paintShell();
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
      cached={report,previous,occurrences,requestId:id};
    }catch(e){
      if(closed||id!==sequence)return;
      root.querySelector("[data-report-loading]").hidden=true;
      const node=root.querySelector("[data-report-error]");
      node.textContent=e.message||"Não foi possível consultar o relatório.";node.hidden=false;
    }
  }
  const submit=e=>{
    if(e.target.matches("[data-report-search]")){
      e.preventDefault();
      const q=String(new FormData(e.target).get("q")||"").trim().slice(0,80);
      settings={...settings,occurrenceQuery:q,offset:0};
      void load();
      return;
    }
    if(!e.target.matches("[data-report-filters]"))return;
    e.preventDefault();
    const form=new FormData(e.target);
    const start=String(form.get("start")||""),end=String(form.get("end")||"");
    if(!validReportRange(start,end)){
      const node=root.querySelector("[data-report-error]");
      node.textContent="Selecione um período válido de até 93 dias.";node.hidden=false;return;
    }
    settings={...settings,start,end,store:String(form.get("store")||""),compare:form.has("compare"),offset:0};
    persistFilters();
    void load();
  };
  const click=e=>{
    const pagerButton=e.target.closest?.("[data-report-prev],[data-report-next]");
    if(pagerButton&&root.contains(pagerButton)&&!pagerButton.disabled){
      settings={...settings,offset:Math.max(0,settings.offset+(pagerButton.matches("[data-report-next]")?50:-50))};
      void load();
      return;
    }
    const preset=e.target.closest?.("[data-report-preset]");
    if(preset&&root.contains(preset)){
      const [start,end]=presetRange(preset.dataset.reportPreset);
      if(!validReportRange(start,end))return;
      settings={...settings,start,end,offset:0};
      persistFilters();
      void load();
      return;
    }
    const modeButton=e.target.closest?.("[data-report-chart-mode]");
    if(modeButton&&root.contains(modeButton)){
      const next=modeButton.dataset.reportChartMode||"volume";
      if(next!==settings.chartMode){
        settings={...settings,chartMode:next};
        if(cached){disposeChart();paintContent(cached.report,cached.previous,cached.occurrences,cached.requestId);}
      }
      return;
    }
    const clearSearch=e.target.closest?.("[data-report-clear-search]");
    if(clearSearch&&root.contains(clearSearch)){
      settings={...settings,occurrenceQuery:"",offset:0};
      void load();
    }
  };
  root.addEventListener("submit",submit);
  root.addEventListener("click",click);
  void load();
  return ()=>{closed=true;sequence++;disposeChart();disposeInfo();root.removeEventListener("submit",submit);root.removeEventListener("click",click);};
}