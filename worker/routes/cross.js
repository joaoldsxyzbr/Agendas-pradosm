import { Hono } from "hono";
import { z } from "zod";
import { businessDate } from "../lib/time.js";
import { auditStatement } from "../repositories/audit.js";

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

const CrossInput = z.object({
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

const toReport = row => ({
  id: row.id, date: row.data_operacional, reportDate: row.data_relatorio,
  reportCode: row.codigo_relatorio, reference: row.referencia,
  fileName: row.arquivo_original, stores: row.lojas, lines: row.linhas,
  dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar,
  createdAt: row.criado_em
});
const forbidden = c => c.json({ error: "ACESSO_NEGADO", message: "Acesso não permitido." }, 403);
const isDock01 = c => {
  const user = c.get("authUser");
  return user?.papel === "conferente" && user.lojaCodigo?.trim().toUpperCase() === "CD DOCA 01";
};
const validDateFilter = c => {
  const date = c.req.query("date");
  return !date || validIsoDate(date);
};
const MAX_BODY = 512 * 1024;

async function listReports(c) {
  if (!validDateFilter(c)) return c.json({ error: "DATA_INVALIDA" }, 400);
  const date = c.req.query("date");
  const statement = date
    ? c.env.DB.prepare("SELECT * FROM cross_relatorios WHERE data_operacional = ? ORDER BY criado_em DESC LIMIT 100").bind(date)
    : c.env.DB.prepare("SELECT * FROM cross_relatorios ORDER BY criado_em DESC LIMIT 40");
  const result = await statement.all();
  return c.json({ reports: result.results.map(toReport) });
}

async function getReport(c) {
  const report = await c.env.DB.prepare("SELECT * FROM cross_relatorios WHERE id = ? LIMIT 1")
    .bind(c.req.param("id")).first();
  if (!report) return c.json({ error: "CROSS_NAO_ENCONTRADO" }, 404);
  const items = await c.env.DB.prepare("SELECT * FROM cross_itens WHERE relatorio_id = ? ORDER BY ordem")
    .bind(report.id).all();
  return c.json({ report: toReport(report), rows: items.results.map(row => ({
    storeNumber: row.loja_numero, storeName: row.loja_nome,
    department: row.departamento, orderCode: row.pedido,
    productCode: row.produto_codigo, description: row.descricao, gtin: row.gtin,
    dispatchCode: row.expedicao_codigo, packageSize: row.embalagem,
    dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar
  })) });
}

export const adminCrossRoutes = new Hono();
export const storeCrossRoutes = new Hono();

adminCrossRoutes.get("/", listReports);
adminCrossRoutes.get("/:id", getReport);
storeCrossRoutes.get("/", c => isDock01(c) ? listReports(c) : forbidden(c));
storeCrossRoutes.get("/:id", c => isDock01(c) ? getReport(c) : forbidden(c));

adminCrossRoutes.post("/", async c => {
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > MAX_BODY) return c.json({ error: "ARQUIVO_MUITO_GRANDE" }, 413);
  const source = await c.req.text();
  if (new TextEncoder().encode(source).length > MAX_BODY) {
    return c.json({ error: "ARQUIVO_MUITO_GRANDE" }, 413);
  }
  let input;
  try { input = JSON.parse(source); } catch { return c.json({ error: "JSON_INVALIDO" }, 400); }
  const parsed = CrossInput.safeParse(input);
  if (!parsed.success) return c.json({ error: "CROSS_INVALIDO", message: "Revise os dados do relatório." }, 422);
  const data = parsed.data;
  const totals = crossInputTotals(data);
  if (!totals) return c.json({ error: "TOTAIS_DIVERGENTES" }, 422);

  // Duplicidade baseada no conteúdo validado, não no nome do arquivo recebido.
  const canonical = JSON.stringify({ reportDate: data.reportDate, reportCode: data.reportCode, rows: data.rows });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const duplicate = await c.env.DB.prepare("SELECT id FROM cross_relatorios WHERE hash_conteudo = ?")
    .bind(fingerprint).first();
  if (duplicate) return c.json({ error: "CROSS_DUPLICADO", reportId: duplicate.id }, 409);

  const id = crypto.randomUUID(), now = new Date().toISOString();
  const user = c.get("authUser");
  const statements = [
    c.env.DB.prepare(`INSERT INTO cross_relatorios
      (id, data_operacional, data_relatorio, codigo_relatorio, referencia, arquivo_original,
       hash_conteudo, lojas, linhas, quantidade_expedicao, quantidade_separar, criado_por, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, data.operationalDate, data.reportDate, data.reportCode, data.reference || null,
        data.fileName, fingerprint, totals.stores, totals.lines, totals.dispatchQty, totals.separateQty,
        user.id, now),
    ...data.rows.map((row, index) => c.env.DB.prepare(`INSERT INTO cross_itens
      (id, relatorio_id, ordem, loja_numero, loja_nome, departamento, pedido,
       produto_codigo, descricao, gtin, expedicao_codigo, embalagem, quantidade_expedicao, quantidade_separar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, index, row.storeNumber, row.storeName,
        row.department, row.orderCode, row.productCode, row.description, row.gtin,
        row.dispatchCode, row.packageSize, row.dispatchQty, row.separateQty)),
    auditStatement(c.env.DB, {
      userId: user.id, action: "cross_importado", entity: "cross_relatorio", entityId: id,
      details: "Importação de Cross-Docking confirmada.", createdAt: now,
      after: { operationalDate: data.operationalDate, rows: totals.lines, stores: totals.stores }
    })
  ];
  try {
    // Gravação indivisível: não há relatório incompleto quando algum item falha.
    await c.env.DB.batch(statements);
  } catch (error) {
    if (String(error?.message ?? "").includes("UNIQUE constraint failed: cross_relatorios.hash_conteudo")) {
      return c.json({ error: "CROSS_DUPLICADO" }, 409);
    }
    throw error;
  }
  return c.json({ id, stores: totals.stores, lines: totals.lines,
    dispatchQty: totals.dispatchQty, separateQty: totals.separateQty }, 201);
});
