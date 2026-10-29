import { businessDate } from "../lib/time.js";
import { nonattendanceStatements } from "../repositories/agendas.js";
const AUTO_CLOSE_ELIGIBILITY = `
  status_dia = 'aberto'
  AND data_agenda < ?
  AND COALESCE(
    (
      SELECT h.acao
      FROM historico_agenda h
      WHERE h.agenda_id = agendas.id
        AND h.acao IN ('concluido', 'reaberto')
      ORDER BY h.alterado_em DESC, h.rowid DESC
      LIMIT 1
    ),
    ''
  ) <> 'reaberto'
`;
async function closePastOpenAgendas(db, now = /* @__PURE__ */ new Date()) {
  const today = businessDate(now);
  // GET e cron mantêm o fallback, mas não abrem transações de escrita
  // quando não existe uma agenda antiga elegível a fechamento.
  const eligible = await db.prepare(
    `SELECT 1 FROM agendas WHERE ${AUTO_CLOSE_ELIGIBILITY} LIMIT 1`
  ).bind(today).first();
  if (!eligible) return;
  const completedAt = now.toISOString();
  await db.batch([
    ...nonattendanceStatements(db, "SELECT id FROM agendas WHERE " + AUTO_CLOSE_ELIGIBILITY, [today], completedAt),
    db.prepare(
      `INSERT INTO auditoria (
          id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id,
          antes, depois, detalhes, criado_em
        )
        SELECT
          lower(hex(randomblob(16))), NULL, 'dia_concluido_automaticamente',
          'agenda', id, loja_id, id, '{"dayStatus":"aberto"}',
          '{"dayStatus":"concluido"}',
          'Dia conclu\xEDdo automaticamente ap\xF3s a virada da data operacional.', ?
        FROM agendas
        WHERE ${AUTO_CLOSE_ELIGIBILITY}`
    ).bind(completedAt, today),
    db.prepare(
      `UPDATE agendas
         SET status_dia = 'concluido',
             concluido_em = ?,
             concluido_por = NULL,
             atualizado_em = ?
         WHERE ${AUTO_CLOSE_ELIGIBILITY}`
    ).bind(completedAt, completedAt, today)
  ]);
}
export {
  closePastOpenAgendas
};