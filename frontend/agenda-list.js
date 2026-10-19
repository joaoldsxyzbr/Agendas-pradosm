import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { OBSERVATION_REASONS, normalizeObservation, validateStatusObservation } from "../shared/observations.js";

export const STATUS_LABELS = Object.freeze({
  aguardando: "Aguardando", recebido: "Recebido",
  nao_chegou: "Não recebido", recusado: "Recusado"
});
const STATUSES = [
  { value: "recebido", label: "Recebido", symbol: "✓" },
  { value: "nao_chegou", label: "Não recebido", symbol: "✕" }
];
const SORT_KEYS = { time: "startTime", supplier: "supplier",
  protocol: "protocol", type: "type", status: "status" };
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function appointmentTime(item) {
  return item.origin === "manual" ? item.startTime : `${item.startTime} - ${item.endTime}`;
}
export function normalizeAgendaSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}
export function sortAgendaAppointments(items, sort = null) {
  const byDefault = (a,b) => a.startTime.localeCompare(b.startTime) ||
    a.protocol.localeCompare(b.protocol);
  return [...items].sort((a,b) => {
    if (!sort) return byDefault(a,b);
    const attr = SORT_KEYS[sort.key];
    const result = collator.compare(a[attr] ?? "", b[attr] ?? "");
    if (result) return sort.direction === "asc" ? result : -result;
    return byDefault(a,b);
  });
}
export function nextAgendaSort(previous, key) {
  if (!previous || previous.key !== key) return { key, direction: "desc" };
  if (previous.direction === "desc") return { key, direction: "asc" };
  return null;
}
export function requestedAgendaStatus(current, selected) {
  return current === selected ? "aguardando" : selected;
}
function statusBadge(item) {
  return `<span class="store-status status-${escapeHtml(item.status)}">${escapeHtml(STATUS_LABELS[item.status])}</span>`;
}
function actions(item, { editable, onChanged, onEditManual, onDeleteManual, onOpen }) {
  const esc = escapeHtml;
  const controls = editable && onChanged ? `<div class="status-actions-wrap">
    <div class="status-actions" aria-label="Alterar status">
      ${STATUSES.map(option => `<button type="button" class="status-action status-action-${option.value}${item.status === option.value ? " current" : ""}"
        data-status="${option.value}" data-id="${esc(item.id)}" aria-label="${option.label}"
        title="${item.status === option.value ? "Voltar para aguardando" : `Marcar como ${option.label.toLowerCase()}`}"
        aria-pressed="${item.status === option.value}"><span aria-hidden="true">${option.symbol}</span></button>`).join("")}
    </div>
    <p class="inline-error" role="alert" data-inline-error hidden></p>
  </div>` : "";
  const edit = editable && item.origin === "manual" && onEditManual
    ? `<button class="ghost-button agenda-manual-edit-action" type="button"
        data-edit-manual="${esc(item.id)}" aria-label="Editar fornecedor ${esc(item.supplier)}"
        title="Editar fornecedor">✎</button>` : "";
  const del = editable && item.origin === "manual" && onDeleteManual
    ? `<button class="ghost-button agenda-manual-delete-action" type="button"
        data-delete-manual="${esc(item.id)}" aria-label="Excluir fornecedor ${esc(item.supplier)}"
        title="Excluir fornecedor">✕</button>` : "";
  const open = onOpen
    ? `<button class="ghost-button agenda-detail-button" type="button"
         data-open-appointment="${esc(item.id)}">Ver detalhes</button>` : "";
  return `<div class="agenda-row-actions">${controls}${edit}${del}${open}</div>`;
}
function observationCell(item, options) {
  const text = item.observation ?? "";
  const title = escapeHtml(text || "Sem observação");
  if (options.editable && options.onChanged) {
    return `<button class="agenda-observation-trigger" type="button" data-edit-observation="${escapeHtml(item.id)}"
      title="${title}" aria-label="Observação de ${escapeHtml(item.supplier)}: ${title}">
      ${text ? `<span class="agenda-observation-value">${escapeHtml(text)}</span>` : '<span class="agenda-observation-add">+ Obs.</span>'}
    </button>`;
  }
  return text ? `<span class="agenda-observation-value" title="${title}">${escapeHtml(text)}</span>`
    : '<span class="agenda-observation-empty">—</span>';
}
function exchanges(item, options) {
  if (options.editable && options.onChanged) {
    return `<div class="exchange-control"><input type="checkbox" aria-label="Trocas"
       data-exchanges="${escapeHtml(item.id)}" ${item.hasExchanges ? "checked" : ""}>
       <p class="inline-error" role="alert" data-inline-error hidden></p></div>`;
  }
  return `<span class="exchange-readonly ${options.highlightPositiveExchanges && item.hasExchanges ? "positive" : ""}">${item.hasExchanges ? "Sim" : "Não"}</span>`;
}
export function agendaRowHtml(item, options) {
  const esc = escapeHtml;
  const hasActions = Boolean(options.onOpen || (options.editable &&
    (options.onChanged || options.onEditManual || options.onDeleteManual)));
  return `<tr data-appointment-id="${esc(item.id)}" data-testid="agenda-desktop-row">
    <td>${esc(appointmentTime(item))}</td><td title="${esc(item.supplier)}">${esc(item.supplier)}</td>
    <td>${esc(item.protocol)}</td><td>${esc(item.type ?? "-")}</td><td>${statusBadge(item)}</td>
    ${hasActions ? `<td class="table-action">${actions(item, options)}</td>` : ""}
    <td class="exchange-cell">${exchanges(item,options)}</td>
    <td class="agenda-observation-cell">${observationCell(item,options)}</td></tr>`;
}
function mobileCard(item, options) {
  const esc = escapeHtml;
  const hasActions = Boolean(options.onOpen || (options.editable &&
    (options.onChanged || options.onEditManual || options.onDeleteManual)));
  return `<article class="agenda-card" data-appointment-id="${esc(item.id)}" data-testid="agenda-mobile-card">
    <div class="agenda-card-heading"><div><strong>${esc(appointmentTime(item))}</strong>
      <span>${esc(item.supplier)}</span></div><span class="protocol-chip">${esc(item.protocol)}</span></div>
    <div class="agenda-card-meta"><span>${esc(item.type ?? "Tipo não informado")}</span></div>
    ${statusBadge(item)}${hasActions ? actions(item,options) : ""}
    <div class="agenda-card-exchanges"><span>Trocas</span>${exchanges(item,options)}</div>
    <div class="agenda-card-observation"><span>Obs.</span>${observationCell(item,options)}</div>
  </article>`;
}
function sortHeader(key, label, sort) {
  const active = sort?.key === key ? sort.direction : null;
  const aria = active === "asc" ? "ascending" : active === "desc" ? "descending" : "none";
  return `<th aria-sort="${aria}"><button class="agenda-sort-button" type="button"
    data-sort="${key}" title="Ordenar por ${label}">
    <span>${label}</span><span class="agenda-sort-icon" aria-hidden="true">${active === "desc" ? "↓" : active === "asc" ? "↑" : ""}</span>
  </button></th>`;
}

