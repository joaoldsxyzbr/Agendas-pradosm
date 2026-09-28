import { businessDate } from "../lib/time";

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
        WHERE status_dia = 'aberto' AND data_agenda < ?`,
      )
      .bind(completedAt, today),
    db
      .prepare(
        "UPDATE agendas SET status_dia = 'concluido', concluido_em = ?, concluido_por = NULL, atualizado_em = ? WHERE status_dia = 'aberto' AND data_agenda < ?",
      )
      .bind(completedAt, completedAt, today),
  ]);
}
