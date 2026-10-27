import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";
import { rowsDetailHtml } from "./cross.js";

const formatDate = value => String(value ?? "").split("-").reverse().join("/");
const number = value => Number(value ?? 0).toLocaleString("pt-BR");
const dock01 = agenda => agenda?.storeCode?.trim().toUpperCase() === "CD DOCA 01";
const endpoint = (agendaId, mode) =>
  `/api/${mode === "admin" ? "admin" : "store"}/cross/agendas/${encodeURIComponent(agendaId)}`;

function suppliersHtml(entries) {
  if (!entries.length) return `<p class="muted-state cross-agenda-empty">
    Nenhum fornecedor desta agenda possui Cross importado.</p>`;
  return `<div class="cross-supplier-list">
    ${entries.map(({ appointment, cross }) => `
      <button type="button" class="cross-supplier-choice" data-cross-supplier="${escapeHtml(appointment.id)}">
        <span class="cross-supplier-primary"><strong>${escapeHtml(appointment.supplier)}</strong>
          <small>${escapeHtml(appointment.startTime)}–${escapeHtml(appointment.endTime)} ·
            Protocolo ${escapeHtml(appointment.protocol)}</small></span>
        <span class="cross-supplier-secondary">
          <strong>${number(cross.stores)} lojas</strong>
          <small>${number(cross.separateQty)} unidades a separar</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>`).join("")}
    </div>`;
}

/**
 * P3/P4: visualização limitada à agenda do conferente ou do ADM.
 * Nenhum relatório independente/legado aparece nesta tela.
 */
