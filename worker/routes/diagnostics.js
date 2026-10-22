import { Hono } from "hono";
import { z } from "zod";
import { DIAGNOSTIC_EVENTS, recordDiagnostic, listDiagnostics } from "../repositories/diagnostics.js";

export const diagnosticRoutes = new Hono();
export const adminDiagnosticRoutes = new Hono();
const DiagnosticInput = z.object({
  evento: z.enum(DIAGNOSTIC_EVENTS),
  nivel: z.enum(["info", "warning", "error"]),
  operacao: z.enum(["importacao", "aplicativo", "api"]),
  formato: z.enum(["csv", "pdf", "outro"]).nullable().optional(),
  quantidade: z.number().int().min(0).max(700).nullable().optional(),
  httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  correlacao: z.string().uuid().optional()
}).strict();
const FilterInput = z.object({
  nivel: z.enum(["info", "warning", "error"]).optional(),
  operacao: z.enum(["importacao", "aplicativo", "api"]).optional(),
  origem: z.enum(["browser", "worker"]).optional(),
  userId: z.string().trim().min(1).max(80).optional(),
  storeId: z.string().trim().min(1).max(80).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

diagnosticRoutes.post("/events", async c => {
  const bytes = await c.req.raw.clone().arrayBuffer();
  if (bytes.byteLength > 1024) return c.json({ error: "EVENTO_MUITO_GRANDE" }, 413);
  const parsed = DiagnosticInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "EVENTO_INVALIDO" }, 400);
  const user = c.get("authUser");
  const since = new Date(Date.now() - 60000).toISOString();
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM diagnosticos WHERE usuario_id = ? AND criado_em >= ?"
  ).bind(user.id, since).first();
  if (Number(count?.n ?? 0) >= 30) return c.json({ error: "LIMITE_DE_EVENTOS" }, 429);
  await recordDiagnostic(c.env.DB, {
    ...parsed.data, origem: "browser", userId: user.id, storeId: user.lojaId ?? null
  });
  return c.body(null, 204);
});

adminDiagnosticRoutes.get("/", async c => {
  if (c.get("authUser")?.papel !== "admin") {
    return c.json({ error: "ACESSO_NEGADO" }, 403);
  }
  const parsed = FilterInput.safeParse({
    nivel: c.req.query("nivel") || undefined,
    operacao: c.req.query("operacao") || undefined,
    origem: c.req.query("origem") || undefined,
    userId: c.req.query("userId") || undefined,
    storeId: c.req.query("storeId") || undefined,
    date: c.req.query("date") || undefined,
    limit: c.req.query("limit") || undefined
  });
  if (!parsed.success) return c.json({ error: "FILTRO_INVALIDO" }, 400);
  const rows = await listDiagnostics(c.env.DB, parsed.data);
  return c.json(rows.map(x => ({
    id: x.id, user: x.usuario_id ? { id: x.usuario_id, name: x.usuario_nome ?? "Usuário" } : null,
    source: x.origem, level: x.nivel, event: x.evento, operation: x.operacao,
    format: x.formato, count: x.quantidade, httpStatus: x.http_status,
    correlationId: x.correlacao, storeId: x.loja_id, createdAt: x.criado_em
  })));
});