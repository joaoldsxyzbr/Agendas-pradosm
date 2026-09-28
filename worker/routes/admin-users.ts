import { Hono } from "hono";
import { z } from "zod";
import { CreateUserInput, UpdateUserInput } from "../../shared/api";
import type { UserRole } from "../../shared/auth";
import type { AppEnv } from "../env";
import { findStoreById } from "../repositories/stores";
import {
  createUser,
  findUserById,
  listUsers,
  softDeleteUser,
  type UserRecord,
  updateUser,
} from "../repositories/users";

export const adminUserRoutes = new Hono<AppEnv>();

function userJson(user: UserRecord) {
  return {
    id: user.id,
    nome: user.nome,
    login: user.login,
    papel: user.papel,
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

function isLastAdmin(error: unknown) {
  return error instanceof Error && error.message.includes("ULTIMO_ADMIN_ATIVO");
}

async function validateStoreForRole(
  db: D1Database,
  papel: UserRole,
  lojaId: string | null | undefined,
) {
  if (papel !== "conferente") return { ok: true as const, lojaId: null };
  if (!lojaId) return { ok: false as const, reason: "required" as const };

  const store = await findStoreById(db, lojaId);
  if (!store) return { ok: false as const, reason: "missing" as const };
  return { ok: true as const, lojaId };
}

adminUserRoutes.get("/", async (c) => {
  const users = await listUsers(c.env.DB);
  return c.json(users.map(userJson));
});

adminUserRoutes.post("/", async (c) => {
  const parsed = CreateUserInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inválidos." },
      400,
    );
  }

  const storeCheck = await validateStoreForRole(
    c.env.DB,
    parsed.data.papel,
    parsed.data.lojaId,
  );
  if (!storeCheck.ok) {
    return c.json(
      {
        error:
          storeCheck.reason === "missing"
            ? "LOJA_NAO_ENCONTRADA"
            : "LOJA_OBRIGATORIA",
        message:
          storeCheck.reason === "missing"
            ? "Loja não encontrada."
            : "Loja é obrigatória para conferente.",
      },
      400,
    );
  }

  try {
    const actor = c.get("authUser");
    const user = await createUser(
      c.env.DB,
      {
        ...parsed.data,
        lojaId: storeCheck.lojaId ?? undefined,
      },
      actor.id,
    );
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
  const parsed = UpdateUserInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inválidos." },
      400,
    );
  }

  const current = await findUserById(c.env.DB, parsed.data.id);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  const papel = parsed.data.papel ?? current.papel;
  const requestedStore =
    papel === "conferente"
      ? (parsed.data.lojaId ?? current.loja_id)
      : null;
  const storeCheck = await validateStoreForRole(
    c.env.DB,
    papel,
    requestedStore,
  );

  if (!storeCheck.ok) {
    return c.json(
      {
        error:
          storeCheck.reason === "missing"
            ? "LOJA_NAO_ENCONTRADA"
            : "LOJA_OBRIGATORIA",
        message:
          storeCheck.reason === "missing"
            ? "Loja não encontrada."
            : "Loja é obrigatória para conferente.",
      },
      400,
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
        lojaId: storeCheck.lojaId ?? undefined,
      },
      actor.id,
    );
    return c.json(userJson(user));
  } catch (error) {
    if (isDuplicateLogin(error)) {
      return c.json(
        { error: "LOGIN_EM_USO", message: "Login já está em uso." },
        409,
      );
    }
    if (isLastAdmin(error)) {
      return c.json(
        {
          error: "ULTIMO_ADMIN_ATIVO",
          message: "É necessário manter pelo menos um administrador ativo.",
        },
        409,
      );
    }
    throw error;
  }
});

adminUserRoutes.delete("/:id", async (c) => {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Usuário inválido." },
      400,
    );
  }

  const current = await findUserById(c.env.DB, parsedId.data);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  try {
    const actor = c.get("authUser");
    const deleted = await softDeleteUser(c.env.DB, current, actor.id);
    if (!deleted) {
      return c.json(
        { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
        404,
      );
    }
  } catch (error) {
    if (isLastAdmin(error)) {
      return c.json(
        {
          error: "ULTIMO_ADMIN_ATIVO",
          message: "É necessário manter pelo menos um administrador ativo.",
        },
        409,
      );
    }
    throw error;
  }

  return c.body(null, 204);
});
