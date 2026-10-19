import { hashPassword } from "../lib/password.js";
import { auditStatement } from "./audit.js";
const USER_COLUMNS = "id, loja_id, nome, login, senha_hash, papel, ativo, session_version, excluido_em";
async function findUserByLogin(db, login) {
  return db.prepare(
    `SELECT ${USER_COLUMNS} FROM usuarios WHERE login = ? COLLATE NOCASE AND excluido_em IS NULL LIMIT 1`
  ).bind(login).first();
}
async function findUserById(db, id) {
  return db.prepare(
    `SELECT ${USER_COLUMNS} FROM usuarios WHERE id = ? AND excluido_em IS NULL LIMIT 1`
  ).bind(id).first();
}
async function upgradeUserPasswordHash(db, userId, passwordHash) {
  await db.prepare(
    "UPDATE usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL"
  ).bind(passwordHash, (/* @__PURE__ */ new Date()).toISOString(), userId).run();
}
async function hasAdmin(db) {
  const result = await db.prepare(
    "SELECT 1 AS presente FROM usuarios WHERE papel = 'admin' AND excluido_em IS NULL LIMIT 1"
  ).first();
  return result !== null;
}
async function createInactiveFirstAdmin(db, input) {
  const id = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const passwordHash = await hashPassword(input.senha);
  const auditAfter = JSON.stringify({
    nome: input.nome,
    login: input.login,
    papel: "admin",
    ativo: false
  });
  const [insertResult] = await db.batch([
    db.prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) SELECT ?, NULL, ?, ?, ?, 'admin', 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE papel = 'admin' AND excluido_em IS NULL)"
    ).bind(id, input.nome, input.login, passwordHash, now, now),
    db.prepare(
      `INSERT INTO auditoria (
          id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id,
          agendamento_id, antes, depois, detalhes, criado_em
        )
        SELECT ?, NULL, 'admin_bootstrap_preparado', 'usuario', ?, NULL, NULL,
               NULL, NULL, ?, 'Primeiro administrador preparado.', ?
        WHERE EXISTS (
          SELECT 1
          FROM usuarios
          WHERE id = ?
            AND papel = 'admin'
            AND ativo = 0
            AND excluido_em IS NULL
        )`
    ).bind(auditId, id, auditAfter, now, id)
  ]);
  if (insertResult.meta.changes === 0) return null;
  return findUserById(db, id);
}
async function listUsers(db) {
  const result = await db.prepare(
    `SELECT ${USER_COLUMNS} FROM usuarios WHERE excluido_em IS NULL ORDER BY nome ASC`
  ).all();
  return result.results;
}
async function createUser(db, input, actorUserId) {
  if (input.papel === "conferente" && !input.lojaId) {
    throw new Error("LOJA_OBRIGATORIA");
  }
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const passwordHash = await hashPassword(input.senha);
  const lojaId = input.papel === "conferente" ? input.lojaId : null;
  const statements = [
    db.prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
    ).bind(
      id,
      lojaId,
      input.nome,
      input.login,
      passwordHash,
      input.papel,
      now,
      now
    )
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
        senhaAlterada: true
      },
      details: "Usu\xE1rio criado.",
      createdAt: now
    })
  );
  await db.batch(statements);
  return await findUserById(db, id);
}
async function updateUser(db, current, input, actorUserId) {
  const nome = input.nome ?? current.nome;
  const login = input.login ?? current.login;
  const papel = input.papel ?? current.papel;
  const ativo = input.ativo === void 0 ? current.ativo : input.ativo ? 1 : 0;
  const lojaId = papel === "conferente" ? input.lojaId ?? current.loja_id : null;
  if (papel === "conferente" && !lojaId) {
    throw new Error("LOJA_OBRIGATORIA");
  }
  const passwordHash = input.senha ? await hashPassword(input.senha) : current.senha_hash;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const statusChanged = input.ativo !== void 0 && input.ativo !== (current.ativo === 1);
  // Mudanças de identidade ou permissão exigem uma nova autenticação.
  const identityChanged = login !== current.login || papel !== current.papel || lojaId !== current.loja_id;
  const sessionVersion = current.session_version + (input.senha || statusChanged || identityChanged ? 1 : 0);
  const statements = [
    db.prepare(
      "UPDATE usuarios SET loja_id = ?, nome = ?, login = ?, senha_hash = ?, papel = ?, ativo = ?, session_version = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL"
    ).bind(
      lojaId,
      nome,
      login,
      passwordHash,
      papel,
      ativo,
      sessionVersion,
      now,
      current.id
    )
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
        ativo: current.ativo === 1
      },
      after: {
        nome,
        login,
        lojaId,
        papel,
        ativo: ativo === 1,
        senhaAlterada: Boolean(input.senha)
      },
      details: "Usu\xE1rio atualizado.",
      createdAt: now
    })
  );
  await db.batch(statements);
  return await findUserById(db, current.id);
}
async function softDeleteUser(db, current, actorUserId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const [result] = await db.batch([
    db.prepare(
      "UPDATE usuarios SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL"
    ).bind(now, now, current.id),
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
        ativo: current.ativo === 1
      },
      after: {
        nome: current.nome,
        login: current.login,
        lojaId: current.loja_id,
        papel: current.papel,
        ativo: false,
        removido: true
      },
      details: "Usu\xE1rio removido logicamente.",
      createdAt: now
    })
  ]);
  return result.meta.changes > 0;
}
export {
  createInactiveFirstAdmin,
  createUser,
  findUserById,
  findUserByLogin,
  hasAdmin,
  listUsers,
  softDeleteUser,
  updateUser,
  upgradeUserPasswordHash
};