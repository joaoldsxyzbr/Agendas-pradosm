import { hashPassword } from "../lib/password";

export type UserRecord = {
  id: string;
  loja_id: string | null;
  nome: string;
  login: string;
  senha_hash: string;
  perfil: "admin" | "loja";
  ativo: number;
};

const USER_COLUMNS = "id, loja_id, nome, login, senha_hash, perfil, ativo";

export async function findUserByLogin(
  db: D1Database,
  login: string,
): Promise<UserRecord | null> {
  return db
    .prepare(`SELECT ${USER_COLUMNS} FROM usuarios WHERE login = ? LIMIT 1`)
    .bind(login)
    .first<UserRecord>();
}

export async function findUserById(
  db: D1Database,
  id: string,
): Promise<UserRecord | null> {
  return db
    .prepare(`SELECT ${USER_COLUMNS} FROM usuarios WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<UserRecord>();
}

export async function listStoreUsers(db: D1Database): Promise<UserRecord[]> {
  const result = await db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM usuarios WHERE perfil = 'loja' ORDER BY nome ASC`,
    )
    .all<UserRecord>();
  return result.results;
}

export async function createStoreUser(
  db: D1Database,
  input: { nome: string; login: string; senha: string; lojaId: string },
): Promise<UserRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.senha);

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'loja', 1, ?, ?)",
    )
    .bind(
      id,
      input.lojaId,
      input.nome,
      input.login,
      passwordHash,
      now,
      now,
    )
    .run();

  return (await findUserById(db, id))!;
}

export async function updateStoreUser(
  db: D1Database,
  current: UserRecord,
  input: {
    nome?: string;
    login?: string;
    senha?: string;
    lojaId?: string;
    ativo?: boolean;
  },
): Promise<UserRecord> {
  const nome = input.nome ?? current.nome;
  const login = input.login ?? current.login;
  const lojaId = input.lojaId ?? current.loja_id;
  const ativo =
    input.ativo === undefined ? current.ativo : input.ativo ? 1 : 0;
  const passwordHash = input.senha
    ? await hashPassword(input.senha)
    : current.senha_hash;
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE usuarios SET loja_id = ?, nome = ?, login = ?, senha_hash = ?, ativo = ?, atualizado_em = ? WHERE id = ? AND perfil = 'loja'",
    )
    .bind(
      lojaId,
      nome,
      login,
      passwordHash,
      ativo,
      now,
      current.id,
    )
    .run();

  return (await findUserById(db, current.id))!;
}
