import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { listAudit, parseAuditJson } from "../repositories/audit";

export const adminAuditRoutes = new Hono<AppEnv>();

const AuditFilters = z.object({
  entity: z.enum(["agenda", "agendamento", "loja", "usuario"]).optional(),
  entityId: z.string().trim().min(1).optional(),
  agendaId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

adminAuditRoutes.get("/", async (c) => {
  const parsed = AuditFilters.safeParse({
    entity: c.req.query("entity") || undefined,
    entityId: c.req.query("entityId") || undefined,
    agendaId: c.req.query("agendaId") || undefined,
    userId: c.req.query("userId") || undefined,
    limit: c.req.query("limit") || undefined,
  });

  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Filtros de auditoria inválidos." },
      400,
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
      user: item.usuario_id
        ? { id: item.usuario_id, name: item.usuario_nome ?? "Usuário" }
        : null,
    })),
  );
});