export function openCrossAgendaViewer(root, {
  agenda, request = apiFetch, mode = "store", onClose = () => {}
} = {}) {
  if (!dock01(agenda) || !agenda.id) return () => {};
  const doc = root.ownerDocument;
  const trigger = doc.activeElement;
  const host = doc.createElement("div");
  host.className = "cross-agenda-viewer-host";
  host.innerHTML = `<div class="modal-backdrop cross-backdrop" data-cross-agenda-view-backdrop>
    <section class="modal-card cross-modal cross-agenda-viewer" role="dialog"
      aria-modal="true" aria-labelledby="cross-view-title" tabindex="-1">
      <header class="cross-detail-heading">
        <div><span class="eyebrow">CD Doca 01 · ${escapeHtml(formatDate(agenda.date))}</span>
          <h2 id="cross-view-title">Ver Cross</h2></div>
        <button class="ghost-button" type="button" data-cross-close>Fechar</button>
      </header>
      <div data-cross-supplier-list>
        <p class="muted-state">Carregando fornecedores com Cross...</p>
      </div>
      <div data-cross-supplier-detail hidden></div>
    </section>
  </div>`;
  root.appendChild(host);
  const $ = selector => host.querySelector(selector);
  const list = $('[data-cross-supplier-list]');
  const detail = $('[data-cross-supplier-detail]');
  const dialog = $('[role="dialog"]');
  let disposed = false, requestToken = 0, suppliers = [];
  let historyAppointmentId = null, historyVersions = [];
  let releaseFocus = () => {};
  const close = () => {
    if (disposed) return;
    disposed = true;
    requestToken++;
    releaseFocus();
    host.remove();
    onClose();
  };

  const showList = () => {
    requestToken++;
    detail.hidden = true;
    detail.replaceChildren();
    list.hidden = false;
    list.innerHTML = `<p class="muted-state">Fornecedores com Cross nesta agenda</p>
      ${suppliersHtml(suppliers)}`;
    const first = list.querySelector("[data-cross-supplier]");
    if (first) first.focus({ preventScroll: true });
  };

  const loadSuppliers = async () => {
    const token = ++requestToken;
    try {
      const result = await request(endpoint(agenda.id, mode));
      if (disposed || token !== requestToken) return;
      if (result.agendaId !== agenda.id || result.date !== agenda.date ||
          !Array.isArray(result.suppliers)) throw new Error("AGENDA_CROSS_INCONSISTENTE");
      // A API já limita a lista aos Cross ativos da agenda autenticada.
      // Contrato inconsistente é erro visível; não transformar em "lista vazia".
      const inconsistent = result.suppliers.some(entry =>
        !entry?.appointment?.id || !entry?.cross?.id ||
        entry.cross.appointmentId !== entry.appointment.id ||
        entry.cross.agendaId !== agenda.id || entry.cross.active !== true
      );
      if (inconsistent) throw new Error("CROSS_FORNECEDORES_INCONSISTENTES");
      suppliers = result.suppliers;
      showList();
    } catch {
      if (!disposed && token === requestToken) {
        list.innerHTML = '<p class="form-error" role="alert">Não foi possível consultar o Cross desta agenda. Tente novamente mais tarde.</p>';
      }
    }
  };

  const openSupplier = async appointmentId => {
    const selected = suppliers.find(entry => entry.appointment.id === appointmentId);
    if (!selected) return;
    const token = ++requestToken;
    list.hidden = true;
    detail.hidden = false;
    detail.innerHTML = `<button type="button" class="ghost-button cross-back-button" data-cross-back>Voltar aos fornecedores</button>
      <p class="muted-state">Carregando Cross do fornecedor...</p>`;
    try {
      const result = await request(`${endpoint(agenda.id, mode)}/appointments/${encodeURIComponent(appointmentId)}`);
      if (disposed || token !== requestToken) return;
      if (result.appointment?.id !== appointmentId ||
          result.report?.agendaId !== agenda.id ||
          result.report?.appointmentId !== appointmentId ||
          result.report?.active !== true || !Array.isArray(result.rows)) {
        throw new Error("CROSS_FORNECEDOR_INCONSISTENTE");
      }
      const current = result.report, supplier = result.appointment;
      detail.innerHTML = `
        <button class="ghost-button cross-back-button" type="button" data-cross-back>Voltar aos fornecedores</button>
        ${mode === "admin" ? `<button class="ghost-button" type="button" data-cross-history="${escapeHtml(appointmentId)}">Ver histórico de versões</button>` : ""}
        <section class="cross-panel" aria-label="Cross do fornecedor selecionado">
          <div class="cross-detail-heading">
            <div><span class="eyebrow">Protocolo ${escapeHtml(supplier.protocol)}</span>
              <h3>${escapeHtml(supplier.supplier)}</h3>
              <p class="muted-state">${escapeHtml(supplier.startTime)}–${escapeHtml(supplier.endTime)}
                · Cross de ${escapeHtml(formatDate(current.reportDate))}</p>
            </div>
          </div>
          <div class="cross-metrics">
            <span><strong>${number(current.stores)}</strong>Lojas</span>
            <span><strong>${number(current.lines)}</strong>Linhas de produtos</span>
            <span><strong>${number(current.separateQty)}</strong>Unidades a separar</span>
          </div>
          ${rowsDetailHtml(result.rows)}
        </section>`;
    } catch {
      if (!disposed && token === requestToken) detail.innerHTML = `
        <button class="ghost-button cross-back-button" type="button" data-cross-back>Voltar aos fornecedores</button>
        <p class="form-error" role="alert">Não foi possível carregar o Cross do fornecedor.</p>`;
    }
  };


  // Somente o ADM consulta versões arquivadas; o conferente vê apenas o Cross ativo.
  // Estas ações fazem GET. Nenhuma delas altera ou restaura a versão ativa.
  const openHistory = async appointmentId => {
    if (mode !== "admin" || !suppliers.some(entry => entry.appointment.id === appointmentId)) return;
    const token = ++requestToken;
    historyAppointmentId = appointmentId;
    historyVersions = [];
    detail.innerHTML = `<button class="ghost-button cross-back-button" type="button" data-cross-back>Voltar aos fornecedores</button>
      <p class="muted-state">Consultando versões do Cross...</p>`;
    try {
      const result = await request(`${endpoint(agenda.id, mode)}/appointments/${encodeURIComponent(appointmentId)}/history`);
      if (disposed || token !== requestToken) return;
      if (result.appointment?.id !== appointmentId || !Array.isArray(result.versions) ||
          result.versions.some(version => version.agendaId !== agenda.id ||
            version.appointmentId !== appointmentId || typeof version.id !== "string" ||
            !Number.isSafeInteger(version.version) || version.version < 1 ||
            typeof version.active !== "boolean")) {
        throw new Error("CROSS_HISTORICO_INCONSISTENTE");
      }
      historyVersions = result.versions;
      detail.innerHTML = `<button class="ghost-button cross-back-button" type="button" data-cross-back>Voltar aos fornecedores</button>
        <section class="cross-panel" aria-label="Histórico de versões do Cross">
          <h3>Versões do Cross · ${escapeHtml(result.appointment.supplier)}</h3>
          <p class="muted-state">Consulta somente leitura. A versão ativa não será alterada.</p>
          <div class="cross-supplier-list">
            ${historyVersions.map(version => `<button class="cross-supplier-choice" type="button"
                data-cross-version="${version.version}" data-cross-report="${escapeHtml(version.id)}">
                <span class="cross-supplier-primary"><strong>Versão ${number(version.version)}
                  ${version.active ? "(atual)" : "(anterior)"}</strong>
                  <small>${escapeHtml(version.fileName || "Relatório Cross")}</small></span>
                <span aria-hidden="true">›</span>
              </button>`).join("")}
          </div>
        </section>`;
    } catch {
      if (!disposed && token === requestToken) {
        detail.innerHTML = `<button class="ghost-button cross-back-button" type="button" data-cross-back>Voltar aos fornecedores</button>
          <p class="form-error" role="alert">Não foi possível consultar o histórico do Cross.</p>`;
      }
    }
  };

  const openHistoricalVersion = async reportId => {
    if (mode !== "admin" || !historyAppointmentId) return;
    const selected = historyVersions.find(version => version.id === reportId);
    if (!selected) return;
    const appointmentId = historyAppointmentId;
    const token = ++requestToken;
    detail.innerHTML = `<button class="ghost-button" type="button" data-cross-history-back>Voltar às versões</button>
      <p class="muted-state">Carregando versão histórica...</p>`;
    try {
      const result = await request(`${endpoint(agenda.id, mode)}/appointments/${encodeURIComponent(appointmentId)}/history/${encodeURIComponent(reportId)}`);
      if (disposed || token !== requestToken) return;
      if (result.appointment?.id !== appointmentId || result.report?.id !== reportId ||
          result.report?.agendaId !== agenda.id || result.report?.appointmentId !== appointmentId ||
          result.report?.version !== selected.version || result.report?.active !== selected.active ||
          !Array.isArray(result.rows)) {
        throw new Error("CROSS_VERSAO_INCONSISTENTE");
      }
      detail.innerHTML = `<button class="ghost-button" type="button" data-cross-history-back>Voltar às versões</button>
        <section class="cross-panel" aria-label="Versão arquivada do Cross">
          <span class="eyebrow">Protocolo ${escapeHtml(result.appointment.protocol)}</span>
          <h3>${escapeHtml(result.appointment.supplier)} · Versão ${number(selected.version)}</h3>
          <p class="muted-state">${selected.active ? "Versão atual" : "Versão anterior"} · somente leitura ·
            ${escapeHtml(formatDate(result.report.reportDate))}</p>
          <div class="cross-metrics">
            <span><strong>${number(result.report.stores)}</strong>Lojas</span>
            <span><strong>${number(result.report.lines)}</strong>Linhas de produtos</span>
            <span><strong>${number(result.report.separateQty)}</strong>Unidades a separar</span>
          </div>
          ${rowsDetailHtml(result.rows)}
        </section>`;
    } catch {
      if (!disposed && token === requestToken) {
        detail.innerHTML = `<button class="ghost-button" type="button" data-cross-history-back>Voltar às versões</button>
          <p class="form-error" role="alert">Não foi possível consultar esta versão do Cross.</p>`;
      }
    }
  };

  const onClick = event => {
    if (event.target.closest?.("[data-cross-close]") ||
        event.target === $('[data-cross-agenda-view-backdrop]')) {
      close(); return;
    }
    if (event.target.closest?.("[data-cross-back]")) {
      showList(); return;
    }
    if (event.target.closest?.("[data-cross-history-back]")) {
      void openHistory(historyAppointmentId); return;
    }
    const historyButton = event.target.closest?.("[data-cross-history]");
    if (historyButton && mode === "admin") {
      void openHistory(historyButton.dataset.crossHistory); return;
    }
    const versionButton = event.target.closest?.("[data-cross-version]");
    if (versionButton && mode === "admin") {
      void openHistoricalVersion(versionButton.dataset.crossReport); return;
    }
    const button = event.target.closest?.("[data-cross-supplier]");
    if (button && list.contains(button)) void openSupplier(button.dataset.crossSupplier);
  };
  host.addEventListener("click", onClick);
  releaseFocus = activateModal(dialog, {
    initialFocus: () => $('[data-cross-close]'), trigger, onEscape: close
  });
  void loadSuppliers();
  return close;
}
