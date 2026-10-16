// Agregações em JavaScript puro. Sem dependências de UI ou D1.
export function sumReportRows(rows = []) {
  return rows.reduce((sum, row) => {
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "recusado", "semAgenda"]) {
      sum[key] += Number(row[key] || 0);
    }
    sum.agendas += 1;
    if (row.dayStatus === "aberto") sum.abertas += 1;
    return sum;
  }, { total: 0, recebido: 0, naoChegou: 0, aguardando: 0, recusado: 0, semAgenda: 0, agendas: 0, abertas: 0 });
}

export function reportRate(row) {
  return row.total > 0 ? row.recebido / row.total * 100 : 0;
}

export function groupDailyReport(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    let day = grouped.get(row.date);
    if (!day) {
      day = { date: row.date, total: 0, recebido: 0, naoChegou: 0, aguardando: 0, recusado: 0 };
      grouped.set(row.date, day);
    }
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "recusado"]) {
      day[key] += Number(row[key] || 0);
    }
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function groupStoreReport(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    let store = grouped.get(row.storeCode);
    if (!store) {
      store = { code: row.storeCode, name: row.storeName, total: 0, recebido: 0, naoChegou: 0, aguardando: 0, recusado: 0, semAgenda: 0 };
      grouped.set(row.storeCode, store);
    }
    for (const key of ["total", "recebido", "naoChegou", "aguardando", "recusado", "semAgenda"]) {
      store[key] += Number(row[key] || 0);
    }
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}

