import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";
import { extractPdfText } from "./import/extractPdfText.js";
import { parseCrossReport } from "./import/parseCrossReport.js";

const esc = escapeHtml;
const brazilToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
};
const formatDate = date => date?.split("-").reverse().join("/") || "—";
const formatNumber = value => Number(value || 0).toLocaleString("pt-BR");
const errorMessage = error => {
  const code = error?.code || error?.message || error?.error || error;
  if (String(code).includes("CROSS_DUPLICADO")) return "Este relatório já foi importado. Consulte o histórico.";
  return "Não foi possível concluir a operação. Confira os dados e tente novamente.";
};

function rowsByStore(rows) {
  const stores = new Map();
  for (const row of rows) {
    const group = stores.get(row.storeNumber) || { number: row.storeNumber,
      name: row.storeName, orders: new Set(), total: 0, rows: [] };
    group.rows.push(row);
    group.total += row.separateQty;
    group.orders.add(row.orderCode);
    stores.set(row.storeNumber, group);
  }
  return [...stores.values()];
}

export function previewHtml(report) {
  if (!report) return "";
  const warning = report.errors?.length
    ? `<div class="form-error" role="alert">Importação bloqueada: ${report.errors.map(esc).join(", ")}</div>`
    : '<p class="success-message">Totais conferidos. Verifique os produtos antes de confirmar.</p>';
  return `<section class="cross-panel" aria-label="Prévia do relatório">
    <h2>Prévia · ${esc(formatDate(report.reportDate))}</h2>
    <div class="cross-metrics">
      <span><strong>${formatNumber(report.storeCount)}</strong>Lojas</span>
      <span><strong>${formatNumber(report.lines)}</strong>Linhas de produtos</span>
      <span><strong>${formatNumber(report.separateQty)}</strong>Unidades a separar</span>
    </div>
    ${warning}
    ${rowsDetailHtml(report.rows)}
  </section>`;
}

