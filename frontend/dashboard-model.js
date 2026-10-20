import { escapeHtml } from "./shell.js";

export function addDashboardDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDashboardDate(value) {
  const [year, month, day] = String(value).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function presenceLabel(status) {
  switch (status) {
    case "online": return "Online";
    case "away": return "Ausente";
    default: return "Offline";
  }
}

export function dashboardModel(stores, agendas, presences) {
  const activeStores = stores.filter(store => store.ativo && store.temConferenteAtivo !== false);
  const byCode = new Map(agendas.map(agenda => [agenda.storeCode, agenda]));
  const byId = new Map(presences.map(presence => [presence.storeId, presence]));
  const storesWithAgenda = activeStores.filter(store => byCode.has(store.codigo)).length;
  const completedStores = activeStores.filter(store => byCode.get(store.codigo)?.dayStatus === "concluido").length;
  const openStores = activeStores.filter(store => {
    const agenda = byCode.get(store.codigo);
    return agenda && agenda.dayStatus !== "concluido";
  }).length;
  return {
    rows: activeStores.map(store => ({
      store, agenda: byCode.get(store.codigo) || null,
      presenceStatus: byId.get(store.id)?.status || "offline"
    })),
    totalStores: activeStores.length,
    storesWithAgenda,
    completedStores,
    openStores,
    storesWithoutAgenda: Math.max(0, activeStores.length - storesWithAgenda)
  };
}

export function dashboardRowHtml({ store, agenda, presenceStatus }, selectedDate) {
  const presence = presenceLabel(presenceStatus);
  const rowClass = agenda?.dayStatus === "concluido" ? "is-completed" : agenda ? "is-open" : "is-empty";
  const esc = escapeHtml;
  // <progress> usa valores numéricos seguros, sem depender de cores para transmitir avanço.
  const received = Math.max(0, Number(agenda?.recebido) || 0);
  const total = Math.max(0, Number(agenda?.total) || 0);
  const progressMax = Math.max(1, total);
  const progressValue = Math.min(received, progressMax);
  return `<tr class="dashboard-operation-row ${rowClass}" data-store-id="${esc(store.id)}" data-testid="dashboard-store-${esc(store.codigo)}">
    <td class="dashboard-store-cell">
      <strong>${esc(store.codigo)}<small class="dashboard-agenda-mark">${agenda ? "Agenda importada" : "Sem agenda"}</small></strong>
      <span>${esc(store.nome)}</span>
    </td>
    <td><span class="dashboard-presence">
      <span class="presence-dot ${esc(presenceStatus)}" role="img"
        aria-label="Conferente ${esc(presence.toLowerCase())}" title="${esc(presence)}"></span>${esc(presence)}
    </span></td>
    <td class="dashboard-progress-cell">${agenda
      ? `<strong>${received} <span class="dashboard-progress-divider">/</span> ${total}</strong>
        <progress class="dashboard-received-progress" value="${progressValue}" max="${progressMax}" aria-label="Recebimentos concluídos"></progress>`
      : '<span class="dashboard-empty-value">—</span>'}</td>
    <td class="dashboard-pending-cell">${agenda
      ? `<div>
          <span class="${agenda.aguardando > 0 ? "has-waiting" : "is-zero"}">${agenda.aguardando} aguardando</span>
          <span class="${agenda.naoChegou > 0 ? "has-missing" : "is-zero"}">${agenda.naoChegou} não recebidos</span>
          ${agenda.recusado > 0 ? `<span class="has-missing">${agenda.recusado} recusados</span>` : ""}
          ${agenda.semAgenda > 0 ? `<span>${agenda.semAgenda} sem agenda</span>` : ""}
        </div>`
      : `<span class="dashboard-no-agenda-copy">Não importada em ${esc(formatDashboardDate(selectedDate))}</span>`}</td>
    <td>${agenda
      ? `<span class="status-pill ${agenda.dayStatus === "concluido" ? "success" : "warning"}">${agenda.dayStatus === "concluido" ? "Concluído" : "Em andamento"}</span>`
      : '<span class="status-pill muted">Sem agenda</span>'}</td>
    <td class="table-action">${agenda
      ? `<button class="ghost-button dashboard-store-details" type="button" data-agenda-id="${esc(agenda.id)}">Ver detalhes</button>`
      : ""}</td>
  </tr>`;
}