// Componente reutilizado pelo conferente e detalhe administrativo.
export function renderAgendaList(root, initialOptions = {}) {
  let options = { editable: true, appointmentApiBase: "/api/store/appointments",
    request: apiFetch, ...initialOptions };
  let items = options.appointments || [];
  let sort = null;
  let disposed = false;
  const pending = new Set();
  let closeObservationDialog = null;
  let headerSignature = null;
  const hasActions = () => Boolean(options.onOpen || (options.editable &&
    (options.onChanged || options.onEditManual || options.onDeleteManual)));

  const draw = () => {
    if (disposed) return;
    const sorted = sortAgendaAppointments(items, sort);
    const header = [
      sortHeader("time","Horário",sort),sortHeader("supplier","Fornecedor",sort),
      sortHeader("protocol","Protocolo",sort),sortHeader("type","Tipo",sort),
      sortHeader("status","Status",sort),hasActions() ? "<th>Ações</th>" : "", "<th>Trocas</th>", "<th>Obs.</th>"
    ].join("");
    // Preserva o container ao atualizar um único agendamento.
    const signature = JSON.stringify({sort, hasActions:hasActions()});
    if (!root.querySelector("[data-agenda-desktop]")) {
      root.innerHTML = `<div class="agenda-desktop table-card ${hasActions() ? "has-actions" : "is-readonly"}"
        data-agenda-desktop><div class="table-scroll"><table><thead><tr data-agenda-header>${header}</tr></thead>
        <tbody data-agenda-rows></tbody></table></div></div>
        <div class="agenda-mobile" data-agenda-mobile></div>`;
    } else {
      const th = root.querySelector("[data-agenda-header]");
      if (headerSignature !== signature) th.innerHTML = header;
    }
    headerSignature = signature;
    const container = root.querySelector("[data-agenda-desktop]");
    const containerClass = "agenda-desktop table-card " + (hasActions() ? "has-actions" : "is-readonly");
    if (container.className !== containerClass) container.className = containerClass;
    const tbody = root.querySelector("[data-agenda-rows]");
    const mobile = root.querySelector("[data-agenda-mobile]");
    // Um estado vazio anterior não pode permanecer misturado aos novos agendamentos.
    for (const placeholder of tbody.querySelectorAll("tr:not([data-appointment-id])")) {
      placeholder.remove();
    }
    const desktopRows = new Map([...tbody.querySelectorAll("tr[data-appointment-id]")]
      .map(row => [row.dataset.appointmentId, row]));
    const mobileRows = new Map([...mobile.querySelectorAll("article[data-appointment-id]")]
      .map(row => [row.dataset.appointmentId, row]));
    const create = html => {
      const template = root.ownerDocument.createElement("template");
      template.innerHTML = html;
      return template.content.firstElementChild;
    };
    for (const [index,item] of sorted.entries()) {
      const id = String(item.id);
      let desktop = desktopRows.get(id);
      const nextDesktop = create(agendaRowHtml(item,options));
      if (!desktop) desktop = nextDesktop;
      else if (desktop.outerHTML !== nextDesktop.outerHTML && !pending.has(id)) desktop.replaceWith(nextDesktop), desktop = nextDesktop;
      if (tbody.children[index] !== desktop) tbody.insertBefore(desktop,tbody.children[index] || null);
      let card = mobileRows.get(id);
      const nextCard = create(mobileCard(item,options));
      if (!card) card = nextCard;
      else if (card.outerHTML !== nextCard.outerHTML && !pending.has(id)) card.replaceWith(nextCard),card=nextCard;
      if (mobile.children[index] !== card) mobile.insertBefore(card,mobile.children[index] || null);
      desktopRows.delete(id); mobileRows.delete(id);
    }
    for (const row of desktopRows.values()) row.remove();
    for (const row of mobileRows.values()) row.remove();
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="${hasActions()?8:7}" class="empty-cell">Nenhum agendamento nesta agenda.</td></tr>`;
    }
  };
  const action = async (id, kind, value, trigger) => {
    if (pending.has(id)) return;
    const item = items.find(item => item.id === id);
    if (!item) return;
    pending.add(id);
    let failed = false;
    const controls = [...root.querySelectorAll("[data-appointment-id]")]
      .filter(row => row.dataset.appointmentId === id)
      .flatMap(row => [...row.querySelectorAll("button, input")]);
    controls.forEach(el => { el.disabled = true; });
    try {
      const suffix = kind === "status" ? "status" : kind === "observation" ? "observation" : "exchanges";
      const body = kind === "status"
        ? { status: requestedAgendaStatus(item.status,typeof value === "string" ? value : value.status),
            observation: typeof value === "string" ? null : value.observation }
        : kind === "observation" ? { observation: value } : { hasExchanges: value };
      const updated = await options.request(
        `${options.appointmentApiBase}/${encodeURIComponent(id)}/${suffix}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      if (disposed) return;
      items = items.map(x => x.id === id ? updated : x);
      options.onChanged?.(updated);
      return true;
    } catch (error) {
      failed = true;
      if (disposed) return;
      for (const row of root.querySelectorAll("[data-appointment-id]")) {
        if (row.dataset.appointmentId !== id) continue;
        const el = row.querySelector("[data-inline-error]");
        if (el) {
          el.textContent = error instanceof ApiError ? error.message
            : kind === "status" ? "Não foi possível alterar o status."
              : kind === "observation" ? "Não foi possível salvar a observação."
                : "Não foi possível alterar a marcação de trocas.";
          el.hidden = false;
        }
        const input = row.querySelector('[data-exchanges]');
        if (input) input.checked = item.hasExchanges;
      }
      return false;
    } finally {
      pending.delete(id);
      if (!disposed) {
        controls.forEach(el => {if(el.isConnected)el.disabled=false;});
        if (!failed) draw();
      }
    }
  };
  const openObservationDialog = (item, status, trigger) => {
    closeObservationDialog?.();
    const required = status === "nao_chegou" || (!status && item.status === "nao_chegou");
    const current = item.observation ?? "";
    const preset = OBSERVATION_REASONS.includes(current) ? current
      : current.startsWith("Outros: ") ? "Outros" : "";
    const custom = preset === "Outros" ? current.slice(8) : "";
    const backdrop = root.ownerDocument.createElement("div");
    backdrop.className = "modal-backdrop observation-modal-backdrop";
    backdrop.innerHTML = `<form class="modal-card observation-dialog" role="dialog" aria-modal="true"
      aria-labelledby="observation-dialog-title">
      <div class="modal-heading">
        <div><span class="eyebrow">Recebimento</span>
          <h2 id="observation-dialog-title">${required ? "Motivo de não recebimento" : "Observação"}</h2></div>
        <button class="ghost-button" type="button" data-observation-cancel aria-label="Fechar">Fechar</button>
      </div>
      <p class="observation-dialog-supplier">${escapeHtml(item.supplier)}</p>
      <label class="observation-field">Motivo ${required ? "(obrigatório)" : "(opcional)"}
        <select data-observation-reason ${required ? "required" : ""}>
          <option value="">${required ? "Selecione um motivo" : "Sem observação"}</option>
          ${OBSERVATION_REASONS.map(reason => `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`).join("")}
          <option value="Outros">Outros (personalizado)</option>
        </select>
      </label>
      <label class="observation-field" data-observation-custom-wrap hidden>Descreva o motivo
        <textarea data-observation-custom maxlength="242" rows="3" placeholder="Descreva o motivo"></textarea>
      </label>
      <p class="form-error" data-observation-error role="alert" hidden></p>
      <div class="observation-dialog-actions">
        <button class="ghost-button" type="button" data-observation-cancel>Cancelar</button>
        <button class="primary-button" type="submit" data-observation-save>Confirmar</button>
      </div>
    </form>`;
    const select = backdrop.querySelector("[data-observation-reason]");
    const textarea = backdrop.querySelector("[data-observation-custom]");
    const customWrap = backdrop.querySelector("[data-observation-custom-wrap]");
    const errorNode = backdrop.querySelector("[data-observation-error]");
    const submit = backdrop.querySelector("[data-observation-save]");
    select.value = preset;
    textarea.value = custom;
    const sync = () => {
      customWrap.hidden = select.value !== "Outros";
      textarea.required = select.value === "Outros";
    };
    sync();
    select.addEventListener("change", sync);
    const onKey = event => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    const close = () => {
      backdrop.remove();
      root.ownerDocument.removeEventListener("keydown", onKey);
      if (closeObservationDialog === close) closeObservationDialog = null;
      if (trigger?.isConnected) trigger.focus();
    };
    closeObservationDialog = close;
    for (const button of backdrop.querySelectorAll("[data-observation-cancel]"))
      button.addEventListener("click", close);
    backdrop.addEventListener("click",event=>{if(event.target===backdrop)close();});
    backdrop.addEventListener("submit",async event=>{
      event.preventDefault();
      errorNode.hidden=true;
      let note;
      try {
        const input = select.value === "Outros" ? "Outros: " + textarea.value.trim() : select.value;
        note = required ? validateStatusObservation(status ?? item.status,input) : normalizeObservation(input);
      } catch (error) {
        errorNode.textContent = error.message;
        errorNode.hidden = false;
        return;
      }
      submit.disabled = true;
      const saved = await action(item.id,status ? "status" : "observation",
        status ? {status,observation:note} : note,trigger);
      if (saved) close();
      else {
        errorNode.textContent = "Não foi possível salvar. Tente novamente.";
        errorNode.hidden=false;
        submit.disabled=false;
      }
    });
    root.ownerDocument.body.appendChild(backdrop);
    select.focus();
  };
  const onClick = event => {
    const button = event.target.closest?.("button");
    if (!button || !root.contains(button)) return;
    if (button.matches("[data-sort]")) {
      sort = nextAgendaSort(sort,button.dataset.sort); draw(); return;
    }
    const id = button.dataset.id;
    if (id && button.matches("[data-status]") && options.editable && options.onChanged) {
      const next = requestedAgendaStatus(items.find(x=>x.id===id)?.status,button.dataset.status);
      if (next === "nao_chegou") {
        const item = items.find(x=>x.id===id);
        if (item) openObservationDialog(item,next,button);
      } else void action(id,"status",button.dataset.status,button);
      return;
    }
    if (button.matches("[data-edit-observation]") && options.editable && options.onChanged) {
      const item = items.find(x=>x.id===button.dataset.editObservation);
      if (item) openObservationDialog(item,null,button);
      return;
    }
    const appointment = items.find(x=>x.id===button.dataset.editManual ||
      x.id===button.dataset.deleteManual || x.id===button.dataset.openAppointment);
    if (!appointment) return;
    if (button.matches("[data-edit-manual]")) options.onEditManual?.(appointment);
    else if (button.matches("[data-delete-manual]")) options.onDeleteManual?.(appointment);
    else if (button.matches("[data-open-appointment]")) options.onOpen?.(appointment.id);
  };
  const onChange = event => {
    const input = event.target;
    if (!input.matches("[data-exchanges]") || !options.editable || !options.onChanged) return;
    void action(input.dataset.exchanges,"exchanges",input.checked,input);
  };
  root.addEventListener("click",onClick);
  root.addEventListener("change",onChange);
  draw();
  return {
    update(next, nextOptions = {}) {
      items = next || [];
      options = { ...options, ...nextOptions };
      draw();
    },
    destroy() {
      disposed = true;
      closeObservationDialog?.();
      root.removeEventListener("click",onClick);
      root.removeEventListener("change",onChange);
    }
  };
}