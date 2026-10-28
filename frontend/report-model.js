// Agregações em JavaScript puro. Sem dependências de UI ou D1.
export function sumReportRows(rows = []) {
  return rows.reduce((sum, row) => {
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "naoCompareceu", "recusado", "semAgenda"]) {
      sum[key] += Number(row[key] || 0);
    }
    sum.agendas += 1;
    if (row.dayStatus === "aberto") sum.abertas += 1;
    return sum;
  }, { total: 0, recebido: 0, naoChegou: 0, aguardando: 0, naoCompareceu: 0, recusado: 0, semAgenda: 0, agendas: 0, abertas: 0 });
}

export function reportRate(row) {
  return row.total > 0 ? row.recebido / row.total * 100 : 0;
}

export function groupDailyReport(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    let day = grouped.get(row.date);
    if (!day) {
      day = { date: row.date, total: 0, recebido: 0, naoChegou: 0, aguardando: 0, naoCompareceu: 0, recusado: 0 };
      grouped.set(row.date, day);
    }
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "naoCompareceu", "recusado"]) {
      day[key] += Number(row[key] || 0);
    }
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function groupWeekdayReport(dailyRows = []) {
  const grouped = new Map();
  for (const row of dailyRows) {
    const weekday = new Date(row.date + "T00:00:00Z").getUTCDay();
    let day = grouped.get(weekday);
    if (!day) {
      day = { weekday, total: 0, recebido: 0, naoChegou: 0, days: 0 };
      grouped.set(weekday, day);
    }
    day.total += Number(row.total || 0);
    day.recebido += Number(row.recebido || 0);
    day.naoChegou += Number(row.naoChegou || 0);
    day.days += 1;
  }
  return [...grouped.values()].sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday));
}

export function groupStoreReport(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    let store = grouped.get(row.storeCode);
    if (!store) {
      store = { code: row.storeCode, name: row.storeName, total: 0, recebido: 0, naoChegou: 0, aguardando: 0, naoCompareceu: 0, recusado: 0, semAgenda: 0 };
      grouped.set(row.storeCode, store);
    }
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "naoCompareceu", "recusado", "semAgenda"]) {
      store[key] += Number(row[key] || 0);
    }
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}