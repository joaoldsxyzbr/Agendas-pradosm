export type AuditEntity =
  | "agenda"
  | "agendamento"
  | "loja"
  | "usuario";

export type AuditInput = {
  userId: string | null;
  action: string;
  entity: AuditEntity;
  entityId: string;
  storeId?: string | null;
  agendaId?: string | null;
  appointmentId?: string | null;
  before?: unknown;
  after?: unknown;
  details?: string | null;
  createdAt?: string;
};

export type AuditRecord = {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  entidade: AuditEntity;
  entidade_id: string;
  loja_id: string | null;
  agenda_id: string | null;
  agendamento_id: string | null;
  antes: string | null;
  depois: string | null;
  detalhes: string | null;
  criado_em: string;
};

function jsonValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

export function auditStatement(
  db: D1Database,
  input: AuditInput,
): D1PreparedStatement {
  const createdAt = input.createdAt ?? new Date().toISOString();

  return db
    .prepare(
      `INSERT INTO auditoria (
        id,
        usuario_id,
        acao,
        entidade,
        entidade_id,
        loja_id,
        agenda_id,
        agendamento_id,
        antes,
        depois,
        detalhes,
        criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.userId,
      input.action,
      input.entity,
      input.entityId,
      input.storeId ?? null,
      input.agendaId ?? null,
      input.appointmentId ?? null,
      jsonValue(input.before),
      jsonValue(input.after),
      input.details ?? null,
      createdAt,
    );
}

export async function recordAudit(
  db: D1Database,
  input: AuditInput,
): Promise<void> {
  await auditStatement(db, input).run();
}

export async function listAudit(
  db: D1Database,
  filters: {
    entity?: AuditEntity;
    entityId?: string;
    agendaId?: string;
    userId?: string;
    limit?: number;
  } = {},
): Promise<AuditRecord[]> {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (filters.entity) {
    clauses.push("a.entidade = ?");
    values.push(filters.entity);
  }

  if (filters.entityId) {
    clauses.push("a.entidade_id = ?");
    values.push(filters.entityId);
  }

  if (filters.agendaId) {
    clauses.push("a.agenda_id = ?");
    values.push(filters.agendaId);
  }

  if (filters.userId) {
    clauses.push("a.usuario_id = ?");
    values.push(filters.userId);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await db
    .prepare(
      `SELECT
         a.id,
         a.usuario_id,
         u.nome AS usuario_nome,
         a.acao,
         a.entidade,
         a.entidade_id,
         a.loja_id,
         a.agenda_id,
         a.agendamento_id,
         a.antes,
         a.depois,
         a.detalhes,
         a.criado_em
       FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ${where}
       ORDER BY a.criado_em DESC, a.id DESC
       LIMIT ?`,
    )
    .bind(...values, limit)
    .all<AuditRecord>();

  return result.results;
}

export function parseAuditJson(value: string | null): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
