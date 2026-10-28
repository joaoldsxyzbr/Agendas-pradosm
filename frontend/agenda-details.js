import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { STATUS_LABELS } from "./agenda-list.js";

function display(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}
function statusLabel(status, observation) {
  if (status === "nao_chegou" && observation === "Não compareceu") return "Não compareceu";
  return STATUS_LABELS[status] || status;
}
export function agendaDetailHtml(item) {
  const esc = escapeHtml;
  const fields = [
    ["Horário", `${item.startTime} - ${item.endTime}`],
    ["Protocolo", item.protocol], ["Fornecedor", item.supplier],
    ["Status", statusLabel(item.status,item.observation)],
    ["Obs.", display(item.observation)],
    ["Tipo", display(item.type)], ["Itens", display(item.items)],
    ["Volumes", display(item.volumes)], ["Paletes", display(item.pallets)],
    ["Carga batida", display(item.cargaBatida)]
  ];
  const docSection = (title, values, empty) => `<section>
    <h3>${title}</h3>
    ${values?.length ? `<ul>${values.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`
      : `<p>${empty}</p>`}
  </section>`;
  return `<dl class="detail-grid">${fields.map(([label,value])=>`<div>
    <dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    <div class="document-grid">
      ${docSection("NF-e",item.nfe,"Nenhuma NF-e informada.")}
      ${docSection("Pedidos",item.orders,"Nenhum pedido informado.")}
    </div>
    <section class="history-box">
      <h3>Histórico de alterações</h3>
      ${item.history?.length ? `<ul>${item.history.map(entry=>`<li>
        <strong>${esc(entry.statusAnterior)} → ${esc(statusLabel(entry.statusNovo,entry.observation))}</strong>
        <span>${esc(entry.usuario?.nome)}</span>
        ${entry.observation ? `<span>Obs.: ${esc(entry.observation)}</span>` : ""}</li>`).join("")}</ul>`
        : '<p>Nenhuma alteração de status registrada.</p>'}
    </section>`;
}
export function openAgendaDetails(root, appointmentId, { request = apiFetch } = {}) {
  let disposed = false;
  root.innerHTML = `<section class="agenda-details" aria-labelledby="agenda-details-title">
    <div class="section-heading agenda-details-heading">
      <div><span class="eyebrow">Recebimento</span><h2 id="agenda-details-title">Detalhes do agendamento</h2></div>
      <button class="ghost-button" type="button" data-details-close>Fechar</button>
    </div>
    <div data-details-content><p class="muted-state">Carregando detalhes...</p></div>
  </section>`;
  const content = root.querySelector("[data-details-content]");
  const close = () => { disposed = true; root.replaceChildren(); };
  const button = root.querySelector("[data-details-close]");
  button.addEventListener("click",close);
  void request(`/api/store/appointments/${encodeURIComponent(appointmentId)}`)
    .then(data => {
      if (!disposed) content.innerHTML = agendaDetailHtml(data);
    }).catch(() => {
      if (!disposed) content.innerHTML = '<p class="form-error">Não foi possível carregar os detalhes.</p>';
    });
  return close;
}