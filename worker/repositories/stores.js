import { auditStatement } from "./audit.js";
const STORE_COLUMNS = "id, codigo, nome, ativo, excluido_em, criado_em, atualizado_em, CASE WHEN EXISTS (SELECT 1 FROM usuarios u WHERE u.loja_id = lojas.id AND u.papel = 'conferente' AND u.ativo = 1 AND u.excluido_em IS NULL) THEN 1 ELSE 0 END AS tem_conferente_ativo";
async function listStores(db) {
  const result = await db.prepare(
    `SELECT ${STORE_COLUMNS} FROM lojas WHERE excluido_em IS NULL ORDER BY codigo ASC`
  ).all();
  return result.results;
}
async function findStoreById(db, id) {
  return db.prepare(
    `SELECT ${STORE_COLUMNS} FROM lojas WHERE id = ? AND excluido_em IS NULL LIMIT 1`
  ).bind(id).first();
}
async function findActiveStoreById(db, id) {
  return db.prepare(
    `SELECT ${STORE_COLUMNS} FROM lojas WHERE id = ? AND ativo = 1 AND excluido_em IS NULL LIMIT 1`
  ).bind(id).first();
}
async function createStore(db, input, actorUserId) {
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.batch([
    db.prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)"
    ).bind(id, input.codigo, input.nome, now, now),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_criada",
      entity: "loja",
      entityId: id,
      storeId: id,
      after: {
        codigo: input.codigo,
        nome: input.nome,
        ativo: true
      },
      details: "Loja criada.",
      createdAt: now
    })
  ]);
  return await findStoreById(db, id);
}
async function updateStore(db, current, input, actorUserId) {
  const codigo = input.codigo ?? current.codigo;
  const nome = input.nome ?? current.nome;
  const ativo = input.ativo === void 0 ? current.ativo : input.ativo ? 1 : 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.batch([
    db.prepare(
      "UPDATE lojas SET codigo = ?, nome = ?, ativo = ?, atualizado_em = ? WHERE id = ?"
    ).bind(codigo, nome, ativo, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_atualizada",
      entity: "loja",
      entityId: current.id,
      storeId: current.id,
      before: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: current.ativo === 1
      },
      after: {
        codigo,
        nome,
        ativo: ativo === 1
      },
      details: "Loja atualizada.",
      createdAt: now
    })
  ]);
  return await findStoreById(db, current.id);
}
async function hasStoreUsers(db, storeId) {
  const result = await db.prepare(
    "SELECT 1 AS presente FROM usuarios WHERE loja_id = ? AND papel = 'conferente' AND excluido_em IS NULL LIMIT 1"
  ).bind(storeId).first();
  return result !== null;
}
async function softDeleteStore(db, current, actorUserId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const [result] = await db.batch([
    db.prepare(
      "UPDATE lojas SET ativo = 0, excluido_em = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL"
    ).bind(now, now, current.id),
    auditStatement(db, {
      userId: actorUserId,
      action: "loja_removida",
      entity: "loja",
      entityId: current.id,
      storeId: current.id,
      before: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: current.ativo === 1
      },
      after: {
        codigo: current.codigo,
        nome: current.nome,
        ativo: false,
        removida: true
      },
      details: "Loja removida logicamente.",
      createdAt: now
    })
  ]);
  return result.meta.changes > 0;
}
export {
  createStore,
  findActiveStoreById,
  findStoreById,
  hasStoreUsers,
  listStores,
  softDeleteStore,
  updateStore
};