export function rowsDetailHtml(rows) {
  if (!rows?.length) return '<p class="muted-state">Nenhum produto disponível.</p>';
  return `<div class="cross-store-list">${rowsByStore(rows).map(group => `
    <details class="cross-store">
      <summary><span><strong>Loja ${esc(group.number)}</strong><small>${esc(group.name)}</small></span>
        <span><strong>${formatNumber(group.total)} un.</strong><small>Pedido(s) ${[...group.orders].map(esc).join(", ")}</small></span></summary>
      <div class="cross-table-wrap"><table>
        <thead><tr><th>Cód.</th><th>Produto</th><th>Pedido</th><th>Embalagem</th><th>Qtd. expedição</th><th>A separar</th></tr></thead>
        <tbody>${group.rows.map(row => `<tr>
          <td>${esc(row.productCode)}</td><td><strong>${esc(row.description)}</strong>
          <small>GTIN ${esc(row.gtin)} · ${esc(row.department)}</small></td>
          <td>${esc(row.orderCode)}</td><td>${formatNumber(row.packageSize)}</td>
          <td>${formatNumber(row.dispatchQty)}</td>
          <td><strong>${formatNumber(row.separateQty)}</strong></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </details>`).join("")}</div>`;
}

function reportListHtml(reports) {
  if (!reports.length) return '<p class="muted-state">Nenhum relatório Cross encontrado para a data selecionada.</p>';
  return reports.map(report => `<div class="cross-report-row">
    <div><strong>${esc(report.reference || report.fileName)}</strong>
      <small>${esc(formatDate(report.reportDate))} · ${formatNumber(report.stores)} lojas · ${formatNumber(report.separateQty)} un.</small></div>
    <button class="ghost-button" type="button" data-cross-open="${esc(report.id)}">Ver detalhes</button>
  </div>`).join("");
}

function crossExplorer(container, { request, endpoint, date }) {
  let disposed = false, seq = 0;
  container.innerHTML = `<section class="cross-explorer">
    <div class="cross-explorer-header"><h2>Relatórios importados</h2>
      <label>Data <input aria-label="Data dos relatórios Cross" type="date" data-cross-filter value="${esc(date)}"></label>
    </div>
    <div data-cross-list><p class="muted-state">Buscando relatórios...</p></div>
    <div data-cross-detail></div>
  </section>`;
  const list = container.querySelector("[data-cross-list]");
  const detail = container.querySelector("[data-cross-detail]");
  const refresh = async () => {
    const id = ++seq;
    detail.replaceChildren();
    list.innerHTML = '<p class="muted-state">Buscando relatórios...</p>';
    try {
      const result = await request(`${endpoint}?date=${encodeURIComponent(container.querySelector("[data-cross-filter]").value)}`);
      if (!disposed && seq === id) list.innerHTML = reportListHtml(result.reports || []);
    } catch {
      if (!disposed && seq === id) list.innerHTML = '<p class="form-error">Falha ao consultar o histórico de Cross.</p>';
    }
  };
  const onClick = async event => {
    const button = event.target.closest?.("[data-cross-open]");
    if (!button || !container.contains(button)) return;
    const id = ++seq;
    detail.innerHTML = '<p class="muted-state">Carregando produtos...</p>';
    try {
      const result = await request(`${endpoint}/${encodeURIComponent(button.dataset.crossOpen)}`);
      if (!disposed && seq === id) {
        detail.innerHTML = `<section class="cross-panel">
          <div class="cross-detail-heading"><h2>${esc(result.report.reference || result.report.fileName)}</h2>
          <button class="ghost-button" type="button" data-cross-hide>Fechar detalhes</button></div>
          <p class="muted-state">${esc(formatDate(result.report.reportDate))} · ${formatNumber(result.report.lines)} linhas ·
            ${formatNumber(result.report.separateQty)} unidades a separar</p>
          ${rowsDetailHtml(result.rows)}
        </section>`;
      }
    } catch {
      if (!disposed && seq === id) detail.innerHTML = '<p class="form-error">Não foi possível carregar o relatório.</p>';
    }
  };
  const onHide = event => {
    if (event.target.closest?.("[data-cross-hide]")) detail.replaceChildren();
  };
  const onDate = event => { if (event.target.matches("[data-cross-filter]")) void refresh(); };
  container.addEventListener("click", onClick);
  container.addEventListener("click", onHide);
  container.addEventListener("change", onDate);
  void refresh();
  return {
    refresh,
    destroy() { disposed = true; seq++; container.removeEventListener("click", onClick);
      container.removeEventListener("click", onHide);
      container.removeEventListener("change", onDate); }
  };
}

export function renderCrossAdmin(root, { request = apiFetch } = {}) {
  let disposed = false, selected = null, parsed = null, busy = false, token = 0;
  root.innerHTML = `<section class="admin-page cross-page">
    <header class="page-heading"><div><span class="eyebrow">CD · Cross-Docking</span>
      <h1>Cross-Docking</h1><p>Importe relatórios Scm405. A Doca 1 poderá consultar os produtos e quantidades por loja.</p></div></header>
    <section class="cross-panel">
      <h2>Importar Cross</h2>
      <div class="cross-form">
        <label>Relatório PDF <input type="file" accept=".pdf,application/pdf" data-cross-file></label>
        <label>Data operacional <input type="date" data-cross-date value="${brazilToday()}"></label>
        <label>Identificação da carga (opcional) <input type="text" maxlength="100"
          placeholder="Ex.: Fornecedor / caminhão" data-cross-reference></label>
      </div>
      <div role="status" aria-live="polite" data-cross-notice></div>
      <div data-cross-preview></div>
      <div class="cross-actions"><button type="button" class="primary-button" data-cross-import disabled>
        Confirmar importação</button></div>
    </section>
    <div data-cross-explorer></div>
  </section>`;
  const notice = root.querySelector("[data-cross-notice]");
  const preview = root.querySelector("[data-cross-preview]");
  const save = root.querySelector("[data-cross-import]");
  const explorer = crossExplorer(root.querySelector("[data-cross-explorer]"),
    { request, endpoint: "/api/admin/cross", date: brazilToday() });
  const show = (message, success = false) => {
    notice.className = success ? "success-message" : "form-error";
    notice.textContent = message;
    save.disabled = busy || !selected || !parsed || parsed.errors.length > 0;
    save.textContent = busy ? "Importando..." : "Confirmar importação";
    preview.innerHTML = previewHtml(parsed);
  };
  const changeFile = async file => {
    const current = ++token;
    selected = null; parsed = null;
    if (!file) { show(""); return; }
    if (file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(file.name)) {
      show("Selecione um PDF válido de até 10 MB."); return;
    }
    busy = true; show("Lendo o PDF...");
    try {
      const result = parseCrossReport(await extractPdfText(file));
      if (disposed || current !== token) return;
      selected = file;
      parsed = result;
      if (result.reportDate) root.querySelector("[data-cross-date]").value = result.reportDate;
      show(result.errors.length ? "O relatório não passou pela validação." : "Relatório pronto para conferência.", !result.errors.length);
    } catch {
      if (!disposed && current === token) show("Não foi possível interpretar este PDF.");
    } finally {
      if (!disposed && current === token) { busy = false; show(notice.textContent, !parsed?.errors.length && !!parsed); }
    }
  };
  const onChange = event => {
    if (event.target.matches("[data-cross-file]")) void changeFile(event.target.files?.[0]);
  };
  const onSubmit = async event => {
    if (!event.target.matches("[data-cross-import]") || busy || !selected || parsed?.errors?.length) return;
    const operationalDate = root.querySelector("[data-cross-date]").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(operationalDate)) { show("Informe uma data operacional válida."); return; }
    busy = true; show("Salvando relatório...");
    try {
      const result = await request("/api/admin/cross", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationalDate, reportDate: parsed.reportDate,
          reportCode: parsed.reportCode, reference: root.querySelector("[data-cross-reference]").value.trim(),
          fileName: selected.name, declared: { lines: parsed.lines, dispatchQty: parsed.dispatchQty,
            separateQty: parsed.separateQty }, rows: parsed.rows })
      });
      if (disposed) return;
      selected = null; parsed = null;
      root.querySelector("[data-cross-file]").value = "";
      root.querySelector("[data-cross-explorer] [data-cross-filter]").value = operationalDate;
      await explorer.refresh();
      show(`Cross importado: ${result.stores} lojas e ${formatNumber(result.separateQty)} unidades.`, true);
    } catch (error) {
      if (!disposed) show(errorMessage(error));
    } finally { if (!disposed) { busy = false; save.disabled = !selected || !parsed || parsed.errors.length > 0; save.textContent = "Confirmar importação"; } }
  };
  root.addEventListener("change", onChange);
  root.addEventListener("click", onSubmit);
  return () => { disposed = true; token++; explorer.destroy(); root.removeEventListener("change", onChange);
    root.removeEventListener("click", onSubmit); };
}

export function openCrossViewer(root, { request = apiFetch, date = brazilToday(), onClose = () => {} } = {}) {
  const doc = root.ownerDocument, host = doc.createElement("div");
  root.append(host);
  host.innerHTML = `<div class="modal-backdrop cross-backdrop" data-cross-backdrop>
    <section class="modal-card cross-modal" role="dialog" aria-modal="true" aria-labelledby="cross-dialog-title" tabindex="-1">
      <div class="cross-detail-heading"><div><span class="eyebrow">CD · Doca 01</span>
        <h2 id="cross-dialog-title">Ver Cross</h2></div>
        <button type="button" class="ghost-button" data-cross-close>Fechar</button></div>
      <div data-cross-explorer></div>
    </section>
  </div>`;
  const explorer = crossExplorer(host.querySelector("[data-cross-explorer]"),
    { request, endpoint: "/api/store/cross", date });
  const dialog = host.querySelector("[role=dialog]");
  let disposed = false, releaseFocus = () => {};
  const close = () => { if (disposed) return; disposed = true; explorer.destroy();
    releaseFocus(); host.remove(); onClose(); };
  releaseFocus = activateModal(dialog, { onEscape: close, trigger: doc.activeElement });
  const onClick = event => {
    if (event.target.closest?.("[data-cross-close]") ||
        event.target === host.querySelector("[data-cross-backdrop]")) close();
  };
  host.addEventListener("click", onClick);
  return close;
}
