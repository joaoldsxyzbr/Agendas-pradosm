import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";
import { rowsDetailHtml } from "./cross.js";

const formatDate = value => String(value ?? "").split("-").reverse().join("/");
const number = value => Number(value ?? 0).toLocaleString("pt-BR");
const dock01 = agenda => agenda?.storeCode?.trim().toUpperCase() === "CD DOCA 01";
const endpoint = agendaId =>
  `/api/store/cross/agendas/${encodeURIComponent(agendaId)}`;

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
 * P3: visualização de Cross limitada à agenda que o conferente abriu.
 * Nenhum relatório independente/legado aparece nesta tela.
 */
export function openCrossAgendaViewer(root, {
  agenda, request = apiFetch, onClose = () => {}
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
      const result = await request(endpoint(agenda.id));
      if (disposed || token !== requestToken) return;
      if (result.agendaId !== agenda.id || result.date !== agenda.date ||
          !Array.isArray(result.suppliers)) throw new Error("AGENDA_CROSS_INCONSISTENTE");
      suppliers = result.suppliers.filter(entry => entry?.appointment?.id &&
        entry?.cross?.appointmentId === entry.appointment.id &&
        entry?.cross?.agendaId === agenda.id && entry?.cross?.active === true);
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
      const result = await request(`${endpoint(agenda.id)}/appointments/${encodeURIComponent(appointmentId)}`);
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

  const onClick = event => {
    if (event.target.closest?.("[data-cross-close]") ||
        event.target === $('[data-cross-agenda-view-backdrop]')) {
      close(); return;
    }
    if (event.target.closest?.("[data-cross-back]")) {
      showList(); return;
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
