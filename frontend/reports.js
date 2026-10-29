import { apiFetch } from "./api.js";
import { reportInfo, setupReportInfo } from "./report-info.js";
import { mountReportChart } from "./report-chart.js";
import { renderReferenceOverview } from "./report-reference.js";
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
function table(columns,rows,className="") {
  return '<div class="report-table-scroll'+(className?" "+esc(className):"")+'"><table><thead><tr>'+
    columns.map(x=>'<th scope="col">'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+
    (rows.length?rows.join(""):'<tr><td colspan="'+columns.length+'" class="report-empty">Nenhum registro no período.</td></tr>')+
    '</tbody></table></div>';
}
const cell=(text,numeric=false)=>'<td'+(numeric?' class="report-number"':'')+'>'+esc(text)+'</td>';
const rateCell=value=>{
  const safe=Math.min(100,Math.max(0,value));
  return '<td class="report-number report-rate-cell"><strong>'+esc(pct(safe))+'</strong>'+
    '<span class="report-rate-track" aria-hidden="true"><i style="width:'+safe.toFixed(1)+'%"></i></span></td>';
};
const occurrenceStatus=automatic=>'<span class="report-status-tag '+(automatic?'is-automatic':'is-manual')+'">'+(automatic?'Não compareceu':'Não recebido')+'</span>';
const panel=(title,description,inner,actions="",cls="")=>'<section class="report-panel'+(cls?" "+cls:"")+'"><header><div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div>'+
  (actions?'<div class="report-panel-actions">'+reportInfo(title)+actions+'</div>':reportInfo(title))+'</header>'+inner+'</section>';
const METRIC_ICONS=Object.freeze({
  "Agendamentos":["calendar-days","appointments"],
  "Recebidos":["circle-check","received"],
  "Não recebidos":["circle-x","missed"],
  "Não compareceu":["users","absent"],
  "Aguardando":["clock","pending"],
  "Recusados":["ban","refused"],
  "Taxa de recebimento":["percent","rate"]
});
const metric=(label,value,description,delta=null,variant="supporting",progress=null)=>{
  const featured=progress!==null;
  const [icon,tone]=METRIC_ICONS[label]||["circle","neutral"];
  const meter=featured?'<div class="report-featured-meter" aria-hidden="true"><span style="width:'+Math.min(100,Math.max(0,progress)).toFixed(1)+'%"></span></div>':"";
  return '<div class="report-metric report-metric-'+variant+' report-metric-tone-'+tone+(featured?' report-metric-featured':'')+'">'+
    '<span class="report-metric-icon" aria-hidden="true"><img src="/vendor/lucide/'+icon+'.svg" alt="" width="20" height="20"></span>'+
    '<div class="report-metric-heading"><span>'+esc(label)+'</span>'+reportInfo(label)+'</div>'+
    '<strong>'+esc(value)+'</strong>'+meter+
    (delta?'<small class="report-metric-delta '+delta.cls+'">'+esc(delta.text)+'</small>':"")+
    '<small>'+esc(description)+'</small></div>';
};
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
    const segments=["recebido","naoChegou","aguardando","naoCompareceu","recusado"].map(k=>
      '<span class="report-segment-'+k+'" style="height:'+(total?((d[k]||0)/total*100).toFixed(2):0)+'%"></span>').join("");
    const description=date(d.date)+": "+num(d.total)+" agendamentos; "+num(d.recebido)+" recebidos; "+num(d.naoChegou)+" não recebidos; "+num(d.aguardando)+" aguardando; "+num(d.naoCompareceu)+" não compareceu";
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
    [["recebido","Recebidos"],["naoChegou","Não recebidos"],["aguardando","Aguardando"],["naoCompareceu","Não compareceu"],["recusado","Recusados"]]
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
  const TAB_KEYS=["overview","trends","details"];
  const tabFromHash=()=>TAB_KEYS.find(tab=>root.ownerDocument.defaultView?.location.hash==="#report-"+tab)||"overview";
  let activeTab=tabFromHash();
  const disposeInfo=setupReportInfo(root);
  let settings={end:businessDate(),start:"",stores:[],compare:true,offset:0,occurrenceQuery:"",chartMode:"volume"};
  settings.start=shift(settings.end,-29);
  const restoreFilters=()=>{
    if(typeof window==="undefined")return null;
    try{
      const raw=window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if(!raw)return null;
      const saved=JSON.parse(raw);
      if(!saved||!validReportRange(String(saved.start),String(saved.end)))return null;
      // Compatível com o filtro anterior, que salvava uma única loja.
      const previous=Array.isArray(saved.stores)?saved.stores:(saved.store?[saved.store]:[]);
      const selected=[...new Set(previous.filter(code=>typeof code==="string"&&code.trim().length>0&&code.length<=20))];
      return {start:String(saved.start),end:String(saved.end),stores:selected,compare:!!saved.compare};
    }catch{return null;}
  };
  const savedFilters=restoreFilters();
  if(savedFilters)Object.assign(settings,savedFilters);
  const persistFilters=()=>{
    if(typeof window==="undefined")return;
    try{window.localStorage.setItem(FILTERS_STORAGE_KEY,JSON.stringify({start:settings.start,end:settings.end,stores:settings.stores,compare:settings.compare}));}catch{}
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
    for(const code of settings.stores)q.append("storeCode",code);
    if(offset!==null){q.set("limit","50");q.set("offset",String(offset));if(settings.occurrenceQuery)q.set("q",settings.occurrenceQuery);}
    return q.toString();
  };
  const storeLabel=codes=>{
    if(!codes.length)return "Todas as lojas";
    if(codes.length===1){
      const store=stores.find(s=>s.codigo===codes[0]);
      return store?store.codigo+" · "+store.nome:codes[0];
    }
    return codes.length+" lojas selecionadas";
  };
  const syncStorePicker=()=>{
    const picker=root.querySelector("[data-report-store-select]");
    if(!picker)return;
    const selected=[...picker.querySelectorAll('input[name="stores"]:checked')].map(input=>input.value);
    picker.querySelector("[data-report-store-all]").checked=selected.length===0;
    picker.querySelector("[data-report-store-summary]").textContent=storeLabel(selected);
  };
  const paintShell=()=>{
    const options=stores.slice().sort((a,b)=>a.codigo.localeCompare(b.codigo,"pt-BR",{numeric:true}))
      .map(s=>'<label class="report-store-option"><input type="checkbox" name="stores" value="'+esc(s.codigo)+'"'+(settings.stores.includes(s.codigo)?' checked':'')+'><span>'+esc(s.codigo+" · "+s.nome)+'</span></label>').join("");
    const selectedLabel=storeLabel(settings.stores);
    const chips=PRESETS.map(([key,label])=>{
      const [chipStart,chipEnd]=presetRange(key);
      return '<button type="button" class="ghost-button report-chip" data-report-preset="'+key+'" aria-pressed="'+(chipStart===settings.start&&chipEnd===settings.end)+'">'+esc(label)+'</button>';
    }).join("");
    root.innerHTML='<section class="admin-page manager-report"><header class="page-heading"><div>'+
      '<span class="eyebrow">INTELIGÊNCIA OPERACIONAL</span><h1>Relatório Gerencial</h1>'+
      '<p>Panorama dos recebimentos, desempenho das lojas e ocorrências registradas.</p></div><span class="report-heading-tag">Visão consolidada</span></header>'+
      '<nav class="report-navigation" role="tablist" aria-label="Seções do relatório">'+
      '<a href="#report-overview" role="tab" id="report-tab-overview" data-report-tab="overview" aria-controls="report-panel-overview" aria-selected="true" tabindex="0">Visão geral</a>'+
      '<a href="#report-trends" role="tab" id="report-tab-trends" data-report-tab="trends" aria-controls="report-panel-trends" aria-selected="false" tabindex="-1">Desempenho</a>'+
      '<a href="#report-details" role="tab" id="report-tab-details" data-report-tab="details" aria-controls="report-panel-details" aria-selected="false" tabindex="-1">Detalhamento</a></nav>'+
      '<details class="report-filter-popover" data-report-popover><summary class="report-filter-trigger" aria-label="Editar período e lojas">'+
      '<span class="report-range-summary">'+esc(date(settings.start))+' a '+esc(date(settings.end))+' · '+esc(storeLabel(settings.stores))+'</span>'+
      '<span class="report-filter-chevron" aria-hidden="true">▾</span></summary>'+
      '<form class="report-filters" data-report-filters>'+ 
      '<div class="report-filter-intro"><div><strong>Filtros da análise</strong><span>Defina o período e as unidades para atualizar todos os indicadores.</span></div><small>Até 93 dias</small></div>'+
      '<div class="report-presets" aria-label="Períodos rápidos">'+chips+'</div>'+
      '<label>De<div class="report-date-control"><input type="date" lang="pt-BR" name="start" data-report-date-input="start" value="'+esc(settings.start)+'"></div></label>'+
      '<label>Até<div class="report-date-control"><input type="date" lang="pt-BR" name="end" data-report-date-input="end" value="'+esc(settings.end)+'"></div></label>'+
      '<div class="report-store-filter"><span>Lojas</span><details class="report-store-select" data-report-store-select>'+
        '<summary data-report-store-summary>'+esc(selectedLabel)+'</summary>'+
        '<div class="report-store-menu">'+
          '<label class="report-store-option report-store-all"><input type="checkbox" data-report-store-all'+(settings.stores.length?'':' checked')+'><span>Todas as lojas</span></label>'+options+
        '</div></details></div>'+
      '<label class="report-compare"><input type="checkbox" name="compare"'+(settings.compare?' checked':'')+'>Comparar período anterior</label>'+
      '<button class="primary-button" type="submit">Aplicar filtros</button></form></details>'+
      '<p class="form-error" role="alert" data-report-error'+(error?'':' hidden')+'>'+esc(error)+'</p>'+
      '<p class="muted-state" data-report-loading>Carregando relatório...</p>'+
      '<div data-report-content></div></section>';
  };
  function showTab(tab){
    activeTab=TAB_KEYS.includes(tab)?tab:"overview";
    for(const panel of root.querySelectorAll("[data-report-tab-panel]")){
      panel.hidden=panel.dataset.reportTabPanel!==activeTab;
    }
    for(const link of root.querySelectorAll("[data-report-tab]")){
      const selected=link.dataset.reportTab===activeTab;
      link.setAttribute("aria-selected",String(selected));
      link.tabIndex=selected?0:-1;
    }
    // O filtro pertence ao cabeçalho da aba atual, sem perder seleções.
    const heading=root.querySelector("#report-"+activeTab);
    const popover=root.querySelector("[data-report-popover]");
    if(heading&&popover)heading.append(popover);
    if(activeTab==="trends"){
      const canvas=root.querySelector("[data-report-chart-canvas]");
      root.ownerDocument.defaultView?.Chart?.getChart(canvas)?.resize();
    }
  }
  function paintContent(report,previous,occurrences,requestId,latest=null){
    const sum=sumReportRows(report.rows),prior=sumReportRows(previous?.rows||[]),daily=groupDailyReport(report.rows),units=groupStoreReport(report.rows),weekdays=groupWeekdayReport(daily);
    const rate=x=>pct(reportRate(x));
    const prev=previous&&prior.total>0?prior:null;
    const days=Math.round((Date.parse(settings.end)-Date.parse(settings.start))/86400000)+1;
    const hasPriorRate=Boolean(previous)&&prior.total>0;
    const difference=hasPriorRate?reportRate(sum)-reportRate(prior):null;
    const compare=previous?'<p class="report-insight"><strong>Período anterior ('+num(days)+' dias):</strong> '+num(prior.total)+
      (hasPriorRate?' agendamentos · variação da taxa de recebimento: <strong>'+esc((difference>=0?"+":"")+difference.toLocaleString("pt-BR",{maximumFractionDigits:1})+' p.p.')+'</strong>':' agendamentos · sem base para comparar a taxa de recebimento.')+'</p>':"";
    const open=sum.abertas?'<p class="report-open-note">'+num(sum.abertas)+' agenda(s) em aberto; os indicadores podem mudar até o fechamento.</p>':"";
    const rankedStores=units.filter(unit=>Number(unit.total)>0).slice().sort((a,b)=>
      reportRate(b)-reportRate(a)||String(a.code).localeCompare(String(b.code),"pt-BR",{numeric:true}));
    const storeBars=rankedStores.length
      ?[
        '<div class="report-store-highlight report-store-highlight-best">'+meter(rankedStores[0].code+" · "+rankedStores[0].name,rankedStores[0].total,rankedStores[0].recebido,false,"Maior taxa no período")+'</div>',
        ...(rankedStores.length>1?['<div class="report-store-highlight report-store-highlight-low">'+meter(rankedStores.at(-1).code+" · "+rankedStores.at(-1).name,rankedStores.at(-1).total,rankedStores.at(-1).recebido,false,"Menor taxa no período")+'</div>']:[])
      ].join("")
      :'<p class="report-empty">Sem movimentação por loja no período.</p>';
    const storeComparisonDescription=rankedStores.length>1
      ?"Maior e menor taxa no período; a tabela abaixo reúne todos os indicadores."
      :rankedStores.length===1
        ?"Taxa da loja no período; a tabela abaixo reúne todos os indicadores."
        :"Nenhuma agenda por loja no período.";
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
    const byStore=units.map(u=>'<tr>'+cell(u.code+" · "+u.name)+[u.total,u.recebido,u.naoChegou,u.aguardando,u.naoCompareceu,u.recusado,u.semAgenda].map(x=>cell(num(x),true)).join("")+rateCell(reportRate(u))+'</tr>');
    const rows=occurrences.rows.map(r=>{
      const automatic=r.occurrenceType==="nao_compareceu";
      const source=r.classificationOrigin==="historico"?"Sistema · agenda antiga concluída":
        automatic?"Sistema · fechamento do dia":"Registrado manualmente";
      return '<tr>'+cell(date(r.date))+cell(r.storeCode+" · "+r.storeName)+cell(r.supplier)+cell(r.protocol)+
        '<td>'+occurrenceStatus(automatic)+'</td>'+
        cell(automatic?"Não compareceu":r.observation||"Motivo não registrado")+
        '<td class="report-origin-cell">'+(automatic?'<span class="report-source-indicator" aria-hidden="true"></span>':'')+esc(source)+'</td></tr>';
    });
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
    // Mantém o popover e seus campos enquanto o gráfico alterna sem refazer requisições.
    const popover=root.querySelector("[data-report-popover]");
    popover?.remove();
    root.querySelector("[data-report-content]").innerHTML=
      '<section class="report-tab-panel" id="report-panel-overview" data-report-tab-panel="overview" role="tabpanel" aria-labelledby="report-tab-overview">'+
      '<div class="report-section-heading" id="report-overview"><div><span class="report-section-kicker">VISÃO GERAL</span><h2>Resumo do período</h2><p>Indicadores consolidados das entregas.</p></div>'+ 
      '</div>'+ 
      '<div class="report-kpis">'+
      metric("Agendamentos",num(sum.total),num(sum.agendas)+" agendas",delta(sum.total,prev?.total),"primary")+
      metric("Recebidos",num(sum.recebido),rate(sum)+" do total",delta(sum.recebido,prev?.recebido,"good"),"primary")+
      metric("Não recebidos",num(sum.naoChegou),"Registrados na conferência",delta(sum.naoChegou,prev?.naoChegou,"invert"),"primary")+
      metric("Não compareceu",num(sum.naoCompareceu),"Classificados no fechamento",delta(sum.naoCompareceu,prev?.naoCompareceu))+
      metric("Aguardando",num(sum.aguardando),"Pendentes em agendas abertas",delta(sum.aguardando,prev?.aguardando))+
      metric("Recusados",num(sum.recusado),"Entregas recusadas",delta(sum.recusado,prev?.recusado))+
      metric("Taxa de recebimento",rate(sum),"Recebidos em relação ao total",hasPriorRate?delta(reportRate(sum),reportRate(prior),"good"," p.p."):null,"primary",reportRate(sum))+'</div>'+
      renderReferenceOverview({sum,daily,stores:units,occurrences,latest,prior:hasPriorRate?prior:null})+
      ((compare||open)?'<div class="report-context-notes">'+compare+open+'</div>':"")+
      '</section>'+
      '<section class="report-tab-panel" id="report-panel-trends" data-report-tab-panel="trends" role="tabpanel" aria-labelledby="report-tab-trends">'+
      '<div class="report-section-heading" id="report-trends"><div><span class="report-section-kicker">DESEMPENHO</span><h2>Tendências e comparativos</h2><p>Evolução das entregas e padrões por unidade.</p></div></div>'+ 
      panel("Evolução diária","Volume por status ou taxa de recebimento em cada dia",chart(daily),chartTools)+
      '<div class="report-analytics-grid">'+
      panel("Comparativo por loja",storeComparisonDescription,'<div class="report-progress-list report-store-highlights">'+storeBars+'</div>')+
      panel("Fornecedores com ocorrências","Ranking de não recebidos com a taxa de recebimento de cada um",'<div class="report-progress-list">'+supplierBars+'</div>')+
      panel("Padrão por dia da semana","Taxa de recebimento por dia da semana no período",'<div class="report-progress-list">'+weekdayList+'</div>',"","report-weekdays")+
      '</div></section>'+
      '<section class="report-tab-panel" id="report-panel-details" data-report-tab-panel="details" role="tabpanel" aria-labelledby="report-tab-details">'+
      '<div class="report-section-heading" id="report-details"><div><span class="report-section-kicker">DETALHAMENTO</span><h2>Lojas e ocorrências</h2><p>Resultados individuais e os motivos registrados.</p></div></div>'+ 
      panel("Por loja","Indicadores consolidados",table(["Loja","Total","Recebidos","Não recebidos","Aguardando","Não compareceu","Recusados","Sem agenda","Taxa"],byStore,"report-store-table"))+
      panel("Ocorrências e observações","Não recebidos registrados e não comparecimentos por fechamento",table(["Data","Loja","Fornecedor","Protocolo","Situação","Motivo","Origem"],rows)+pager,search)+
      '</section>';
    if(popover)root.querySelector("#report-"+activeTab)?.append(popover);
    disposeChart=mountReportChart(root,daily,()=>!closed && sequence===requestId,settings.chartMode);
    showTab(activeTab);
  }
  async function load(){
    const id=++sequence;error="";cached=null;disposeChart();disposeChart=()=>{};paintShell();
    try{
      if(!storePromise)storePromise=request("/api/admin/stores").catch(e=>{storePromise=null;throw e;});
      stores=await storePromise;
      if(closed||id!==sequence)return;
      // Evita filtros obsoletos caso uma loja tenha sido removida.
      settings.stores=settings.stores.filter(code=>stores.some(store=>store.codigo===code));
      paintShell();
      const days=Math.round((Date.parse(settings.end)-Date.parse(settings.start))/86400000)+1;
      const before=shift(settings.start,-1),earlier=shift(before,-days+1);
      const [report,previous,occurrences,latest]=await Promise.all([
        request("/api/admin/reports?"+params(settings.start,settings.end)),
        settings.compare?request("/api/admin/reports?"+params(earlier,before)):Promise.resolve(null),
        request("/api/admin/reports/occurrences?"+params(settings.start,settings.end,settings.offset)),
        request("/api/admin/reports/latest?"+params(settings.start,settings.end))
      ]);
      if(closed||id!==sequence)return;
      root.querySelector("[data-report-loading]").hidden=true;
      paintContent(report,previous,occurrences,id,latest);
      cached={report,previous,occurrences,latest,requestId:id};
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
    settings={...settings,start,end,stores:form.getAll("stores").map(String),compare:form.has("compare"),offset:0};
    persistFilters();
    void load();
  };
  const click=e=>{
    const tab=e.target.closest?.("[data-report-tab]");
    if(tab&&root.contains(tab)){
      e.preventDefault();
      showTab(tab.dataset.reportTab);
      root.ownerDocument.defaultView?.history.replaceState(null,"",tab.getAttribute("href"));
      return;
    }
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
        if(cached){disposeChart();paintContent(cached.report,cached.previous,cached.occurrences,cached.requestId,cached.latest);}
      }
      return;
    }
    const clearSearch=e.target.closest?.("[data-report-clear-search]");
    if(clearSearch&&root.contains(clearSearch)){
      settings={...settings,occurrenceQuery:"",offset:0};
      void load();
    }
  };
  const change=e=>{
    const target=e.target;
    if(!target.matches?.('[data-report-store-all],input[name="stores"]'))return;
    const picker=target.closest("[data-report-store-select]");
    if(!picker)return;
    if(target.matches("[data-report-store-all]")&&target.checked)
      for(const input of picker.querySelectorAll('input[name="stores"]'))input.checked=false;
    if(target.matches('input[name="stores"]')&&target.checked)
      picker.querySelector("[data-report-store-all]").checked=false;
    syncStorePicker();
  };
  const dismissPicker=e=>{
    const picker=root.querySelector("[data-report-store-select]");
    if(picker?.open&&!picker.contains(e.target))picker.open=false;
  };
  const keyboard=e=>{
    const tab=e.target.closest?.("[data-report-tab]");
    if(tab&&["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){
      const index=TAB_KEYS.indexOf(tab.dataset.reportTab);
      const next=e.key==="Home"?0:e.key==="End"?TAB_KEYS.length-1:
        (index+(e.key==="ArrowRight"?1:-1)+TAB_KEYS.length)%TAB_KEYS.length;
      const link=root.querySelector('[data-report-tab="'+TAB_KEYS[next]+'"]');
      e.preventDefault();
      showTab(TAB_KEYS[next]);
      root.ownerDocument.defaultView?.history.replaceState(null,"",link.getAttribute("href"));
      link.focus();
      return;
    }
    if(e.key!=="Escape")return;
    const picker=root.querySelector("[data-report-store-select]");
    if(picker?.open){picker.open=false;picker.querySelector("summary").focus();e.preventDefault();return;}
    const popover=root.querySelector("[data-report-popover]");
    if(popover?.open){popover.open=false;popover.querySelector(".report-filter-trigger")?.focus();e.preventDefault();}
  };
  const dismissPopover=e=>{
    const popover=root.querySelector("[data-report-popover]");
    if(popover?.open&&!popover.contains(e.target))popover.open=false;
  };
  root.addEventListener("submit",submit);
  root.addEventListener("click",click);
  root.addEventListener("change",change);
  root.addEventListener("keydown",keyboard);
  root.ownerDocument.addEventListener("click",dismissPicker);
  root.ownerDocument.addEventListener("click",dismissPopover);
  const onHashChange=()=>showTab(tabFromHash());
  root.ownerDocument.defaultView?.addEventListener("hashchange",onHashChange);
  void load();
  return ()=>{closed=true;sequence++;disposeChart();disposeInfo();root.removeEventListener("submit",submit);root.removeEventListener("click",click);root.removeEventListener("change",change);root.removeEventListener("keydown",keyboard);root.ownerDocument.removeEventListener("click",dismissPicker);root.ownerDocument.removeEventListener("click",dismissPopover);root.ownerDocument.defaultView?.removeEventListener("hashchange",onHashChange);};
}