export type StoreRecord = {
  id: string;
  codigo: string;
  nome: string;
  ativo: number;
  criado_em: string;
  atualizado_em: string;
};

const STORE_COLUMNS =
  "id, codigo, nome, ativo, criado_em, atualizado_em";

export async function listStores(db: D1Database): Promise<StoreRecord[]> {
  const result = await db
    .prepare(`SELECT ${STORE_COLUMNS} FROM lojas ORDER BY codigo ASC`)
    .all<StoreRecord>();
  return result.results;
}

export async function findStoreById(
  db: D1Database,
  id: string,
): Promise<StoreRecord | null> {
  return db
    .prepare(`SELECT ${STORE_COLUMNS} FROM lojas WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<StoreRecord>();
}

export async function createStore(
  db: D1Database,
  input: { codigo: string; nome: string },
): Promise<StoreRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(id, input.codigo, input.nome, now, now)
    .run();

  return (await findStoreById(db, id))!;
}

export async function updateStore(
  db: D1Database,
  current: StoreRecord,
  input: { codigo?: string; nome?: string; ativo?: boolean },
): Promise<StoreRecord> {
  const codigo = input.codigo ?? current.codigo;
  const nome = input.nome ?? current.nome;
  const ativo =
    input.ativo === undefined ? current.ativo : input.ativo ? 1 : 0;
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE lojas SET codigo = ?, nome = ?, ativo = ?, atualizado_em = ? WHERE id = ?",
    )
    .bind(codigo, nome, ativo, now, current.id)
    .run();

  return (await findStoreById(db, current.id))!;
}
