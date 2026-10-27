// Apresentação compartilhada do PDF Scm405 na agenda.
// P4: não contém importação, consulta ou navegação independente.
import { escapeHtml } from "./shell.js";

const esc = escapeHtml;
const formatDate = date => date?.split("-").reverse().join("/") || "—";
const formatNumber = value => Number(value || 0).toLocaleString("pt-BR");

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

