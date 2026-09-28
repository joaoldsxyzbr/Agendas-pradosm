import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import {
  createDashboardViewer,
  findDashboardViewerById,
  listDashboardViewers,
  softDeleteDashboardViewer,
  updateDashboardViewer,
} from "../repositories/viewers";

export const adminViewerRoutes = new Hono<AppEnv>();

const CreateViewerInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(8).max(200),
});

const UpdateViewerInput = z
  .object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    login: z.string().trim().min(3).max(100).optional(),
    senha: z.string().min(8).max(200).optional(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.nome !== undefined ||
      value.login !== undefined ||
      value.senha !== undefined ||
      value.ativo !== undefined,
    { message: "Nenhuma alteração informada." },
  );

function viewerJson(viewer: {
  id: string;
  nome: string;
  login: string;
  ativo: number;
}) {
  return {
    id: viewer.id,
    nome: viewer.nome,
    login: viewer.login,
    perfil: "visualizador" as const,
    lojaId: null,
    ativo: viewer.ativo === 1,
  };
}

function isDuplicateLogin(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: usuarios.login")
  );
}

adminViewerRoutes.get("/", async (c) => {
  const viewers = await listDashboardViewers(c.env.DB);
  return c.json(viewers.map(viewerJson));
});

adminViewerRoutes.post("/", async (c) => {
  const parsed = CreateViewerInput.safeParse(
    await c.req.json().catch(() => null),
  );

  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inválidos." },
      400,
    );
  }

  try {
    const actor = c.get("authUser");
    const viewer = await createDashboardViewer(
      c.env.DB,
      parsed.data,
      actor.id,
    );
    return c.json(viewerJson(viewer), 201);
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

adminViewerRoutes.patch("/", async (c) => {
  const parsed = UpdateViewerInput.safeParse(
    await c.req.json().catch(() => null),
  );

  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados inválidos." },
      400,
    );
  }

  const current = await findDashboardViewerById(c.env.DB, parsed.data.id);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  try {
    const actor = c.get("authUser");
    const viewer = await updateDashboardViewer(
      c.env.DB,
      current,
      parsed.data,
      actor.id,
    );
    return c.json(viewerJson(viewer));
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

adminViewerRoutes.delete("/:id", async (c) => {
  const parsedId = z.string().uuid().safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Usuário inválido." },
      400,
    );
  }

  const current = await findDashboardViewerById(c.env.DB, parsedId.data);
  if (!current) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  const actor = c.get("authUser");
  const deleted = await softDeleteDashboardViewer(
    c.env.DB,
    current,
    actor.id,
  );

  if (!deleted) {
    return c.json(
      { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário não encontrado." },
      404,
    );
  }

  return c.body(null, 204);
});
