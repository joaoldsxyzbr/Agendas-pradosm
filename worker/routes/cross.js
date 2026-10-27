import { Hono } from "hono";
import { z } from "zod";

const CrossItem = z.object({
  storeNumber: z.string().regex(/^\d{2,3}$/),
  storeName: z.string().trim().min(2).max(160),
  department: z.string().trim().min(2).max(120),
  productCode: z.string().regex(/^\d{3,8}$/),
  description: z.string().trim().min(2).max(240),
  gtin: z.string().regex(/^\d{12,14}$/),
  orderCode: z.string().regex(/^\d{3,15}$/),
  dispatchCode: z.string().regex(/^\d{1,14}$/),
  packageSize: z.number().int().min(1).max(10000),
  dispatchQty: z.number().int().min(0).max(1000000),
  separateQty: z.number().int().min(0).max(1000000)
}).strict();

export const CrossInput = z.object({
  operationalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportCode: z.literal("Scm405"),
  reference: z.string().trim().max(100).optional(),
  fileName: z.string().trim().min(1).max(180),
  declared: z.object({
    lines: z.number().int().min(1).max(400),
    dispatchQty: z.number().int().min(0),
    separateQty: z.number().int().min(0)
  }).strict(),
  rows: z.array(CrossItem).min(1).max(400)
}).strict();

export function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day;
}

export function crossInputTotals(input) {
  if (!validIsoDate(input.operationalDate) || !validIsoDate(input.reportDate)) return null;
  if (!input.rows.every(row => row.packageSize * row.dispatchQty === row.separateQty)) return null;
  const names = new Map();
  for (const row of input.rows) {
    if (names.has(row.storeNumber) && names.get(row.storeNumber) !== row.storeName) return null;
    names.set(row.storeNumber, row.storeName);
  }
  const totals = {
    lines: input.rows.length,
    dispatchQty: input.rows.reduce((sum, row) => sum + row.dispatchQty, 0),
    separateQty: input.rows.reduce((sum, row) => sum + row.separateQty, 0),
    stores: names.size
  };
  return Object.keys(input.declared).every(key => totals[key] === input.declared[key])
    ? totals : null;
}


// P4: arquivos anteriores ao vínculo P1 permanecem consultáveis exclusivamente
// pelo ADM. Nenhuma dessas rotas permite gravação, associação ou edição.
const legacyReport = row => ({
  id: row.id, date: row.data_operacional, reportDate: row.data_relatorio,
  reportCode: row.codigo_relatorio, reference: row.referencia,
  fileName: row.arquivo_original, stores: row.lojas, lines: row.linhas,
  dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar,
  createdAt: row.criado_em, archived: true
});
const legacyItem = row => ({
  storeNumber: row.loja_numero, storeName: row.loja_nome,
  department: row.departamento, orderCode: row.pedido,
  productCode: row.produto_codigo, description: row.descricao, gtin: row.gtin,
  dispatchCode: row.expedicao_codigo, packageSize: row.embalagem,
  dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar
});
const onlyAdmin = c => c.get("authUser")?.papel === "admin";
const denied = c => c.json({ error: "ACESSO_NEGADO" }, 403);
const isLegacy = "agenda_id IS NULL AND agendamento_id IS NULL";
export const adminLegacyCrossArchiveRoutes = new Hono();

adminLegacyCrossArchiveRoutes.get("/legacy", async c => {
  if (!onlyAdmin(c)) return denied(c);
  const date = c.req.query("date");
  if (date && !validIsoDate(date)) return c.json({ error: "DATA_INVALIDA" }, 400);
  const offset = Number(c.req.query("offset") ?? "0");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    return c.json({ error: "PAGINACAO_INVALIDA" }, 400);
  }
  const query = date
    ? c.env.DB.prepare(`SELECT * FROM cross_relatorios
        WHERE ${isLegacy} AND data_operacional = ?
        ORDER BY criado_em DESC, id DESC LIMIT 100 OFFSET ?`).bind(date, offset)
    : c.env.DB.prepare(`SELECT * FROM cross_relatorios
        WHERE ${isLegacy} ORDER BY criado_em DESC, id DESC LIMIT 100 OFFSET ?`).bind(offset);
  const result = await query.all();
  return c.json({ reports: result.results.map(legacyReport), offset, hasMore: result.results.length === 100 });
});

adminLegacyCrossArchiveRoutes.get("/legacy/:id", async c => {
  if (!onlyAdmin(c)) return denied(c);
  const id = c.req.param("id");
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return c.json({ error: "CROSS_NAO_ENCONTRADO" }, 404);
  const report = await c.env.DB.prepare(`SELECT * FROM cross_relatorios
    WHERE id = ? AND ${isLegacy} LIMIT 1`).bind(id).first();
  if (!report) return c.json({ error: "CROSS_NAO_ENCONTRADO" }, 404);
  const items = await c.env.DB.prepare(`SELECT * FROM cross_itens
    WHERE relatorio_id = ? ORDER BY ordem`).bind(report.id).all();
  return c.json({ report: legacyReport(report), rows: items.results.map(legacyItem) });
});
