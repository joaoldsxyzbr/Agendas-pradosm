// Repositório de avisos/notificações in-app (spec 2026-11-11).
// Eventos automáticos entram no MESMO db.batch da operação que os origina:
// operação gravada sem aviso é estado inconsistente (decisão 5 da spec).

const ATIVO_E_NAO_EXPIRADO =
  "a.inativo_em IS NULL AND (a.expira_em IS NULL OR a.expira_em > ?)";

// Lista os avisos ativos com o estado "lido" do usuário. Não lidos primeiro,
// depois por criação descendente. Limitado aos últimos `limit` (decisão 8).
export async function listActiveAvisos(db, userId, now, limit = 50) {
  const rows = await db.prepare(
    `SELECT a.id, a.tipo, a.titulo, a.mensagem, a.criado_em, a.expira_em,
            CASE WHEN l.usuario_id IS NULL THEN 0 ELSE 1 END AS lido
       FROM avisos a
       LEFT JOIN avisos_lidos l ON l.aviso_id = a.id AND l.usuario_id = ?
      WHERE ${ATIVO_E_NAO_EXPIRADO}
      ORDER BY lido ASC, a.criado_em DESC, a.id DESC
      LIMIT ?`
  ).bind(userId, now, limit).all();
  const unread = await db.prepare(
    `SELECT COUNT(*) AS total
       FROM avisos a
      WHERE ${ATIVO_E_NAO_EXPIRADO}
        AND NOT EXISTS (
          SELECT 1 FROM avisos_lidos l
           WHERE l.aviso_id = a.id AND l.usuario_id = ?
        )`
  ).bind(now, userId).first();
  return { avisos: rows.results, naoLidos: unread?.total ?? 0 };
}

// Marca um aviso como lido para o usuário. Idempotente: marcar de novo
// não regrava (INSERT OR IGNORE na PK composta).
export async function markAvisoLido(db, avisoId, userId, now) {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO avisos_lidos (aviso_id, usuario_id, lido_em) VALUES (?, ?, ?)"
  ).bind(avisoId, userId, now).run();
  return result?.meta?.changes === 1;
}

// Mapeia a linha do D1 para o contrato camelCase do frontend (shared/avisos.ts).
export function avisoJson(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensagem: row.mensagem,
    criadoEm: row.criado_em,
    expiraEm: row.expira_em ?? null,
    lido: row.lido === 1
  };
}

// Statement de INSERT de aviso publicado pelo admin; entra no mesmo batch
// da auditoria (aviso_publicado) na rota. O `id` opcional permite casar o
// INSERT com o entityId gravado na auditoria.
export function publishAvisoStatement(db, { id, titulo, mensagem, criadoPor, criadoEm, expiraEm }) {
  return db.prepare(
    "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em, expira_em) VALUES (?, 'aviso', ?, ?, ?, ?, ?)"
  ).bind(
    id ?? crypto.randomUUID(), titulo, mensagem, criadoPor, criadoEm, expiraEm ?? null
  );
}

// Statement do UPDATE de inativação (soft delete); o changes() do batch
// identifica se o aviso estava ativo de fato.
export function inativarAvisoStatement(db, { avisoId, now }) {
  return db.prepare(
    "UPDATE avisos SET inativo_em = ? WHERE id = ? AND inativo_em IS NULL"
  ).bind(now, avisoId);
}

// Statement reutilizável do evento automático, para dentro do db.batch da
// operação. `guardAuditId`: só grava o aviso se a auditoria da operação
// registrou (padrão onlyIfPreviousWrite — falha silenciosa se a operação
// não alterou nada).
export function avisoEventoStatement(db, { titulo, mensagem, criadoEm, guardAuditId = null }) {
  const id = crypto.randomUUID();
  if (guardAuditId) {
    return db.prepare(
      "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em) " +
      "SELECT ?, 'evento', ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM auditoria WHERE id = ?)"
    ).bind(id, titulo, mensagem, criadoEm, guardAuditId);
  }
  return db.prepare(
    "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_por, criado_em) VALUES (?, 'evento', ?, ?, NULL, ?)"
  ).bind(id, titulo, mensagem, criadoEm);
}
