import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";

export function formatHistoryDate(value) {
  const [year, month, day] = String(value).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function historyQuery({ storeCode = "", date = "" } = {}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (storeCode) params.set("storeCode", storeCode);
  return params.toString() ? `/api/admin/agendas?${params}` : "/api/admin/agendas";
}

function dayAction(action) {
  return {
    concluido: "Dia concluído", reaberto: "Dia reaberto",
    concluido_automaticamente: "Dia concluído automaticamente"
  }[action] || "Ajuste administrativo";
}

function statusPill(status) {
  return `<span class="status-pill ${status === "concluido" ? "success" : "warning"}">
    ${status === "concluido" ? "Concluído" : "Em aberto"}</span>`;
}

export function historyAgendaRow(agenda) {
  return `<tr data-agenda-id="${escapeHtml(agenda.id)}">
    <td>${escapeHtml(formatHistoryDate(agenda.date))}</td>
    <td>${escapeHtml(agenda.storeName)}</td>
    <td>${agenda.total}</td><td>${agenda.aguardando}</td><td>${agenda.recebido}</td>
    <td>${statusPill(agenda.dayStatus)}</td>
    <td class="table-action"><button class="ghost-button" type="button"
      data-open-history-agenda="${escapeHtml(agenda.id)}">Abrir agenda</button></td>
  </tr>`;
}

function appointmentRow(appointment, savingId) {
  const esc = escapeHtml;
  return `<tr data-appointment-id="${esc(appointment.id)}">
    <td>${esc(appointment.startTime)} - ${esc(appointment.endTime)}</td>
    <td>${esc(appointment.protocol)}</td><td>${esc(appointment.supplier)}</td>
    <td><select aria-label="Status de ${esc(appointment.supplier)}" data-appointment-status="${esc(appointment.id)}"
      ${savingId === appointment.id ? "disabled" : ""}>
      ${[["aguardando", "Aguardando"], ["recebido", "Recebido"],
        ["nao_chegou", "Não recebido"], ["recusado", "Recusado"]]
        .map(([value, label]) => `<option value="${value}" ${appointment.status === value ? "selected" : ""}>${label}</option>`).join("")}
    </select></td>
    <td><input type="checkbox" aria-label="Trocas de ${esc(appointment.supplier)}"
      data-appointment-exchanges="${esc(appointment.id)}" ${appointment.hasExchanges ? "checked" : ""}
      ${savingId === appointment.id ? "disabled" : ""}></td>
    <td class="table-action"><button class="ghost-button" type="button"
      data-appointment-history="${esc(appointment.id)}">Ver histórico</button></td>
  </tr>`;
}

function dayList(events) {
  return events.length ? `<ul>${events.map(item => `<li>
    <strong>${escapeHtml(dayAction(item.action))}</strong>
    <span>${escapeHtml(item.user?.name ?? "Sistema")}${item.details ? ` · ${escapeHtml(item.details)}` : ""}</span>
  </li>`).join("")}</ul>` : "<p>Nenhum evento registrado para o dia.</p>";
}

function appointmentHistoryList(events) {
  return events.length ? `<ul>${events.map(item => `<li>
    <strong>${escapeHtml(item.statusAnterior)} → ${escapeHtml(item.statusNovo)}</strong>
    <span>${escapeHtml(item.usuario?.nome ?? "Sistema")}</span>
  </li>`).join("")}</ul>` : "<p>Nenhuma alteração registrada.</p>";
}

export function renderHistory(root, { request = apiFetch } = {}) {
  let disposed = false, loading = false, reopening = false;
  let queryToken = 0, detailToken = 0, savingId = null;
  let stores = [], agendas = [], detail = null, dayEvents = [];
  let history = [], historyAppointmentId = null;
  root.innerHTML = `<section class="admin-page">
    <header class="page-heading"><div>
      <span class="eyebrow">Administração</span><h1>Histórico</h1>
      <p>Consulte agendas anteriores e a trilha de alterações de status.</p>
    </div></header>
    <form class="filter-bar" data-history-filter>
      <label><span>Loja</span><select name="storeCode" data-history-store>
        <option value="">Todas</option></select></label>
      <label><span>Data</span><input type="date" name="date"></label>
      <button class="primary-button" type="submit" data-history-submit>Filtrar</button>
    </form>
    <p class="form-error" data-history-error hidden></p>
    <div class="table-card"><div class="table-scroll"><table>
      <thead><tr><th>Data</th><th>Loja</th><th>Total</th>
        <th>Aguardando</th><th>Recebidos</th><th>Status do dia</th>
        <th><span class="sr-only">Ações</span></th></tr></thead>
      <tbody data-history-rows><tr><td colspan="7" class="empty-cell">Use os filtros para consultar agendas.</td></tr></tbody>
    </table></div></div>
    <div data-history-detail></div>
  </section>`;

  const error = message => {
    const box = root.querySelector("[data-history-error]");
    box.textContent = message || "";
    box.hidden = !message;
  };
  const drawRows = () => {
    if (disposed) return;
    root.querySelector("[data-history-rows]").innerHTML = agendas.length
      ? agendas.map(historyAgendaRow).join("")
      : '<tr><td colspan="7" class="empty-cell">Use os filtros para consultar agendas.</td></tr>';
  };
  const drawDetail = () => {
    if (disposed) return;
    const host = root.querySelector("[data-history-detail]");
    if (!detail) { host.replaceChildren(); return; }
    const agenda = detail.agenda;
    host.innerHTML = `<section class="detail-panel">
      <div class="section-heading"><div>
        <h2>${escapeHtml(agenda.storeCode)} - ${escapeHtml(agenda.storeName)}</h2>
        <p>${escapeHtml(formatHistoryDate(agenda.date))}</p>
        ${statusPill(agenda.dayStatus)}
      </div>${agenda.dayStatus === "concluido" ? `
        <button class="primary-button" type="button" data-reopen-agenda ${reopening ? "disabled" : ""}>
          ${reopening ? "Reabrindo..." : "Reabrir para conferente"}</button>` : ""}
      </div>
      <div class="table-scroll"><table>
        <thead><tr><th>Horário</th><th>Protocolo</th><th>Fornecedor</th>
          <th>Status</th><th>Trocas</th><th><span class="sr-only">Ações</span></th></tr></thead>
        <tbody data-appointment-rows>${detail.appointments.map(item => appointmentRow(item, savingId)).join("")}</tbody>
      </table></div>
      <div class="history-box"><h3>Histórico do dia</h3><div data-day-events>${dayList(dayEvents)}</div></div>
      ${historyAppointmentId ? `<div class="history-box">
        <h3>Histórico de status</h3><div data-appointment-events>${appointmentHistoryList(history)}</div>
      </div>` : ""}
    </section>`;
  };
  const updateAppointment = updated => {
    if (!detail) return;
    detail = { ...detail, appointments: detail.appointments.map(item => item.id === updated.id ? updated : item) };
    const row = root.querySelector("[data-appointment-rows]")?.querySelector(
      `[data-appointment-id="${CSS.escape(updated.id)}"]`);
    if (!row) { drawDetail(); return; }
    const temp = root.ownerDocument.createElement("template");
    temp.innerHTML = appointmentRow(updated, null);
    row.replaceWith(temp.content);
  };
  const reloadDayHistory = async agenda => {
    const events = await request(`/api/admin/agendas/${encodeURIComponent(agenda.id)}/history`);
    if (disposed || detail?.agenda.id !== agenda.id) return;
    dayEvents = events;
    const host = root.querySelector("[data-day-events]");
    if (host) host.innerHTML = dayList(dayEvents);
  };

  const query = async event => {
    event.preventDefault();
    if (loading) return;
    const token = ++queryToken;
    ++detailToken;
    loading = true; error(null);
    const form = root.querySelector("[data-history-filter]");
    const submit = form.querySelector("[data-history-submit]");
    submit.disabled = true; submit.textContent = "Consultando...";
    detail = null; history = []; historyAppointmentId = null;
    drawDetail();
    try {
      const data = await request(historyQuery({
        storeCode: form.elements.namedItem("storeCode").value,
        date: form.elements.namedItem("date").value
      }));
      if (disposed || token !== queryToken) return;
      agendas = data;
      drawRows();
    } catch {
      if (!disposed && token === queryToken) error("Não foi possível consultar as agendas.");
    } finally {
      loading = false;
      if (!disposed) { submit.disabled = false; submit.textContent = "Filtrar"; }
    }
  };
  const openAgenda = async id => {
    const token = ++detailToken;
    detail = null; history = []; historyAppointmentId = null; dayEvents = [];
    error(null); drawDetail();
    try {
      const [data, events] = await Promise.all([
        request(`/api/admin/agendas/${encodeURIComponent(id)}`),
        request(`/api/admin/agendas/${encodeURIComponent(id)}/history`)
      ]);
      if (disposed || token !== detailToken) return;
      detail = data; dayEvents = events; drawDetail();
    } catch {
      if (!disposed && token === detailToken) error("Não foi possível abrir a agenda.");
    }
  };
  const changeAppointment = async (appointmentId, field, value) => {
    if (!detail || savingId) return;
    const currentAgenda = detail.agenda;
    savingId = appointmentId; error(null);
    const row = [...root.querySelectorAll("[data-appointment-id]")].find(x => x.dataset.appointmentId === appointmentId);
    for (const input of row?.querySelectorAll("select, input") || []) input.disabled = true;
    try {
      const updated = await request(
        `/api/admin/appointments/${encodeURIComponent(appointmentId)}/${field}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(field === "status" ? { status: value } : { hasExchanges: value })
        }
      );
      if (disposed || detail?.agenda.id !== currentAgenda.id) return;
      updateAppointment(updated);
      if (currentAgenda.dayStatus === "concluido") await reloadDayHistory(currentAgenda);
    } catch {
      if (!disposed) {
        error(field === "status" ? "Não foi possível alterar o status." : "Não foi possível alterar a marcação de trocas.");
        const item = detail?.appointments.find(x => x.id === appointmentId);
        if (item) updateAppointment(item);
      }
    } finally {
      savingId = null;
      for (const input of row?.querySelectorAll("select, input") || []) input.disabled = false;
    }
  };
  const reopen = async () => {
    if (!detail || reopening) return;
    reopening = true; error(null);
    const currentAgendaId = detail.agenda.id;
    const button = root.querySelector("[data-reopen-agenda]");
    if (button) { button.disabled = true; button.textContent = "Reabrindo..."; }
    try {
      const agenda = await request(`/api/admin/agendas/${encodeURIComponent(currentAgendaId)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aberto" })
      });
      if (disposed || detail?.agenda.id !== currentAgendaId) return;
      detail = { ...detail, agenda };
      agendas = agendas.map(x => x.id === agenda.id ? {
        ...x, dayStatus: agenda.dayStatus, completedAt: agenda.completedAt, completedBy: agenda.completedBy
      } : x);
      drawRows();
      await reloadDayHistory(agenda);
      drawDetail();
    } catch {
      if (!disposed) error("Não foi possível reabrir o dia.");
    } finally {
      reopening = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = "Reabrir para conferente"; }
    }
  };
  const openAppointmentHistory = async id => {
    error(null);
    try {
      const items = await request(`/api/admin/appointments/${encodeURIComponent(id)}/history`);
      if (disposed || !detail) return;
      history = items; historyAppointmentId = id;
      const host = root.querySelector("[data-history-detail]");
      const existing = host.querySelector("[data-appointment-events]");
      if (existing) existing.innerHTML = appointmentHistoryList(items);
      else drawDetail();
    } catch {
      if (!disposed) error("Não foi possível consultar o histórico de status.");
    }
  };

  const onClick = event => {
    const button = event.target.closest?.("button");
    if (!button || !root.contains(button)) return;
    if (button.matches("[data-open-history-agenda]")) {
      void openAgenda(button.dataset.openHistoryAgenda);
    } else if (button.matches("[data-appointment-history]")) {
      void openAppointmentHistory(button.dataset.appointmentHistory);
    } else if (button.matches("[data-reopen-agenda]")) {
      void reopen();
    }
  };
  const onChange = event => {
    const control = event.target;
    if (control.matches("[data-appointment-status]")) {
      void changeAppointment(control.dataset.appointmentStatus, "status", control.value);
    } else if (control.matches("[data-appointment-exchanges]")) {
      void changeAppointment(control.dataset.appointmentExchanges, "exchanges", control.checked);
    }
  };
  root.addEventListener("submit", query);
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  void request("/api/admin/stores").then(data => {
    if (disposed) return;
    stores = data;
    const select = root.querySelector("[data-history-store]");
    select.insertAdjacentHTML("beforeend", stores.map(item => `<option value="${escapeHtml(item.codigo)}">
      ${escapeHtml(`${item.codigo} - ${item.nome}`)}</option>`).join(""));
  }).catch(() => {
    if (!disposed) error("Não foi possível carregar as lojas.");
  });
  return () => {
    disposed = true;
    ++queryToken; ++detailToken;
    root.removeEventListener("submit", query);
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", onChange);
  };
}
