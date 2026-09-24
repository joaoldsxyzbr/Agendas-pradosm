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
