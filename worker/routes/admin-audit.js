import { Hono } from "hono";
import { z } from "zod";
import { listAudit, parseAuditJson } from "../repositories/audit.js";
const adminAuditRoutes = new Hono();
const AuditFilters = z.object({
  entity: z.enum(["agenda", "agendamento", "loja", "usuario"]).optional(),
  entityId: z.string().trim().min(1).optional(),
  agendaId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).max(80).optional(),
  storeId: z.string().trim().min(1).max(80).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});
adminAuditRoutes.get("/", async (c) => {
  const parsed = AuditFilters.safeParse({
    entity: c.req.query("entity") || void 0,
    entityId: c.req.query("entityId") || void 0,
    agendaId: c.req.query("agendaId") || void 0,
    userId: c.req.query("userId") || void 0,
    storeId: c.req.query("storeId") || void 0,
    date: c.req.query("date") || void 0,
    limit: c.req.query("limit") || void 0
  });
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Filtros de auditoria inv\xE1lidos." },
      400
    );
  }
  const records = await listAudit(c.env.DB, parsed.data);
  return c.json(
    records.map((item) => ({
      id: item.id,
      action: item.acao,
      entity: item.entidade,
      entityId: item.entidade_id,
      storeId: item.loja_id,
      agendaId: item.agenda_id,
      appointmentId: item.agendamento_id,
      before: parseAuditJson(item.antes),
      after: parseAuditJson(item.depois),
      details: item.detalhes,
      createdAt: item.criado_em,
      user: item.usuario_id ? { id: item.usuario_id, name: item.usuario_nome ?? "Usu\xE1rio" } : null
    }))
  );
});
export {
  adminAuditRoutes
};