import { apiFetch } from "./api.js";
import { createBusinessDateMonitor } from "./business-date.js";
import { renderAgendaDatePicker } from "./agenda-date-picker.js";
import {
  addDashboardDays, formatDashboardDate, dashboardModel, dashboardRowHtml
} from "./dashboard-model.js";

// Equivalente nativo de src/admin/DashboardPage.tsx da main.
// DOM incremental: atualiza somente as células alteradas, sem substituir a página.
export function renderDashboard(root, {
  request = apiFetch,
  readOnly = false,
  realtime = null,
  openImport = null,
  openAgenda = null,
  doc = document,
  win = window
} = {}) {
  let disposed = false;
  let loading = true;
  let refreshing = false;
  let requestGeneration = 0;
  let agendaRefreshTimer = null;
  let stores = [], agendas = [], presences = [], livePresences = [];
  let selectedDate;
  let datePicker = null;
  const monitor = createBusinessDateMonitor({
    doc, timers: win,
    onChange: today => {
      if (disposed) return;
      const previousToday = lastToday;
      lastToday = today;
      datePicker?.setToday(today);
      if (selectedDate === previousToday) changeDate(today);
    }
  });
  let lastToday = monitor.today;
  selectedDate = lastToday;

  root.innerHTML = `<section class="admin-page receiving-page">
    <header class="page-heading page-heading-actions">
      <div>
        <span class="eyebrow">${readOnly ? "Acompanhamento" : "Administração"}</span>
        <h1>Recebimento</h1>
        <p>${readOnly
          ? "Acompanhe o andamento das agendas por loja."
          : "Acompanhe o andamento das agendas e gerencie a operação do dia."}</p>
      </div>
      <div class="dashboard-header-actions">
        <div class="dashboard-date-controls">
          <button class="ghost-button dashboard-date-step" type="button" aria-label="Dia anterior" data-day-prev>‹</button>
          <div data-date-picker></div>
          <button class="ghost-button dashboard-date-step" type="button" aria-label="Dia seguinte" data-day-next>›</button>
        </div>
        <button class="ghost-button" type="button" data-refresh>Atualizar</button>
        ${readOnly ? "" : '<button class="primary-button dashboard-import-action" type="button" data-open-import>Importar agenda</button>'}
      </div>
    </header>
    <p class="muted-state" data-loading>Carregando agendas...</p>
    <p class="form-error" data-error hidden></p>
    <section class="dashboard-section dashboard-operations" aria-label="Situação por loja" data-content hidden>
      <div class="dashboard-section-heading dashboard-operations-heading">
        <div><span class="eyebrow">Operação</span><h2>Recebimento por loja</h2></div>
        <span data-selected-date></span>
      </div>
      <div class="dashboard-operation-summary" aria-label="Situação do dia">
        <span><strong data-count="totalStores">0</strong>lojas</span>
        <span><strong data-count="storesWithAgenda">0</strong>com agenda</span>
        <span><strong data-count="openStores">0</strong>em andamento</span>
        <span><strong data-count="completedStores">0</strong>concluídas</span>
        <span><strong data-count="storesWithoutAgenda">0</strong>sem agenda</span>
      </div>
      <div class="dashboard-operation-table table-card" data-table>
        <div class="table-scroll"><table>
          <thead><tr>
            <th scope="col">Loja</th><th scope="col">Conferente</th>
            <th scope="col">Recebimentos</th><th scope="col">Pendências</th>
            <th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th>
          </tr></thead>
          <tbody data-rows></tbody>
        </table></div>
      </div>
      <div class="empty-panel" data-no-stores hidden>Nenhuma loja com conferente ativo.</div>
    </section>
  </section>`;

  const dateHost = root.querySelector("[data-date-picker]");
  datePicker = renderAgendaDatePicker(dateHost, {
    value: selectedDate,
    today: lastToday,
    onChange: value => changeDate(value)
  });

  const errorNode = root.querySelector("[data-error]");
  const showError = message => {
    if (disposed) return;
    errorNode.textContent = message || "";
    errorNode.hidden = !message;
  };
  const updateLoading = () => {
    root.querySelector("[data-loading]").hidden = !loading;
    root.querySelector("[data-content]").hidden = loading || !errorNode.hidden;
  };

  function updateTable(model) {
    const tbody = root.querySelector("[data-rows]");
    const previousRows = new Map([...tbody.querySelectorAll("tr[data-store-id]")]
      .map(row => [row.dataset.storeId, row]));
    const rowIds = new Set();
    const template = doc.createElement("template");
    model.rows.forEach((data, index) => {
      const id = String(data.store.id);
      rowIds.add(id);
      template.innerHTML = dashboardRowHtml(data, selectedDate);
      const desired = template.content.firstElementChild;
      let current = previousRows.get(id);
      if (!current) {
        current = desired;
      } else {
        if (current.className !== desired.className) current.className = desired.className;
        const oldCells = [...current.children];
        const newCells = [...desired.children];
        for (let i = 0; i < newCells.length; i++) {
          if (oldCells[i]?.outerHTML !== newCells[i].outerHTML) {
            if (oldCells[i]) oldCells[i].replaceWith(newCells[i]);
            else current.appendChild(newCells[i]);
          }
        }
      }
      const occupant = tbody.children[index];
      if (occupant !== current) tbody.insertBefore(current, occupant || null);
    });
    for (const [id, row] of previousRows) {
      if (!rowIds.has(id)) row.remove();
    }
  }

  function updateData() {
    if (disposed || loading) return;
    const useLive = realtime?.state.mode === "on" && realtime?.state.status === "connected";
    const model = dashboardModel(stores, agendas, useLive ? livePresences : presences);
    for (const key of ["totalStores", "storesWithAgenda", "openStores", "completedStores", "storesWithoutAgenda"]) {
      const cell = root.querySelector(`[data-count="${key}"]`);
      if (cell.textContent !== String(model[key])) cell.textContent = String(model[key]);
    }
    const date = formatDashboardDate(selectedDate);
    const dateNode = root.querySelector("[data-selected-date]");
    if (dateNode.textContent !== date) dateNode.textContent = date;
    root.querySelector("[data-no-stores]").hidden = model.rows.length !== 0;
    root.querySelector("[data-table]").hidden = model.rows.length === 0;
    updateTable(model);
    updateLoading();
  }

  async function refreshStores() {
    try {
      const next = await request("/api/admin/stores");
      if (!disposed) {
        stores = next;
        updateData();
      }
    } catch { /* Falha pontual não descarta as lojas já carregadas. */ }
  }
  async function refreshPresence() {
    try {
      const next = await request("/api/admin/presence");
      if (!disposed) {
        presences = next;
        updateData();
      }
    } catch { /* Presença complementar não derruba o dashboard. */ }
  }
  async function refreshAgendas({ silent = false } = {}) {
    if (disposed) return;
    const date = selectedDate, generation = requestGeneration;
    if (!silent) {
      refreshing = true;
      root.querySelector("[data-refresh]").disabled = true;
      root.querySelector("[data-refresh]").textContent = "Atualizando...";
    }
    try {
      const next = await request(`/api/admin/agendas?date=${date}`);
      if (disposed || generation !== requestGeneration) return;
      agendas = next;
      if (!silent) showError(null);
      updateData();
    } catch {
      if (!silent && generation === requestGeneration) showError("Não foi possível atualizar o dashboard.");
    } finally {
      if (!silent && !disposed) {
        refreshing = false;
        root.querySelector("[data-refresh]").disabled = false;
        root.querySelector("[data-refresh]").textContent = "Atualizar";
        updateLoading();
      }
    }
  }
  async function load() {
    const generation = ++requestGeneration, date = selectedDate;
    loading = true;
    showError(null);
    updateLoading();
    try {
      const [storeData, agendaData] = await Promise.all([
        request("/api/admin/stores"),
        request(`/api/admin/agendas?date=${date}`)
      ]);
      if (disposed || generation !== requestGeneration) return;
      stores = storeData;
      agendas = agendaData;
    } catch {
      if (disposed || generation !== requestGeneration) return;
      showError("Não foi possível carregar o dashboard.");
    } finally {
      if (!disposed && generation === requestGeneration) {
        loading = false;
        updateLoading();
        if (errorNode.hidden) updateData();
      }
    }
  }
  function changeDate(date) {
    if (disposed || date === selectedDate) return;
    selectedDate = date;
    datePicker?.setValue(date);
    void load();
  }

  const eventOff = realtime?.onEvent?.(event => {
    if (disposed) return;
    if (event.type === "presence.snapshot") {
      livePresences = event.stores; updateData();
    } else if (event.type === "presence.changed") {
      const next = new Map(livePresences.map(x => [x.storeId, x]));
      next.set(event.storeId, { storeId: event.storeId, status: event.status });
      livePresences = [...next.values()];
      updateData();
    } else if (event.type === "agenda.changed" && event.date === selectedDate && agendaRefreshTimer === null) {
      agendaRefreshTimer = win.setTimeout(() => {
        agendaRefreshTimer = null;
        void refreshAgendas({ silent: true });
      }, 75);
    }
  }) || (() => {});
  const statusOff = realtime?.onStatus?.(() => {
    updateData();
    void refreshPresence();
  }) || (() => {});

  const onVisible = () => {
    if (doc.visibilityState !== "visible") return;
    void refreshStores();
    void refreshAgendas({ silent: true });
    if (realtime?.state.mode !== "on" || realtime?.state.status !== "connected") {
      void refreshPresence();
    }
  };
  const onClick = event => {
    const button = event.target.closest?.("button");
    if (!button || !root.contains(button)) return;
    if (button.matches("[data-day-prev]")) changeDate(addDashboardDays(selectedDate, -1));
    else if (button.matches("[data-day-next]")) changeDate(addDashboardDays(selectedDate, 1));
    else if (button.matches("[data-refresh]")) {
      if (refreshing) return;
      void refreshAgendas();
      void refreshStores();
      void refreshPresence();
    } else if (button.matches("[data-open-import]") && !readOnly) {
      if (typeof openImport === "function") openImport(() => refreshAgendas());
      else showError("A importação ainda está em migração.");
    } else if (button.matches("[data-agenda-id]")) {
      if (typeof openAgenda === "function") {
        openAgenda(button.dataset.agendaId, {
          canEdit: !readOnly, canReopen: !readOnly,
          onAgendaChanged: () => refreshAgendas()
        });
      } else showError("A visualização da agenda ainda está em migração.");
    }
  };

  root.addEventListener("click", onClick);
  doc.addEventListener("visibilitychange", onVisible);
  monitor.start();
  void load();
  void refreshPresence();

  return () => {
    disposed = true;
    ++requestGeneration;
    if (agendaRefreshTimer !== null) win.clearTimeout(agendaRefreshTimer);
    eventOff();
    statusOff();
    monitor.stop();
    datePicker?.destroy();
    root.removeEventListener("click", onClick);
    doc.removeEventListener("visibilitychange", onVisible);
  };
}