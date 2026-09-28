import { hashPassword } from "../lib/password";
import { auditStatement, recordAudit } from "./audit";

export type UserRecord = {
  id: string;
  loja_id: string | null;
  nome: string;
  login: string;
  senha_hash: string;
  perfil: "admin" | "loja";
  ativo: number;
  excluido_em: string | null;
};

const USER_COLUMNS =
  "id, loja_id, nome, login, senha_hash, perfil, ativo, excluido_em";

export async function findUserByLogin(
  db: D1Database,
  login: string,
): Promise<UserRecord | null> {
  return db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM usuarios WHERE login = ? COLLATE NOCASE AND excluido_em IS NULL LIMIT 1`,
    )
    .bind(login)
    .first<UserRecord>();
}

export async function findUserById(
  db: D1Database,
  id: string,
): Promise<UserRecord | null> {
  return db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM usuarios WHERE id = ? AND excluido_em IS NULL LIMIT 1`,
    )
    .bind(id)
    .first<UserRecord>();
}

export async function hasAdmin(db: D1Database): Promise<boolean> {
  const result = await db
    .prepare(
      "SELECT 1 AS presente FROM usuarios WHERE perfil = 'admin' AND excluido_em IS NULL LIMIT 1",
    )
    .first<{ presente: number }>();

  return result !== null;
}

export async function createInactiveFirstAdmin(
  db: D1Database,
  input: { nome: string; login: string; senha: string },
): Promise<UserRecord | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.senha);

  const result = await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) SELECT ?, NULL, ?, ?, ?, 'admin', 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE perfil = 'admin' AND excluido_em IS NULL)",
    )
    .bind(id, input.nome, input.login, passwordHash, now, now)
    .run();

  if (result.meta.changes === 0) return null;

  await recordAudit(db, {
    userId: null,
    action: "admin_bootstrap_preparado",
    entity: "usuario",
    entityId: id,
    after: {
      nome: input.nome,
      login: input.login,
      perfil: "admin",
      ativo: false,
    },
    details: "Primeiro administrador preparado.",
    createdAt: now,
  });

  return findUserById(db, id);
}

export async function listStoreUsers(db: D1Database): Promise<UserRecord[]> {
  const result = await db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM usuarios WHERE perfil = 'loja' AND excluido_em IS NULL ORDER BY nome ASC`,
    )
    .all<UserRecord>();
  return result.results;
}

export async function createStoreUser(
  db: D1Database,
  input: { nome: string; login: string; senha: string; lojaId: string },
  actorUserId: string,
): Promise<UserRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.senha);

  await db.batch([
    db
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
      ),
    auditStatement(db, {
      userId: actorUserId,
      action: "usuario_criado",
      entity: "usuario",
      entityId: id,
      storeId: input.lojaId,
      after: {
        nome: input.nome,
        login: input.login,
        lojaId: input.lojaId,
        ativo: true,
        senhaAlterada: true,
      },
      details: "Usuário de loja criado.",
      createdAt: now,
    }),
  ]);

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
  actorUserId: string,
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

  await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET loja_id = ?, nome = ?, login = ?, senha_hash = ?, ativo = ?, atualizado_em = ? WHERE id = ? AND perfil = 'loja' AND excluido_em IS NULL",
      )
      .bind(
        lojaId,
        nome,
        login,
        passwordHash,
        ativo,
        now,
        current.id,
      ),
    auditStatement(db, {
      userId: actorUserId,
      action: "usuario_atualizado",
      entity: "usuario",
      entityId: current.id,
      storeId: lojaId,
      before: {
        nome: current.nome,
        login: current.login,
        lojaId: current.loja_id,
        ativo: current.ativo === 1,
      },
      after: {
        nome,
        login,
        lojaId,
        ativo: ativo === 1,
        senhaAlterada: Boolean(input.senha),
      },
      details: "Usuário de loja atualizado.",
      createdAt: now,
    }),
  ]);

  return (await findUserById(db, current.id))!;
}

export async function softDeleteStoreUser(
  db: D1Database,
  current: UserRecord,
  actorUserId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const [result] = await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND perfil = 'loja' AND excluido_em IS NULL",
      )
      .bind(now, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "usuario_removido",
      entity: "usuario",
      entityId: current.id,
      storeId: current.loja_id,
      before: {
        nome: current.nome,
        login: current.login,
        lojaId: current.loja_id,
        ativo: current.ativo === 1,
      },
      after: {
        nome: current.nome,
        login: current.login,
        lojaId: current.loja_id,
        ativo: false,
        removido: true,
      },
      details: "Usuário removido logicamente.",
      createdAt: now,
    }),
  ]);

  return result.meta.changes > 0;
}
