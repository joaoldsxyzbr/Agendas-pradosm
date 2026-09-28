import type { UserRole } from "../../shared/auth";
import { hashPassword } from "../lib/password";
import { auditStatement, recordAudit } from "./audit";

export type UserRecord = {
  id: string;
  loja_id: string | null;
  nome: string;
  login: string;
  senha_hash: string;
  papel: UserRole;
  ativo: number;
  excluido_em: string | null;
};

const USER_COLUMNS =
  "id, loja_id, nome, login, senha_hash, papel, ativo, excluido_em";

async function assertCanRemoveActiveAdmin(
  db: D1Database,
  current: UserRecord,
  nextPapel: UserRole,
  nextAtivo: number,
) {
  if (
    current.papel !== "admin" ||
    current.ativo !== 1 ||
    (nextPapel === "admin" && nextAtivo === 1)
  ) {
    return;
  }

  const row = await db
    .prepare(
      "SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND excluido_em IS NULL",
    )
    .first<{ total: number }>();

  if ((row?.total ?? 0) <= 1) {
    throw new Error("ULTIMO_ADMIN_ATIVO");
  }
}

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
      "SELECT 1 AS presente FROM usuarios WHERE papel = 'admin' AND excluido_em IS NULL LIMIT 1",
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
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) SELECT ?, NULL, ?, ?, ?, 'admin', 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE papel = 'admin' AND excluido_em IS NULL)",
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
      papel: "admin",
      ativo: false,
    },
    details: "Primeiro administrador preparado.",
    createdAt: now,
  });

  return findUserById(db, id);
}

export async function listUsers(db: D1Database): Promise<UserRecord[]> {
  const result = await db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM usuarios WHERE excluido_em IS NULL ORDER BY nome ASC`,
    )
    .all<UserRecord>();
  return result.results;
}

export async function createUser(
  db: D1Database,
  input: {
    nome: string;
    login: string;
    senha: string;
    papel: UserRole;
    lojaId?: string;
  },
  actorUserId: string,
): Promise<UserRecord> {
  if (input.papel === "conferente" && !input.lojaId) {
    throw new Error("LOJA_OBRIGATORIA");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.senha);
  const lojaId = input.papel === "conferente" ? input.lojaId! : null;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
      )
      .bind(
        id,
        lojaId,
        input.nome,
        input.login,
        passwordHash,
        input.papel,
        now,
        now,
      ),
  ];

  statements.push(
    auditStatement(db, {
      userId: actorUserId,
      action: "usuario_criado",
      entity: "usuario",
      entityId: id,
      storeId: lojaId,
      after: {
        nome: input.nome,
        login: input.login,
        lojaId,
        papel: input.papel,
        ativo: true,
        senhaAlterada: true,
      },
      details: "Usuário criado.",
      createdAt: now,
    }),
  );

  await db.batch(statements);
  return (await findUserById(db, id))!;
}

export async function updateUser(
  db: D1Database,
  current: UserRecord,
  input: {
    nome?: string;
    login?: string;
    senha?: string;
    papel?: UserRole;
    lojaId?: string;
    ativo?: boolean;
  },
  actorUserId: string,
): Promise<UserRecord> {
  const nome = input.nome ?? current.nome;
  const login = input.login ?? current.login;
  const papel = input.papel ?? current.papel;
  const ativo =
    input.ativo === undefined ? current.ativo : input.ativo ? 1 : 0;
  const lojaId =
    papel === "conferente" ? (input.lojaId ?? current.loja_id) : null;

  if (papel === "conferente" && !lojaId) {
    throw new Error("LOJA_OBRIGATORIA");
  }

  await assertCanRemoveActiveAdmin(db, current, papel, ativo);

  const passwordHash = input.senha
    ? await hashPassword(input.senha)
    : current.senha_hash;
  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE usuarios SET loja_id = ?, nome = ?, login = ?, senha_hash = ?, papel = ?, ativo = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL",
      )
      .bind(
        lojaId,
        nome,
        login,
        passwordHash,
        papel,
        ativo,
        now,
        current.id,
      ),
  ];

  statements.push(
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
        papel: current.papel,
        ativo: current.ativo === 1,
      },
      after: {
        nome,
        login,
        lojaId,
        papel,
        ativo: ativo === 1,
        senhaAlterada: Boolean(input.senha),
      },
      details: "Usuário atualizado.",
      createdAt: now,
    }),
  );

  await db.batch(statements);
  return (await findUserById(db, current.id))!;
}

export async function softDeleteUser(
  db: D1Database,
  current: UserRecord,
  actorUserId: string,
): Promise<boolean> {
  await assertCanRemoveActiveAdmin(db, current, current.papel, 0);

  const now = new Date().toISOString();
  const [result] = await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL",
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
        papel: current.papel,
        ativo: current.ativo === 1,
      },
      after: {
        nome: current.nome,
        login: current.login,
        lojaId: current.loja_id,
        papel: current.papel,
        ativo: false,
        removido: true,
      },
      details: "Usuário removido logicamente.",
      createdAt: now,
    }),
  ]);

  return result.meta.changes > 0;
}

