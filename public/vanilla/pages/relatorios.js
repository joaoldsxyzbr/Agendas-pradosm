import { sumReportRows, reportRate, groupDailyReport, groupStoreReport } from "../reports.js?v=relatorios-20261016";

// Tela reports — JavaScript puro.
export async function showReports(ctx) {
  const { state, root, $, loadStores, api, dt, fmt, esc, heading, stats, panel, table, storeOpts, badge, tell, navigate, isCurrent, dateToday } = ctx;

    await loadStores();
    if (!isCurrent()) return;
    if (!state.reportEnd) state.reportEnd = dateToday();
    if (!state.reportStart) {
      const start = new Date(state.reportEnd + "T00:00:00Z");
      start.setUTCDate(start.getUTCDate() - 29);
      state.reportStart = start.toISOString().slice(0, 10);
    }
    if (state.reportCompare === undefined) state.reportCompare = true;
    const range = (start, end) => {
      const query = new URLSearchParams({ start, end });
      if (state.reportStore) query.set("storeCode", state.reportStore);
      return query.toString();
    };
    const days = Math.round((Date.parse(state.reportEnd + "T00:00:00Z") - Date.parse(state.reportStart + "T00:00:00Z")) / 86400000) + 1;
    if (days < 1 || days > 93) throw Error("Selecione um período válido de até 93 dias.");
    const beforeEnd = new Date(state.reportStart + "T00:00:00Z");
    beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);
    const beforeStart = new Date(beforeEnd);
    beforeStart.setUTCDate(beforeStart.getUTCDate() - days + 1);
    const [report, earlier, occurrences] = await Promise.all([
      api("/api/admin/reports?" + range(state.reportStart, state.reportEnd)),
      state.reportCompare
        ? api("/api/admin/reports?" + range(beforeStart.toISOString().slice(0, 10), beforeEnd.toISOString().slice(0, 10)))
        : Promise.resolve(null),
      api("/api/admin/reports/occurrences?" + range(state.reportStart, state.reportEnd) + "&limit=50&offset=" + (state.reportOffset || 0)),
    ]);
    if (!isCurrent()) return;
    const total = sumReportRows(report.rows);
    const prior = sumReportRows(earlier?.rows || []);
    const daily = groupDailyReport(report.rows);
    const stores = groupStoreReport(report.rows);
    const percent = value => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
    const rate = row => percent(reportRate(row));
    const delta = reportRate(total) - reportRate(prior);
    const deltaText = (delta >= 0 ? "+" : "") + delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " p.p.";
    const largestDay = Math.max(1, ...daily.map(row => row.total));
    const chart = daily.length
      ? `<div class="report-chart-scroll"><div class="report-chart-track">
          ${daily.map((day, index) => {
            const barHeight = day.total > 0 ? Math.max(3, day.total / largestDay * 100) : 0;
            const segment = count => day.total > 0 ? count / day.total * 100 : 0;
            const description = `${dt(day.date)}: ${fmt(day.total)} agendamentos, ${fmt(day.recebido)} recebidos, ${fmt(day.naoChegou)} não recebidos, ${fmt(day.aguardando)} aguardando e ${fmt(day.recusado)} recusados`;
            const showLabel = index % Math.max(1, Math.ceil(daily.length / 12)) === 0;
            return `<div class="report-chart-day" role="img" aria-label="${esc(description)}" title="${esc(description)}">
              <div class="report-chart-column">
                <div class="report-chart-bar" style="height:${barHeight.toFixed(2)}%">
                  <span class="report-chart-segment is-received" style="height:${segment(day.recebido).toFixed(2)}%"></span>
                  <span class="report-chart-segment is-missed" style="height:${segment(day.naoChegou).toFixed(2)}%"></span>
                  <span class="report-chart-segment is-pending" style="height:${segment(day.aguardando).toFixed(2)}%"></span>
                  <span class="report-chart-segment is-declined" style="height:${segment(day.recusado).toFixed(2)}%"></span>
                </div>
              </div>
              <small>${showLabel ? esc(day.date.slice(8) + "/" + day.date.slice(5, 7)) : "&nbsp;"}</small>
            </div>`;
          }).join("")}
        </div></div>`
      : `<p class="empty">Sem dados no período selecionado.</p>`;
    const legend = `<div class="report-chart-legend" aria-label="Legenda dos status">
      <span><i class="is-received" aria-hidden="true"></i>Recebidos</span>
      <span><i class="is-missed" aria-hidden="true"></i>Não recebidos</span>
      <span><i class="is-pending" aria-hidden="true"></i>Aguardando</span>
      <span><i class="is-declined" aria-hidden="true"></i>Recusados</span>
    </div>`;
    const storeBars = stores.length ? `<div class="report-store-list">${stores.map(store =>
      `<div class="report-store-line">
        <div class="report-store-caption"><span class="cell-primary">${esc(store.code)} · ${esc(store.name)}</span><strong>${rate(store)}</strong></div>
        <div class="report-meter" role="img" aria-label="${esc(`${store.code}: ${rate(store)} recebidos, ${fmt(store.recebido)} de ${fmt(store.total)} agendamentos`)}">
          <span style="width:${reportRate(store).toFixed(2)}%"></span>
        </div>
        <small>${fmt(store.recebido)} de ${fmt(store.total)} recebidos</small>
      </div>`).join("")}</div>` : `<p class="empty">Nenhuma loja no período.</p>`;
    const biggestSupplier = Math.max(1, ...report.suppliers.map(row => Number(row.naoChegou) || 0));
    const supplierBars = report.suppliers.length
      ? `<div class="report-supplier-list">${report.suppliers.map((supplier, index) =>
        `<div class="report-supplier-line">
          <div class="report-supplier-caption"><span><small>${index + 1}.</small> ${esc(supplier.supplier)}</span><strong>${fmt(supplier.naoChegou)}</strong></div>
          <div class="report-meter report-meter-warning" aria-hidden="true"><span style="width:${(Number(supplier.naoChegou) / biggestSupplier * 100).toFixed(2)}%"></span></div>
        </div>`).join("")}</div>` : `<p class="empty">Sem não recebimentos no período.</p>`;
    const comparison = earlier
      ? `<div class="report-insight"><strong>Comparação com os ${days} dias anteriores:</strong> ${fmt(prior.total)} agendamentos · Variação da taxa de recebimento: <strong>${esc(deltaText)}</strong></div>`
      : "";
    const openNote = total.abertas > 0
      ? `<p class="report-open-note"><strong>${fmt(total.abertas)} ${total.abertas === 1 ? "agenda em aberto" : "agendas em aberto"}.</strong> Os indicadores podem mudar até o fechamento.</p>`
      : "";
    // Destruir o grafico anterior apenas no momento de substituir o DOM,
    // nao durante a consulta em segundo plano.
    state.reportChart?.destroy?.();
    state.reportChart = null;
    root.innerHTML =
      `<div class="report-page">` +
      heading("Indicadores de gestão", "Relatórios gerenciais", `${dt(state.reportStart)} a ${dt(state.reportEnd)} · ${fmt(total.agendas)} agendas`) +
      `<form class="filter-panel" id="report-form"><div class="filter-grid">
        <label class="field">De<input name="start" type="date" value="${esc(state.reportStart)}" required></label>
        <label class="field">Até<input name="end" type="date" value="${esc(state.reportEnd)}" required></label>
        <label class="field wide">Loja<select name="storeCode">${storeOpts(state.reportStore)}</select></label>
        <label class="checkbox-line"><input name="compare" type="checkbox" ${state.reportCompare ? "checked" : ""}> Comparar com período anterior</label>
        <button class="primary" type="submit">Aplicar filtros</button></div></form>` +
      stats([
        ["Agendamentos", fmt(total.total), `${fmt(total.agendas)} agendas no período`],
        ["Recebidos", fmt(total.recebido), `${rate(total)} do total`],
        ["Não recebidos", fmt(total.naoChegou), "Não chegaram"],
        ["Taxa de recebimento", rate(total), "Recebidos / agendamentos"],
        ["Aguardando", fmt(total.aguardando), "Ainda pendentes"],
        ["Recusados", fmt(total.recusado), "Entregas recusadas"],
      ]) +
      comparison + openNote +
      `<div class="report-analytics-grid">` +
        `<div class="report-evolution">${panel("Evolução diária", "Agendamentos por status em cada dia do período",
          legend + `<div class="report-chart-canvas" data-report-canvas hidden><canvas id="report-chart" role="img" aria-label="Evolução diária por status; consulte a tabela Por data para os valores."></canvas></div><div data-report-native-chart>${chart}</div>`)}</div>` +
        `<div>${panel("Comparativo por loja", "Taxa de recebimento e volumes por unidade", storeBars)}</div>` +
        `<div>${panel("Fornecedores com ocorrências", "Ranking de não recebidos", supplierBars)}</div>` +
      `</div>` +
      panel("Por loja", "Indicadores completos por unidade", table(
        ["Loja", "Total", "Recebidos", "Não recebidos", "Aguardando", "Recusados", "Sem agenda", "Taxa"],
        stores.map(store => `<tr><td class="cell-primary">${esc(store.code)} · ${esc(store.name)}</td>
          <td class="numeric">${fmt(store.total)}</td><td class="numeric">${fmt(store.recebido)}</td>
          <td class="numeric">${fmt(store.naoChegou)}</td><td class="numeric">${fmt(store.aguardando)}</td>
          <td class="numeric">${fmt(store.recusado)}</td><td class="numeric">${fmt(store.semAgenda)}</td><td class="numeric">${rate(store)}</td></tr>`)
      )) +
      panel("Por data", "Detalhamento de cada agenda", table(
        ["Data", "Loja", "Situação", "Total", "Recebidos", "Não recebidos", "Aguardando", "Recusados", "Sem agenda"],
        report.rows.map(row => `<tr><td>${dt(row.date)}</td><td class="cell-primary">${esc(row.storeCode)} · ${esc(row.storeName)}</td>
          <td>${badge(row.dayStatus)}</td><td class="numeric">${fmt(row.total)}</td>
          <td class="numeric">${fmt(row.recebido)}</td><td class="numeric">${fmt(row.naoChegou)}</td>
          <td class="numeric">${fmt(row.aguardando)}</td><td class="numeric">${fmt(row.recusado)}</td>
          <td class="numeric">${fmt(row.semAgenda)}</td></tr>`)
      )) +
      panel("Ocorrências e observações", `${fmt(occurrences.total)} registros de não recebimento`,
        table(["Data", "Loja", "Fornecedor", "Protocolo", "Motivo"],
          occurrences.rows.map(row => `<tr><td>${dt(row.date)}</td><td>${esc(row.storeCode)} · ${esc(row.storeName)}</td>
            <td class="cell-primary">${esc(row.supplier)}</td><td>${esc(row.protocol)}</td>
            <td class="detail-line">${esc(row.observation || "Motivo não registrado")}</td></tr>`)) +
        `<div class="report-pagination"><span>${fmt(occurrences.total)} ocorrência(s) · exibindo ${occurrences.total ? fmt((state.reportOffset || 0) + 1) : "0"} a ${fmt(Math.min((state.reportOffset || 0) + 50, occurrences.total))}</span>
          <div class="inline-actions"><button class="secondary" id="report-prev" ${(state.reportOffset || 0) === 0 ? "disabled" : ""}>Anterior</button>
          <button class="secondary" id="report-next" ${(state.reportOffset || 0) + 50 >= occurrences.total ? "disabled" : ""}>Próxima</button></div></div>`) +
      `</div>`;
    // Biblioteca opcional na renderização: fallback CSS preservado se os assets não estiverem disponíveis.
    if (daily.length && typeof globalThis.Chart === "function") {
      const frame = $("[data-report-canvas]");
      try {
        frame.hidden = false;
        const barColors = ["#91d8b8", "#f2aaa8", "#ebc486", "#c2a4e2"];
        const keys = ["recebido", "naoChegou", "aguardando", "recusado"];
        const names = ["Recebidos", "Não recebidos", "Aguardando", "Recusados"];
        state.reportChart = new globalThis.Chart($("#report-chart"), {
          type: "bar",
          data: {
            labels: daily.map(day => dt(day.date)),
            datasets: keys.map((key, i) => ({
              label: names[i], data: daily.map(day => day[key]),
              backgroundColor: barColors[i], borderWidth: 0, borderRadius: 2,
              maxBarThickness: 38, stack: "recebimentos"
            }))
          },
          options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: {
                footer: rows => "Total: " + fmt(rows.reduce((sum, item) => sum + item.parsed.y, 0))
              } }
            },
            scales: {
              x: { stacked: true, ticks: { color: "#bac0ca", autoSkip: true, maxRotation: 0, maxTicksLimit: 14 }, grid: { display: false } },
              y: { stacked: true, beginAtZero: true, ticks: { color: "#bac0ca", precision: 0 }, grid: { color: "#353942" } }
            }
          }
        });
        $("[data-report-native-chart]").hidden = true;
      } catch(error) {
        state.reportChart?.destroy?.();
        state.reportChart = null;
        frame.hidden = true;
        console.warn("Chart.js não disponível: gráfico HTML preservado.", error);
      }
    }
    const reportForm = $("#report-form");
    const markDirty = () => { reportForm.dataset.dirty = "true"; };
    reportForm.addEventListener("input", markDirty);
    reportForm.addEventListener("change", markDirty);
    reportForm.onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const start = form.get("start");
      const end = form.get("end");
      const span = Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000) + 1;
      if (!start || !end || !Number.isFinite(span) || span < 1 || span > 93) {
        tell("Selecione um período válido de até 93 dias.", true);
        return;
      }
      state.reportStart = start;
      state.reportEnd = end;
      state.reportStore = form.get("storeCode");
      state.reportCompare = form.has("compare");
      state.reportOffset = 0;
      navigate();
    };
    $("#report-prev").onclick = () => {
      state.reportOffset = Math.max(0, (state.reportOffset || 0) - 50);
      navigate();
    };
    $("#report-next").onclick = () => {
      state.reportOffset = (state.reportOffset || 0) + 50;
      navigate();
    };
  }