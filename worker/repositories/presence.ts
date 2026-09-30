export type ConferentePresenceRecord = {
  usuario_id: string;
  loja_id: string;
  ultima_interacao_em: string | null;
  ultimo_sinal_em: string;
};

export async function touchConferentePresence(
  db: D1Database,
  input: {
    userId: string;
    storeId: string;
    interacted: boolean;
    now: string;
  },
) {
  const interactionAt = input.interacted ? input.now : null;

  await db
    .prepare(
      `INSERT INTO conferente_presenca (
        usuario_id,
        loja_id,
        ultima_interacao_em,
        ultimo_sinal_em,
        atualizado_em
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET
        loja_id = excluded.loja_id,
        ultima_interacao_em = CASE
          WHEN conferente_presenca.loja_id <> excluded.loja_id
            THEN excluded.ultima_interacao_em
          WHEN excluded.ultima_interacao_em IS NOT NULL
            THEN excluded.ultima_interacao_em
          ELSE conferente_presenca.ultima_interacao_em
        END,
        ultimo_sinal_em = excluded.ultimo_sinal_em,
        atualizado_em = excluded.atualizado_em`,
    )
    .bind(
      input.userId,
      input.storeId,
      interactionAt,
      input.now,
      input.now,
    )
    .run();
}

export async function clearConferentePresence(
  db: D1Database,
  userId: string,
) {
  await db
    .prepare("DELETE FROM conferente_presenca WHERE usuario_id = ?")
    .bind(userId)
    .run();
}

export async function listActiveConferentePresence(
  db: D1Database,
): Promise<ConferentePresenceRecord[]> {
  const result = await db
    .prepare(
      `SELECT
        p.usuario_id,
        p.loja_id,
        p.ultima_interacao_em,
        p.ultimo_sinal_em
      FROM conferente_presenca p
      INNER JOIN usuarios u
        ON u.id = p.usuario_id
       AND u.loja_id = p.loja_id
      WHERE u.papel = 'conferente'
        AND u.ativo = 1
        AND u.excluido_em IS NULL`,
    )
    .all<ConferentePresenceRecord>();

  return result.results;
}
