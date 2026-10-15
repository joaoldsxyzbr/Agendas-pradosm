import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";

export const adminReportRoutes = new Hono<AppEnv>();

const DAY_MS = 86_400_000;
const MAX_REPORT_DAYS = 93;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (date) => {
    const ms = Date.parse(date + "T00:00:00Z");
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date;
  },
);

const reportFilters = z.object({
  start: dateSchema,
  end: dateSchema,
  storeCode: z.string().trim().min(1).max(20).optional(),
}).refine(
  ({ start, end }) => {
    const span = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / DAY_MS;
    return span >= 0 && span < MAX_REPORT_DAYS;
  },
  { message: "Selecione um intervalo de 1 a 93 dias." },
);

function parseFilters(query: (key: string) => string | undefined) {
  return reportFilters.safeParse({
    start: query("start"),
    end: query("end"),
    storeCode: query("storeCode") || undefined,
  });
}

const dateWhere = [
  "a.data_agenda BETWEEN ? AND ?",
  "AND (? IS NULL OR l.codigo = ? COLLATE NOCASE)",
].join(" ");

type DayRow = {
  date: string;
  storeCode: string;
  storeName: string;
  dayStatus: "aberto" | "concluido";
  total: number;
  aguardando: number;
  recebido: number;
  naoChegou: number;
  recusado: number;
  semAgenda: number;
};

function args(start: string, end: string, storeCode?: string) {
  return [start, end, storeCode ?? null, storeCode ?? null] as const;
}

adminReportRoutes.get("/", async (c) => {
  const parsed = parseFilters((key) => c.req.query(key));
  if (!parsed.success) {
    return c.json({ error: "FILTROS_INVALIDOS", message: "Informe um período válido de até 93 dias." }, 400);
  }
  const { start, end, storeCode } = parsed.data;
  const filters = args(start, end, storeCode);
  const rows = await c.env.DB.prepare([
    "SELECT a.data_agenda AS date, l.codigo AS storeCode, l.nome AS storeName,",
    "a.status_dia AS dayStatus, COUNT(ag.id) AS total,",
    "SUM(CASE WHEN ag.status = 'aguardando' THEN 1 ELSE 0 END) AS aguardando,",
    "SUM(CASE WHEN ag.status = 'recebido' THEN 1 ELSE 0 END) AS recebido,",
    "SUM(CASE WHEN ag.status = 'nao_chegou' THEN 1 ELSE 0 END) AS naoChegou,",
    "SUM(CASE WHEN ag.status = 'recusado' THEN 1 ELSE 0 END) AS recusado,",
    "SUM(CASE WHEN ag.origem = 'manual' THEN 1 ELSE 0 END) AS semAgenda",
    "FROM agendas a JOIN lojas l ON l.id = a.loja_id",
    "LEFT JOIN agendamentos ag ON ag.agenda_id = a.id AND ag.ativo = 1",
    "WHERE", dateWhere,
    "GROUP BY a.id ORDER BY a.data_agenda ASC, l.codigo ASC",
  ].join(" ")).bind(...filters).all<DayRow>();

  const suppliers = await c.env.DB.prepare([
    "SELECT ag.fornecedor AS supplier, COUNT(*) AS naoChegou",
    "FROM agendamentos ag",
    "JOIN agendas a ON a.id = ag.agenda_id",
    "JOIN lojas l ON l.id = a.loja_id",
    "WHERE", dateWhere,
    "AND ag.ativo = 1 AND ag.status = 'nao_chegou'",
    "GROUP BY ag.fornecedor",
    "ORDER BY naoChegou DESC, ag.fornecedor ASC LIMIT 12",
  ].join(" ")).bind(...filters).all<{ supplier: string; naoChegou: number }>();

  return c.json({
    start,
    end,
    storeCode: storeCode ?? null,
    rows: rows.results.map((row) => ({
      ...row,
      total: Number(row.total),
      aguardando: Number(row.aguardando),
      recebido: Number(row.recebido),
      naoChegou: Number(row.naoChegou),
      recusado: Number(row.recusado),
      semAgenda: Number(row.semAgenda),
    })),
    suppliers: suppliers.results.map((supplier) => ({
      ...supplier,
      naoChegou: Number(supplier.naoChegou),
    })),
  });
});

const occurrencesFilters = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

adminReportRoutes.get("/occurrences", async (c) => {
  const parsed = parseFilters((key) => c.req.query(key));
  const paging = occurrencesFilters.safeParse({
    limit: c.req.query("limit") ?? undefined,
    offset: c.req.query("offset") ?? undefined,
  });
  if (!parsed.success || !paging.success) {
    return c.json({ error: "FILTROS_INVALIDOS", message: "Filtros ou paginação inválidos." }, 400);
  }
  const { start, end, storeCode } = parsed.data;
  const filters = args(start, end, storeCode);
  const base = [
    "FROM agendamentos ag",
    "JOIN agendas a ON a.id = ag.agenda_id",
    "JOIN lojas l ON l.id = a.loja_id",
    "WHERE", dateWhere,
    "AND ag.ativo = 1 AND ag.status = 'nao_chegou'",
  ].join(" ");
  const [count, rows] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS total " + base)
      .bind(...filters).first<{ total: number }>(),
    c.env.DB.prepare([
      "SELECT a.data_agenda AS date, l.codigo AS storeCode,",
      "l.nome AS storeName, ag.protocolo AS protocol,",
      "ag.fornecedor AS supplier, ag.observacao AS observation,",
      "ag.origem AS origin",
      base,
      "ORDER BY a.data_agenda DESC, l.codigo ASC, ag.horario_inicio ASC, ag.id ASC",
      "LIMIT ? OFFSET ?",
    ].join(" ")).bind(...filters, paging.data.limit, paging.data.offset).all<{
      date: string;
      storeCode: string;
      storeName: string;
      protocol: string;
      supplier: string;
      observation: string | null;
      origin: "importado" | "manual";
    }>(),
  ]);
  return c.json({
    total: Number(count?.total ?? 0),
    offset: paging.data.offset,
    limit: paging.data.limit,
    rows: rows.results.map((row) => ({
      ...row,
      protocol: row.origin === "manual" ? "Sem agenda" : row.protocol,
    })),
  });
});
