import { Hono } from "hono";
import { CreateStoreInput, UpdateStoreInput } from "../../shared/api";
import type { AppEnv } from "../env";
import {
  createStore,
  findStoreById,
  listStores,
  type StoreRecord,
  updateStore,
} from "../repositories/stores";

export const adminStoreRoutes = new Hono<AppEnv>();

function storeJson(store: StoreRecord) {
  return {
    id: store.id,
    codigo: store.codigo,
    nome: store.nome,
    ativo: store.ativo === 1,
    criadoEm: store.criado_em,
    atualizadoEm: store.atualizado_em,
  };
}

function isDuplicateCode(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: lojas.codigo")
  );
}

adminStoreRoutes.get("/", async (c) => {
  const stores = await listStores(c.env.DB);
  return c.json(stores.map(storeJson));
});

adminStoreRoutes.post("/", async (c) => {
  const parsed = CreateStoreInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  try {
    const store = await createStore(c.env.DB, parsed.data);
    return c.json(storeJson(store), 201);
  } catch (error) {
    if (isDuplicateCode(error)) {
      return c.json(
        { error: "CODIGO_LOJA_EM_USO", message: "Código de loja já está em uso." },
        409,
      );
    }
    throw error;
  }
});

adminStoreRoutes.patch("/", async (c) => {
  const parsed = UpdateStoreInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  const current = await findStoreById(c.env.DB, parsed.data.id);
  if (!current) {
    return c.json({ error: "LOJA_NAO_ENCONTRADA", message: "Loja não encontrada." }, 404);
  }

  try {
    const store = await updateStore(c.env.DB, current, parsed.data);
    return c.json(storeJson(store));
  } catch (error) {
    if (isDuplicateCode(error)) {
      return c.json(
        { error: "CODIGO_LOJA_EM_USO", message: "Código de loja já está em uso." },
        409,
      );
    }
    throw error;
  }
});
