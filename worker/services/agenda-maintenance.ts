import { businessDate } from "../lib/time";

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

export async function closePastOpenAgendas(
  db: D1Database,
  now = new Date(),
): Promise<void> {
  const today = businessDate(now);
  const completedAt = now.toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO auditoria (
          id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id,
          antes, depois, detalhes, criado_em
        )
        SELECT
          lower(hex(randomblob(16))), NULL, 'dia_concluido_automaticamente',
          'agenda', id, loja_id, id, '{"dayStatus":"aberto"}',
          '{"dayStatus":"concluido"}',
          'Dia concluído automaticamente após a virada da data operacional.', ?
        FROM agendas
        WHERE ${AUTO_CLOSE_ELIGIBILITY}`,
      )
      .bind(completedAt, today),
    db
      .prepare(
        `UPDATE agendas
         SET status_dia = 'concluido',
             concluido_em = ?,
             concluido_por = NULL,
             atualizado_em = ?
         WHERE ${AUTO_CLOSE_ELIGIBILITY}`,
      )
      .bind(completedAt, completedAt, today),
  ]);
}
