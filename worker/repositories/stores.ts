import { auditStatement } from "./audit";
export type StoreRecord = {
  id: string;
  codigo: string;
  nome: string;
  ativo: number;
  excluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

const STORE_COLUMNS =
  "id, codigo, nome, ativo, excluido_em, criado_em, atualizado_em";

export async function listStores(db: D1Database): Promise<StoreRecord[]> {
  const result = await db
    .prepare(
      `SELECT ${STORE_COLUMNS} FROM lojas WHERE excluido_em IS NULL ORDER BY codigo ASC`,
    )
    .all<StoreRecord>();
  return result.results;
}

export async function findStoreById(
  db: D1Database,
  id: string,
): Promise<StoreRecord | null> {
  return db
    .prepare(
      `SELECT ${STORE_COLUMNS} FROM lojas WHERE id = ? AND excluido_em IS NULL LIMIT 1`,
    )
    .bind(id)
    .first<StoreRecord>();
}

export async function createStore(
  db: D1Database,
  input: { codigo: string; nome: string },
  actorUserId: string,
): Promise<StoreRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(id, input.codigo, input.nome, now, now),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_criada",
      entity: "loja",
      entityId: id,
      storeId: id,
      after: {
        codigo: input.codigo,
        nome: input.nome,
        ativo: true,
      },
      details: "Loja criada.",
      createdAt: now,
    }),
  ]);

  return (await findStoreById(db, id))!;
}

export async function updateStore(
  db: D1Database,
  current: StoreRecord,
  input: { codigo?: string; nome?: string; ativo?: boolean },
  actorUserId: string,
): Promise<StoreRecord> {
  const codigo = input.codigo ?? current.codigo;
  const nome = input.nome ?? current.nome;
  const ativo =
    input.ativo === undefined ? current.ativo : input.ativo ? 1 : 0;
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        "UPDATE lojas SET codigo = ?, nome = ?, ativo = ?, atualizado_em = ? WHERE id = ?",
      )
      .bind(codigo, nome, ativo, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_atualizada",
      entity: "loja",
      entityId: current.id,
      storeId: current.id,
      before: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: current.ativo === 1,
      },
      after: {
        codigo,
        nome,
        ativo: ativo === 1,
      },
      details: "Loja atualizada.",
      createdAt: now,
    }),
  ]);

  return (await findStoreById(db, current.id))!;
}


export async function hasStoreUsers(
  db: D1Database,
  storeId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "SELECT 1 AS presente FROM usuarios WHERE loja_id = ? AND perfil = 'loja' AND excluido_em IS NULL LIMIT 1",
    )
    .bind(storeId)
    .first<{ presente: number }>();

  return result !== null;
}

export async function softDeleteStore(
  db: D1Database,
  current: StoreRecord,
  actorUserId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const [result] = await db.batch([
    db
      .prepare(
        "UPDATE lojas SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL",
      )
      .bind(now, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_removida",
      entity: "loja",
      entityId: current.id,
      storeId: current.id,
      before: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: current.ativo === 1,
      },
      after: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: false,
        removida: true,
      },
      details: "Loja removida logicamente.",
      createdAt: now,
    }),
  ]);

  return result.meta.changes > 0;
}
