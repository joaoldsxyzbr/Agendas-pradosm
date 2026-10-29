// Componentes visuais do Relatório Gerencial. Apenas dados já agregados/filtrados pela API.
import { escapeHtml as esc } from "./shell.js";

const NUMBER = new Intl.NumberFormat("pt-BR");
const PERCENT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const formatNumber = value => NUMBER.format(Number(value) || 0);
const formatPercent = value => PERCENT.format(Number(value) || 0) + "%";
const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ?
  String(value).slice(8,10) + "/" + String(value).slice(5,7) + "/" + String(value).slice(0,4) : "—";

export const STATUS_PALETTE = [
  { key: "recebido", label: "Recebidos", color: "#20c995" },
  { key: "naoChegou", label: "Não recebidos", color: "#f25b69" },
  { key: "naoCompareceu", label: "Não compareceu", color: "#f6bf42" },
  { key: "aguardando", label: "Aguardando", color: "#9877ee" },
  { key: "recusado", label: "Recusados", color: "#8c9db3" }
];

export function renderStatusDonut(summary) {
  const total = Math.max(0, Number(summary.total) || 0);
  if (!total) return '<p class="report-empty">Sem agendamentos no período.</p>';
  let progress = 0;
  const stops = STATUS_PALETTE.map(({key,color}) => {
    const count = Math.max(0, Number(summary[key]) || 0);
    const next = Math.min(100, progress + count / total * 100);
    const stop = color + " " + progress.toFixed(3) + "% " + next.toFixed(3) + "%";
    progress = next;
    return stop;
  });
  if (progress < 100) stops.push("#354454 " + progress.toFixed(3) + "% 100%");
  const ring = '<div class="report-donut-ring" role="img" aria-label="Distribuição de ' +
    formatNumber(total) + ' agendamentos entre situações" style="background:conic-gradient(' + stops.join(",") + ')">' +
    '<div class="report-donut-center"><strong>' + formatNumber(total) +
    '</strong><span>agendamentos</span></div></div>';
  const legend = STATUS_PALETTE.map(({key,label,color}) => {
    const count = Math.max(0, Number(summary[key]) || 0);
    return '<div class="report-donut-item"><span class="report-donut-label"><i style="background:' + color +
      '" aria-hidden="true"></i>' + esc(label) + '</span><strong>' + formatNumber(count) +
      ' <small>(' + formatPercent(count / total * 100) + ')</small></strong></div>';
  }).join("");
  return '<div class="report-donut-layout">' + ring + '<div class="report-donut-legend">' + legend + '</div></div>';
}

export function renderRateTrend(days) {
  const filtered = days.filter(day => Number(day.total) > 0);
  if (!filtered.length) return '<p class="report-empty">Sem recebimentos no período.</p>';
  const width = 700, left = 42, right = 675, top = 25, bottom = 203, height = bottom - top;
  const points = filtered.map((day,i) => {
    const rate = Math.min(100,Math.max(0,Number(day.recebido || 0) / Number(day.total) * 100));
    const x = left + i * (right-left) / Math.max(1,filtered.length-1);
    return {x,y:bottom - rate / 100 * height,rate, date:day.date};
  });
  const line = points.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
  const area = line + " L" + points.at(-1).x.toFixed(2) + " " + bottom + " L" + points[0].x.toFixed(2) + " " + bottom + " Z";
  const grid = [0,25,50,75,100].map(value => {
    const y = bottom-value/100*height;
    return '<line x1="'+left+'" y1="'+y+'" x2="'+right+'" y2="'+y+'" class="report-trend-grid"/>' +
      '<text x="29" y="'+(y+4)+'" text-anchor="end" class="report-trend-label">'+value+'%</text>';
  }).join("");
  const interval = Math.max(1,Math.ceil(points.length/7));
  const labels = points.filter((_,i)=>i%interval===0 || i===points.length-1).map(p =>
    '<text x="'+p.x.toFixed(2)+'" y="231" text-anchor="middle" class="report-trend-label">'+
    esc(String(p.date).slice(8)+"/"+String(p.date).slice(5,7))+'</text>').join("");
  const dots = points.filter((_,i)=>i%Math.max(1,Math.ceil(points.length/18))===0 || i===points.length-1).map(p=>
    '<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="3.8" class="report-trend-dot"><title>'+
    esc(safeDate(p.date)+": "+formatPercent(p.rate))+'</title></circle>').join("");
  const accessible = filtered.map(x=>safeDate(x.date)+": "+formatPercent(Number(x.recebido)/Number(x.total)*100)).join("; ");
  return '<div class="report-trend-wrap"><svg class="report-trend-svg" viewBox="0 0 '+width+' 250" role="img" aria-label="Evolução diária da taxa de recebimento: '+
    esc(accessible)+'"><defs><linearGradient id="report-trend-fill" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0%" stop-color="#3895ff" stop-opacity=".32"/><stop offset="100%" stop-color="#3895ff" stop-opacity="0"/></linearGradient></defs>'+
    grid+'<path d="'+area+'" fill="url(#report-trend-fill)"/><path d="'+line+'" class="report-trend-line"/>'+dots+labels+
    '</svg><div class="report-trend-key"><i></i>Taxa de recebimento</div></div>';
}

export function statusPresentation(value) {
  const statuses = {
    recebido: ["Recebido","received"],nao_chegou:["Não recebido","missed"],
    nao_compareceu:["Não compareceu","automatic"],aguardando:["Aguardando","pending"],
    recusado:["Recusado","refused"]
  };
  return statuses[value] || ["Não identificado","unknown"];
}

export function renderLatestAppointments(items) {
  if (items === null) return '<p class="report-empty">Últimos agendamentos indisponíveis nesta consulta.</p>';
  if (!items?.length) return '<p class="report-empty">Nenhum agendamento neste período.</p>';
  return '<div class="report-table-scroll report-latest-table"><table><thead><tr>'+
    '<th scope="col">Data</th><th scope="col">Hora</th><th scope="col">Loja</th>'+
    '<th scope="col">Fornecedor</th><th scope="col">Situação</th></tr></thead><tbody>'+
    items.slice(0,6).map(item=>{
      const [label,variant] = statusPresentation(item.status);
      return '<tr><td>'+esc(safeDate(item.date))+'</td><td>'+
        esc(item.startTime || "—")+'</td><td>'+esc(item.storeCode || "—")+'</td><td>'+
        esc(item.supplier || "—")+'</td><td><span class="report-status-tag is-'+variant+'">'+
        esc(label)+'</span></td></tr>';
    }).join("")+'</tbody></table></div>';
}

export function renderRecentOccurrences(items) {
  if (!items.length) return '<p class="report-empty">Nenhuma ocorrência no período.</p>';
  return '<div class="report-table-scroll report-occurrence-preview"><table><thead><tr>'+
    '<th scope="col">Data</th><th scope="col">Loja</th><th scope="col">Fornecedor</th>'+
    '<th scope="col">Situação</th><th scope="col">Origem</th></tr></thead><tbody>'+
    items.slice(0,4).map(item=>{
      const automatic = item.occurrenceType === "nao_compareceu";
      const [label,variant] = automatic ? statusPresentation("nao_compareceu") : statusPresentation("nao_chegou");
      return '<tr><td>'+esc(safeDate(item.date))+'</td><td>'+esc(item.storeCode||"—")+
        '</td><td>'+esc(item.supplier||"—")+'</td><td><span class="report-status-tag is-'+variant+'">'+
        esc(label)+'</span></td><td>'+ (automatic ? 'Sistema' : 'Conferência') +'</td></tr>';
    }).join("")+'</tbody></table></div>';
}
