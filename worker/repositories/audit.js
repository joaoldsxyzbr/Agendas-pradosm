function jsonValue(value) {
  return value === void 0 ? null : JSON.stringify(value);
}
function auditStatement(db, input) {
  const createdAt = input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
  return db.prepare(
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
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
    createdAt
  );
}
async function recordAudit(db, input) {
  await auditStatement(db, input).run();
}
async function listAudit(db, filters = {}) {
  const clauses = [];
  const values = [];
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
  const result = await db.prepare(
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
       LIMIT ?`
  ).bind(...values, limit).all();
  return result.results;
}
function parseAuditJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
export {
  auditStatement,
  listAudit,
  parseAuditJson,
  recordAudit
};