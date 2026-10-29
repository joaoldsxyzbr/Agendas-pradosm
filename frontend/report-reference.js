import { reportRate } from "./report-model.js";
import { escapeHtml as esc } from "./shell.js";

// Painel resumido: os números vêm exclusivamente das respostas do relatório.
// Não usa totais fixos, dados fictícios nem HTML fornecido pela API.
const n=value=>Number(value||0).toLocaleString("pt-BR");
const pct=value=>Number(value||0).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const shortDate=value=>{const v=String(value||"");return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+"/"+v.slice(5,7):v;};
const safePercent=value=>Math.max(0,Math.min(100,Number(value)||0));
const statuses=[
  {key:"recebido",name:"Recebidos",color:"#24c78b"},
  {key:"naoChegou",name:"Não recebidos",color:"#f0525f"},
  {key:"naoCompareceu",name:"Não compareceu",color:"#ffbf40"},
  {key:"aguardando",name:"Aguardando",color:"#9464ed"},
  {key:"recusado",name:"Recusados",color:"#94a7bf"}
];
const card=(name,body,cls="")=>'<section class="report-reference-card '+cls+'"><h3>'+esc(name)+'</h3>'+body+'</section>';
const empty=message=>'<p class="report-reference-empty">'+esc(message)+'</p>';
function trend(daily){
  const days=daily.slice(-14);
  if(!days.some(x=>x.total))return empty("Sem agendamentos no período.");
  const points=days.map((d,i)=>{
    const value=safePercent(reportRate(d));
    return {x:days.length===1?50:6+i*(88/(days.length-1)),y:91-value*.76,rate:value,date:d.date};
  });
  const coordinates=points.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
  const area="6,91 "+coordinates+" 94,91";
  const grid=[0,25,50,75,100].map(p=>'<line x1="6" y1="'+(91-p*.76).toFixed(2)+'" x2="94" y2="'+(91-p*.76).toFixed(2)+'"/>').join("");
  const labels=days.filter((_,i)=>i===0||i===days.length-1||days.length>4&&i===Math.floor((days.length-1)/2))
    .map(d=>'<span>'+esc(shortDate(d.date))+'</span>').join("");
  return '<div class="report-reference-trend" role="img" aria-label="Taxa de recebimento diária dos últimos '+n(days.length)+' dias com agendas.">'+
    '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+
      '<defs><linearGradient id="report-reference-line-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#3f9cff" stop-opacity=".34"/><stop offset="100%" stop-color="#3f9cff" stop-opacity=".015"/></linearGradient></defs>'+
      '<g class="report-reference-gridlines">'+grid+'</g>'+
      '<polygon points="'+area+'" fill="url(#report-reference-line-fill)"/>'+
      '<polyline points="'+coordinates+'" fill="none" stroke="#449eff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'+
      points.map(p=>'<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r=".85" fill="#70baff" vector-effect="non-scaling-stroke"/>').join("")+
    '</svg><div class="report-reference-trend-labels">'+labels+'</div></div>'+
    '<p class="report-reference-caption"><span class="report-reference-dot report-reference-dot-blue"></span> Taxa de recebimento por dia</p>';
}
function distribution(sum){
  if(!sum.total)return empty("Nenhum agendamento no período.");
  let used=0;
  const gradient=statuses.map(s=>{
    const current=used;
    used+=Number(sum[s.key]||0)/sum.total*100;
    return s.color+" "+current.toFixed(3)+"% "+Math.min(100,used).toFixed(3)+"%";
  }).join(",");
  const items=statuses.map(s=>{
    const amount=Number(sum[s.key]||0);
    return '<li><span class="report-reference-dot" style="background:'+s.color+'"></span><span>'+esc(s.name)+'</span>'+
      '<strong>'+n(amount)+' <small>('+pct(amount/sum.total*100)+')</small></strong></li>';
  }).join("");
  return '<div class="report-reference-distribution">'+
    '<div class="report-reference-donut" style="background:conic-gradient('+gradient+')" role="img" aria-label="Distribuição dos '+n(sum.total)+' agendamentos por situação.">'+
      '<div class="report-reference-donut-hole"><strong>'+n(sum.total)+'</strong><small>agendamentos</small></div></div>'+
    '<ul class="report-reference-distribution-list">'+items+'</ul></div>';
}
function storesRanking(stores){
  const ranking=stores.filter(store=>Number(store.total)>0).slice().sort((a,b)=>reportRate(b)-reportRate(a)||String(a.code).localeCompare(String(b.code),"pt-BR")).slice(0,5);
  if(!ranking.length)return empty("Sem resultados por loja no período.");
  return '<div class="report-reference-ranking">'+ranking.map(store=>{
    const rate=safePercent(reportRate(store));
    return '<div class="report-reference-store-row">'+
      '<span class="report-reference-store-name" title="'+esc(store.code+" · "+store.name)+'">'+esc(store.code+" · "+store.name)+'</span>'+
      '<span class="report-reference-store-meter"><span style="width:'+rate.toFixed(1)+'%"></span></span>'+
      '<strong>'+pct(rate)+'</strong><span class="report-reference-store-count">'+n(store.recebido)+' / '+n(store.total)+'</span></div>';
  }).join("")+'</div><a class="report-reference-link" href="#report-details">Ver todas as lojas <span aria-hidden="true">→</span></a>';
}
function stacked(daily){
  const days=daily.slice(-7);
  if(!days.length)return empty("Sem movimentação no período.");
  const max=Math.max(1,...days.map(x=>Number(x.total)||0));
  const bars=days.map(day=>{
    const total=Number(day.total)||0;
    const height=total?Math.max(3,total/max*100):0;
    return '<div class="report-reference-day" role="img" aria-label="'+esc(shortDate(day.date)+": "+n(total)+" agendamentos")+'">'+
      '<div class="report-reference-stack-space"><div class="report-reference-stack" style="height:'+height.toFixed(2)+'%">'+
      statuses.map(s=>'<span title="'+esc(s.name)+': '+n(day[s.key])+'" style="height:'+(total?Number(day[s.key]||0)/total*100:0).toFixed(3)+'%;background:'+s.color+'"></span>').join("")+
      '</div></div><small>'+esc(shortDate(day.date))+'</small></div>';
  }).join("");
  return '<div class="report-reference-stacked">'+bars+'</div><div class="report-reference-stacked-legend">'+
    statuses.map(s=>'<span><i style="background:'+s.color+'"></i>'+esc(s.name)+'</span>').join("")+'</div>';
}
function shortOccurrences(occurrences){
  const list=Array.isArray(occurrences?.rows)?occurrences.rows.slice(0,5):[];
  if(!list.length)return empty("Nenhuma ocorrência no período.");
  const rows=list.map(o=>{
    const automatic=o.occurrenceType==="nao_compareceu";
    const label=automatic?"Não compareceu":"Não recebido";
    const origin=automatic?"Sistema":"Conferente";
    return '<tr><td>'+esc(shortDate(o.date))+'</td><td>'+esc(o.storeCode)+'</td><td>'+esc(o.supplier||"—")+'</td>'+
      '<td><span class="report-reference-status '+(automatic?"is-absent":"is-missed")+'">'+esc(label)+'</span></td>'+
      '<td class="report-reference-text-limit" title="'+esc(o.observation||"")+'">'+esc(automatic?"Classificação no fechamento":o.observation||"Motivo não informado")+'</td>'+
      '<td>'+esc(origin)+'</td></tr>';
  }).join("");
  return '<div class="report-reference-table-scroll"><table><thead><tr><th>Data</th><th>Loja</th><th>Fornecedor</th><th>Situação</th><th>Motivo</th><th>Origem</th></tr></thead><tbody>'+
    rows+'</tbody></table></div><a class="report-reference-link" href="#report-details">Ver todas as ocorrências <span aria-hidden="true">→</span></a>';
}
function recentAppointments(latest){
  const list=Array.isArray(latest?.rows)?latest.rows.slice(0,5):[];
  if(!list.length)return empty("Nenhum agendamento recente no período.");
  const statusNames={recebido:"Recebido",nao_recebido:"Não recebido",nao_compareceu:"Não compareceu",aguardando:"Aguardando",recusado:"Recusado"};
  const rows=list.map(a=>{
    const status=statusNames[a.status]||"Aguardando";
    const tag=a.status==="recebido"?"is-received":a.status==="nao_compareceu"?"is-absent":a.status==="nao_recebido"?"is-missed":a.status==="recusado"?"is-refused":"is-pending";
    return '<tr><td>'+esc(shortDate(a.date))+'</td><td>'+esc(a.time||"—")+'</td><td>'+esc(a.storeCode)+'</td><td>'+esc(a.supplier||"—")+'</td>'+
      '<td><span class="report-reference-status '+tag+'">'+esc(status)+'</span></td></tr>';
  }).join("");
  return '<div class="report-reference-table-scroll"><table><thead><tr><th>Data</th><th>Hora</th><th>Loja</th><th>Fornecedor</th><th>Situação</th></tr></thead><tbody>'+
    rows+'</tbody></table></div><a class="report-reference-link" href="#report-details">Ver detalhamento <span aria-hidden="true">→</span></a>';
}
export function renderReferenceOverview({sum,daily,stores,occurrences,latest,prior=null}){
  const rate=safePercent(reportRate(sum));
  const comparison=prior&&prior.total>0
    ?'<p class="report-reference-rate-compare">'+esc((reportRate(sum)-reportRate(prior)>=0?"+":"")+pct(reportRate(sum)-reportRate(prior))+' p.p. em relação ao período anterior</p>'
    :'<p class="report-reference-rate-compare report-reference-muted">Sem comparação disponível</p>';
  const rateBody='<div class="report-reference-rate"><strong>'+pct(rate)+'</strong><p>'+n(sum.recebido)+' de '+n(sum.total)+' agendamentos</p>'+
    '<div class="report-reference-rate-track" aria-hidden="true"><span style="width:'+rate.toFixed(1)+'%"></span></div>'+comparison+'</div>';
  return '<div class="report-reference-overview" aria-label="Visão gerencial de recebimentos">'+
    '<div class="report-reference-row report-reference-row-charts">'+
    card("Taxa de recebimento",rateBody,"report-reference-rate-card")+
    card("Evolução dos recebimentos",trend(daily),"report-reference-trend-card")+
    card("Distribuição das situações",distribution(sum),"report-reference-donut-card")+'</div>'+
    '<div class="report-reference-row report-reference-row-analysis">'+
    card("Desempenho por loja",storesRanking(stores),"report-reference-store-card")+
    card("Agendamentos por situação (por dia)",stacked(daily),"report-reference-stack-card")+'</div>'+
    '<div class="report-reference-row report-reference-row-tables">'+
    card("Ocorrências recentes",shortOccurrences(occurrences),"report-reference-occurrences-card")+
    card("Últimos agendamentos",recentAppointments(latest),"report-reference-latest-card")+'</div></div>';
}
