import { Hono } from "hono";
import { z } from "zod";
import { CreateUserInput, UpdateUserInput } from "../../shared/api.js";
import { revokeRealtimeUser } from "../services/realtime.js";
import { findStoreById } from "../repositories/stores.js";
import {
  createUser,
  findUserById,
  listUsers,
  softDeleteUser,
  updateUser
} from "../repositories/users.js";
const adminUserRoutes = new Hono();
function userJson(user) {
  return {
    id: user.id,
    nome: user.nome,
    login: user.login,
    papel: user.papel,
    lojaId: user.loja_id,
    ativo: user.ativo === 1
  };
}
function isDuplicateLogin(error) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: usuarios.login");
}
function isLastAdmin(error) {
  return error instanceof Error && error.message.includes("ULTIMO_ADMIN_ATIVO");
}
async function validateStoreForRole(db, papel, lojaId) {
  if (papel !== "conferente") return { ok: true, lojaId: null };
  if (!lojaId) return { ok: false, reason: "required" };
  const store = await findStoreById(db, lojaId);
  if (!store) return { ok: false, reason: "missing" };
  return { ok: true, lojaId };
}
adminUserRoutes.get("/", async (c) => {
  const users = await listUsers(c.env.DB);
  return c.json(users.map(userJson));
});
adminUserRoutes.post("/", async (c) => {
  const parsed = CreateUserInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." },
      400
    );
  }
  const storeCheck = await validateStoreForRole(
    c.env.DB,
    parsed.data.papel,
    parsed.data.lojaId
  );
  if (!storeCheck.ok) {
    return c.json(
      {
        error: storeCheck.reason === "missing" ? "LOJA_NAO_ENCONTRADA" : "LOJA_OBRIGATORIA",
        message: storeCheck.reason === "missing" ? "Loja n\xE3o encontrada." : "Loja \xE9 obrigat\xF3ria para conferente."
      },
      400
    );
  }
  try {
    const actor = c.get("authUser");
    const user = await createUser(
      c.env.DB,
      {
        ...parsed.data,
        lojaId: storeCheck.lojaId ?? void 0
      },
      actor.id
    );
    return c.json(userJson(user), 201);
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login j\xE1 est\xE1 em uso." },
        409
      );
    }
    throw error;
  }
});
adminUserRoutes.patch("/", async (c) => {
  const parsed = UpdateUserInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inv\xE1lidos." },
      400
    );
  }
  const current = await findUserById(c.env.DB, parsed.data.id);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usu\xE1rio n\xE3o encontrado." },
      404
    );
  }
  const papel = parsed.data.papel ?? current.papel;
  const requestedStore = papel === "conferente" ? parsed.data.lojaId ?? current.loja_id : null;
  const storeCheck = await validateStoreForRole(
    c.env.DB,
    papel,
    requestedStore
  );
  if (!storeCheck.ok) {
    return c.json(
      {
        error: storeCheck.reason === "missing" ? "LOJA_NAO_ENCONTRADA" : "LOJA_OBRIGATORIA",
        message: storeCheck.reason === "missing" ? "Loja n\xE3o encontrada." : "Loja \xE9 obrigat\xF3ria para conferente."
      },
      400
    );
  }
  try {
    const actor = c.get("authUser");
    const user = await updateUser(
      c.env.DB,
      current,
      {
        ...parsed.data,
        papel,
        lojaId: storeCheck.lojaId ?? void 0
      },
      actor.id
    );
    const sessionInvalidated = Boolean(parsed.data.senha) || current.ativo === 1 && user.ativo !== 1;
    const realtimeIdentityChanged = current.papel !== user.papel || current.loja_id !== user.loja_id;
    if (sessionInvalidated) {
      await revokeRealtimeUser(c.env, current.id, "terminate");
    } else if (realtimeIdentityChanged) {
      await revokeRealtimeUser(c.env, current.id, "refresh");
    }
    return c.json(userJson(user));
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login j\xE1 est\xE1 em uso." },
        409
      );
    }
    if (isLastAdmin(error)) {
      return c.json(
        {
          error: "ULTIMO_ADMIN_ATIVO",
          message: "\xC9 necess\xE1rio manter pelo menos um administrador ativo."
        },
        409
      );
    }
    throw error;
  }
});
adminUserRoutes.delete("/:id", async (c) => {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Usu\xE1rio inv\xE1lido." },
      400
    );
  }
  const current = await findUserById(c.env.DB, parsedId.data);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usu\xE1rio n\xE3o encontrado." },
      404
    );
  }
  try {
    const actor = c.get("authUser");
    const deleted = await softDeleteUser(c.env.DB, current, actor.id);
    if (deleted) {
      await revokeRealtimeUser(c.env, current.id);
    }
    if (!deleted) {
      return c.json(
        { error: "USUARIO_NAO_ENCONTRADO", message: "Usu\xE1rio n\xE3o encontrado." },
        404
      );
    }
  } catch (error) {
    if (isLastAdmin(error)) {
      return c.json(
        {
          error: "ULTIMO_ADMIN_ATIVO",
          message: "\xC9 necess\xE1rio manter pelo menos um administrador ativo."
        },
        409
      );
    }
    throw error;
  }
  return c.body(null, 204);
});
export {
  adminUserRoutes
};