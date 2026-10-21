// Chart.js é carregado apenas quando o Relatório Gerencial é consultado.
// A visualização HTML nativa permanece disponível se o script local não carregar.
let loadPromise = null;

export function reportChartConfig(days) {
  const series = [
    ["recebido", "Recebidos", "#91d8b8"],
    ["naoChegou", "Não recebidos", "#f2aaa8"],
    ["aguardando", "Aguardando", "#ebc486"],
    ["semConferencia", "Sem conferência", "#8294aa"],
    ["recusado", "Recusados", "#c2a4e2"]
  ];
  return {
    type: "bar",
    data: {
      labels: days.map(row => row.date.slice(8, 10) + "/" + row.date.slice(5, 7)),
      datasets: series.map(([key,label,color]) => ({
        label,
        data: days.map(row => Number(row[key] || 0)),
        backgroundColor: color,
        borderRadius: 2,
        borderSkipped: false,
        maxBarThickness: 40
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { color: "#bac0ca", usePointStyle: true, boxWidth: 10 } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { stacked: true, ticks: { color: "#bac0ca", maxRotation: 0 }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: "#bac0ca", precision: 0 }, grid: { color: "#393e47" } }
      }
    }
  };
}

export function reportRateChartConfig(days) {
  return {
    type: "line",
    data: {
      labels: days.map(row => row.date.slice(8, 10) + "/" + row.date.slice(5, 7)),
      datasets: [{
        label: "Taxa de recebimento",
        data: days.map(row => row.total ? Math.round(row.recebido / row.total * 1000) / 10 : 0),
        borderColor: "#91d8b8",
        backgroundColor: "rgba(145, 216, 184, 0.14)",
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index", intersect: false,
          callbacks: {
            label: context => {
              const day = days[context.dataIndex] || {};
              return context.parsed.y + "% de " + (day.total || 0) + " agendamento(s)";
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#bac0ca", maxRotation: 0 }, grid: { display: false } },
        y: { min: 0, max: 100, beginAtZero: true, ticks: { color: "#bac0ca", callback: value => value + "%" }, grid: { color: "#393e47" } }
      }
    }
  };
}

export function loadReportChartLibrary(doc) {
  const win = doc.defaultView;
  if (typeof win?.Chart === "function") return Promise.resolve(win.Chart);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = "/vendor/chart.umd.min.js";
    script.async = true;
    script.onload = () => typeof win?.Chart === "function"
      ? resolve(win.Chart)
      : reject(new Error("Chart.js não inicializou."));
    script.onerror = () => reject(new Error("Chart.js local não disponível."));
    doc.head.appendChild(script);
  }).catch(error => {
    loadPromise = null; // permite nova tentativa ao revisitar o relatório
    throw error;
  });
  return loadPromise;
}

export function mountReportChart(root, days, isCurrent = () => true, mode = "volume") {
  const volumeNative = root.querySelector("[data-report-native-chart]");
  const rateNative = root.querySelector("[data-report-rate-native]");
  const wrapper = root.querySelector("[data-report-chart-wrap]");
  const canvas = root.querySelector("[data-report-chart-canvas]");
  if (!days.length || !volumeNative || !wrapper || !canvas) return () => {};
  const native = mode === "rate" ? rateNative : volumeNative;
  const other = mode === "rate" ? volumeNative : rateNative;
  if (native) native.hidden = false;
  if (other) other.hidden = true;
  let disposed = false;
  let chart = null;
  void loadReportChartLibrary(root.ownerDocument).then(Chart => {
    if (disposed || !isCurrent() || !canvas.isConnected) return;
    try {
      wrapper.hidden = false; // dimensão calculável antes de criar o canvas
      chart = new Chart(canvas, mode === "rate" ? reportRateChartConfig(days) : reportChartConfig(days));
      if (disposed || !isCurrent()) {
        chart.destroy();
        chart = null;
        wrapper.hidden = true;
        return;
      }
      if (native) native.hidden = true;
      if (other) other.hidden = true;
    } catch (error) {
      chart?.destroy();
      chart = null;
      wrapper.hidden = true;
      if (native) native.hidden = false;
      if (other) other.hidden = true;
      console.warn("Chart.js indisponível; gráfico HTML mantido.", error);
    }
  }).catch(error => {
    if (!disposed && isCurrent()) console.warn("Gráfico HTML mantido:", error.message);
  });
  return () => {
    disposed = true;
    chart?.destroy();
    chart = null;
  };
}