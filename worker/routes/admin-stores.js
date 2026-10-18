import { Hono } from "hono";
import { z } from "zod";
import { CreateStoreInput, UpdateStoreInput } from "../../shared/api.js";
import {
  createStore,
  findStoreById,
  hasStoreUsers,
  listStores,
  softDeleteStore,
  updateStore
} from "../repositories/stores.js";
const adminStoreRoutes = new Hono();
function storeJson(store) {
  return {
    id: store.id,
    codigo: store.codigo,
    nome: store.nome,
    ativo: store.ativo === 1,
    temConferenteAtivo: store.tem_conferente_ativo === 1,
    criadoEm: store.criado_em,
    atualizadoEm: store.atualizado_em
  };
}
function isDuplicateCode(error) {
  return error instanceof Error && (error.message.includes("UNIQUE constraint failed: lojas.codigo") || error.message.includes("idx_lojas_codigo_nocase"));
}
adminStoreRoutes.get("/", async (c) => {
  const stores = await listStores(c.env.DB);
  return c.json(stores.map(storeJson));
});
adminStoreRoutes.post("/", async (c) => {
  const parsed = CreateStoreInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." }, 400);
  }
  try {
    const actor = c.get("authUser");
    const store = await createStore(c.env.DB, parsed.data, actor.id);
    return c.json(storeJson(store), 201);
  } catch (error) {
    if (isDuplicateCode(error)) {
      return c.json(
        { error: "CODIGO_LOJA_EM_USO", message: "C\xF3digo de loja j\xE1 est\xE1 em uso." },
        409
      );
    }
    throw error;
  }
});
adminStoreRoutes.patch("/", async (c) => {
  const parsed = UpdateStoreInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." }, 400);
  }
  const current = await findStoreById(c.env.DB, parsed.data.id);
  if (!current) {
    return c.json({ error: "LOJA_NAO_ENCONTRADA", message: "Loja n\xE3o encontrada." }, 404);
  }
  try {
    const actor = c.get("authUser");
    const store = await updateStore(c.env.DB, current, parsed.data, actor.id);
    return c.json(storeJson(store));
  } catch (error) {
    if (isDuplicateCode(error)) {
      return c.json(
        { error: "CODIGO_LOJA_EM_USO", message: "C\xF3digo de loja j\xE1 est\xE1 em uso." },
        409
      );
    }
    throw error;
  }
});
adminStoreRoutes.delete("/:id", async (c) => {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Loja inv\xE1lida." },
      400
    );
  }
  const current = await findStoreById(c.env.DB, parsedId.data);
  if (!current) {
    return c.json(
      { error: "LOJA_NAO_ENCONTRADA", message: "Loja n\xE3o encontrada." },
      404
    );
  }
  if (await hasStoreUsers(c.env.DB, current.id)) {
    return c.json(
      {
        error: "LOJA_POSSUI_USUARIOS",
        message: "Mova ou exclua os usu\xE1rios vinculados antes de excluir a loja."
      },
      409
    );
  }
  const actor = c.get("authUser");
  const deleted = await softDeleteStore(c.env.DB, current, actor.id);
  if (!deleted) {
    return c.json(
      { error: "LOJA_NAO_ENCONTRADA", message: "Loja n\xE3o encontrada." },
      404
    );
  }
  return c.body(null, 204);
});
export {
  adminStoreRoutes
};