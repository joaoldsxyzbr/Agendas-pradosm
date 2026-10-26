// Interpretador isolado do relatório Scm405. Não altera a importação de agendas.
export function parseCrossQuantity(value) {
  const text = String(value ?? "").trim();
  if (/^\d{1,3}(?:\.\d{3})*,\d{3}$/.test(text)) {
    const [integer, decimal] = text.split(",");
    if (decimal !== "000") return null;
    return Number(integer.replaceAll(".", ""));
  }
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

const dateIso = value => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  return date.getUTCFullYear() === +year && date.getUTCMonth() === +month - 1 &&
    date.getUTCDate() === +day ? `${year}-${month}-${day}` : null;
};

const totals = rows => ({
  lines: rows.length,
  dispatchQty: rows.reduce((sum, r) => sum + r.dispatchQty, 0),
  separateQty: rows.reduce((sum, r) => sum + r.separateQty, 0)
});

export function parseCrossReport(text) {
  const errors = [];
  if (typeof text !== "string" || !/Scm\s*405/i.test(text) ||
      !/EMPRESA\s+DO\s+PEDIDO/i.test(text)) {
    return { errors: ["FORMATO_CROSS_NAO_RECONHECIDO"], rows: [] };
  }
  const lines = text.replace(/\r/g, "").split("\n");
  const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const reportDate = dateMatch ? dateIso(dateMatch[0]) : null;
  if (!reportDate) errors.push("DATA_INVALIDA");
  const rows = [], companyTotals = [];
  let store = null, department = "", declared = null, reportedTotal = null;
  const closeStore = () => {
    if (!store) return;
    if (!declared) errors.push("TOTAL_LOJA_AUSENTE:" + store.number);
    else {
      const count = totals(rows.filter(row => row.storeNumber === store.number));
      if (count.lines !== declared.lines || count.dispatchQty !== declared.dispatchQty ||
          count.separateQty !== declared.separateQty) {
        errors.push("TOTAL_LOJA_DIVERGENTE:" + store.number);
      }
    }
  };
  for (const raw of lines) {
    // Aceita colunas por espaços, tabulações e tabelas Markdown do extrator WASM.
    const line = raw.replace(/\|/g, "  ").replace(/\t/g, "  ").trim();
    if (!line || /^[-: ]+$/.test(line)) continue;
    const company = /^EMPRESA\s+DO\s+PEDIDO\s*:\s*(\d{1,3})\s*-\s*(.+)$/i.exec(line);
    if (company) {
      closeStore();
      store = { number: company[1].padStart(2, "0"), name: company[2].trim() };
      if (companyTotals.includes(store.number)) errors.push("LOJA_DUPLICADA:" + store.number);
      companyTotals.push(store.number);
      department = "";
      declared = null;
      continue;
    }
    const dept = /^DEPARTAMENTO\s*:\s*\d+\s*-\s*(.+)$/i.exec(line);
    if (dept) { department = dept[1].trim(); continue; }
    const storeTotal = /^TOTAL\s+DA\s+EMPRESA\s+DO\s+PEDIDO\s*\((\d+)\)\s+([\d.,]+)\s+([\d.,]+)/i.exec(line);
    if (storeTotal) {
      if (!store || declared) { errors.push("TOTAL_LOJA_INESPERADO"); continue; }
      declared = { lines: Number(storeTotal[1]), dispatchQty: parseCrossQuantity(storeTotal[2]),
        separateQty: parseCrossQuantity(storeTotal[3]) };
      continue;
    }
    const grand = /^TOTAL\s+GERAL\s*\((\d+)\)\s+([\d.,]+)\s+([\d.,]+)/i.exec(line);
    if (grand) {
      if (reportedTotal) errors.push("TOTAL_GERAL_DUPLICADO");
      reportedTotal = { lines: Number(grand[1]), dispatchQty: parseCrossQuantity(grand[2]),
        separateQty: parseCrossQuantity(grand[3]) };
      continue;
    }
    const item = /^(\d{3,8})\s+(.+?)\s+(\d{12,14})\s+(\d{3,15})\s+(\d{1,14})\s+(\d{1,4})\s+([\d.,]+)\s+([\d.,]+)$/.exec(line);
    if (item) {
      if (!store || !department || declared) {
        errors.push("PRODUTO_FORA_DA_LOJA"); continue;
      }
      const dispatchQty = parseCrossQuantity(item[7]);
      const separateQty = parseCrossQuantity(item[8]);
      const packageSize = Number(item[6]);
      if (dispatchQty === null || separateQty === null || dispatchQty < 0 ||
          separateQty < 0 || !packageSize || dispatchQty * packageSize !== separateQty) {
        errors.push("QUANTIDADE_INCONSISTENTE:" + store.number + ":" + item[1]);
        continue;
      }
      rows.push({ storeNumber: store.number, storeName: store.name, department,
        productCode: item[1], description: item[2].trim(), gtin: item[3],
        orderCode: item[4], dispatchCode: item[5], packageSize, dispatchQty, separateQty });
      continue;
    }
    // Uma linha com aparência de produto nunca pode ser descartada silenciosamente.
    if (/^\d{3,8}\s+\S/.test(line) && /\d{10,14}/.test(line)) {
      errors.push("PRODUTO_NAO_INTERPRETADO");
    }
  }
  closeStore();
  const summary = totals(rows);
  const storeCount = new Set(rows.map(row => row.storeNumber)).size;
  if (!reportedTotal) errors.push("TOTAL_GERAL_AUSENTE");
  else if (summary.lines !== reportedTotal.lines ||
           summary.dispatchQty !== reportedTotal.dispatchQty ||
           summary.separateQty !== reportedTotal.separateQty) errors.push("TOTAL_GERAL_DIVERGENTE");
  if (!rows.length) errors.push("SEM_PRODUTOS");
  if (rows.length > 400) errors.push("LIMITE_DE_ITENS_EXCEDIDO");
  return { reportDate, reportCode: "Scm405", storeCount, ...summary, rows,
    errors: [...new Set(errors)] };
}
