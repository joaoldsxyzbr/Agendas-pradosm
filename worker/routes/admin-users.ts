import { Hono } from "hono";
import {
  CreateStoreUserInput,
  UpdateStoreUserInput,
} from "../../shared/api";
import type { AppEnv } from "../env";
import { findStoreById } from "../repositories/stores";
import {
  createStoreUser,
  findUserById,
  listStoreUsers,
  type UserRecord,
  updateStoreUser,
} from "../repositories/users";

export const adminUserRoutes = new Hono<AppEnv>();

function userJson(user: UserRecord) {
  return {
    id: user.id,
    nome: user.nome,
    login: user.login,
    perfil: user.perfil,
    lojaId: user.loja_id,
    ativo: user.ativo === 1,
  };
}

function isDuplicateLogin(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: usuarios.login")
  );
}

adminUserRoutes.get("/", async (c) => {
  const users = await listStoreUsers(c.env.DB);
  return c.json(users.map(userJson));
});

adminUserRoutes.post("/", async (c) => {
  const parsed = CreateStoreUserInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  const store = await findStoreById(c.env.DB, parsed.data.lojaId);
  if (!store) {
    return c.json({ error: "LOJA_NAO_ENCONTRADA", message: "Loja não encontrada." }, 400);
  }

  try {
    const user = await createStoreUser(c.env.DB, parsed.data);
    return c.json(userJson(user), 201);
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login já está em uso." },
        409,
      );
    }
    throw error;
  }
});

adminUserRoutes.patch("/", async (c) => {
  const parsed = UpdateStoreUserInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: "REQUISICAO_INVALIDA", message: "Dados inválidos." }, 400);
  }

  const current = await findUserById(c.env.DB, parsed.data.id);
  if (!current || current.perfil !== "loja") {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  if (parsed.data.lojaId) {
    const store = await findStoreById(c.env.DB, parsed.data.lojaId);
    if (!store) {
      return c.json(
        { error: "LOJA_NAO_ENCONTRADA", message: "Loja não encontrada." },
        400,
      );
    }
  }

  try {
    const user = await updateStoreUser(c.env.DB, current, parsed.data);
    return c.json(userJson(user));
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login já está em uso." },
        409,
      );
    }
    throw error;
  }
});
