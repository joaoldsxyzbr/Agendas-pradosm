import type { AppEnv } from "../env.ts";
import { Hono } from "hono";
import { auditStatement } from "../repositories/audit.ts";
import { publicarAvisoSchema } from "../../shared/avisos.ts";
import {
  avisoJson,
  inativarAvisoStatement,
  listActiveAvisos,
  markAvisoLido,
  publishAvisoStatement
} from "../repositories/avisos.ts";

// Rotas de avisos/notificações in-app (spec 2026-11-11).
// - /api/avisos: qualquer papel autenticado lê e marca os próprios avisos
//   como lidos. O visualizador (dashboard) usa só estas rotas.
// - /api/admin/avisos: publicação e inativação, exclusivas do admin
//   (a cadeia /api/admin/* já exige requireAuth + requireAdmin).

const avisoRoutes = new Hono<AppEnv>();
const adminAvisoRoutes = new Hono<AppEnv>();

avisoRoutes.get("/", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const { avisos, naoLidos } = await listActiveAvisos(c.env.DB, user.id, new Date().toISOString());
  return c.json({ avisos: avisos.map(avisoJson), naoLidos });
});

avisoRoutes.post("/:id/lido", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const id = c.req.param("id");
  const inserted = await markAvisoLido(c.env.DB, id, user.id, new Date().toISOString());
  if (!inserted) {
    // Idempotente: já lido OU aviso inexistente/inativo. A resposta é a
    // mesma para não vazar existência de aviso fora da lista ativa.
    return c.json({ ok: true, jaLido: true });
  }
  return c.json({ ok: true, jaLido: false });
});

adminAvisoRoutes.post("/", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const parsed = publicarAvisoSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: parsed.error.issues[0]?.message ?? "Verifique os dados do aviso." },
      400
    );
  }
  const now = new Date().toISOString();
  const avisoId = crypto.randomUUID();
  const statements = [
    publishAvisoStatement(c.env.DB, {
      id: avisoId,
      titulo: parsed.data.titulo,
      mensagem: parsed.data.mensagem,
      criadoPor: user.id,
      criadoEm: now,
      expiraEm: parsed.data.expiraEm ?? null
    }),
    auditStatement(c.env.DB, {
      userId: user.id,
      action: "aviso_publicado",
      entity: "aviso",
      entityId: avisoId,
      after: {
        titulo: parsed.data.titulo,
        mensagem: parsed.data.mensagem,
        expiraEm: parsed.data.expiraEm ?? null
      },
      details: "Aviso publicado para os usuários do sistema.",
      createdAt: now
    })
  ];
  await c.env.DB.batch(statements);
  return c.json(
    {
      id: avisoId,
      titulo: parsed.data.titulo,
      mensagem: parsed.data.mensagem,
      expiraEm: parsed.data.expiraEm ?? null
    },
    201
  );
});

adminAvisoRoutes.post("/:id/inativar", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const id = c.req.param("id");
  const now = new Date().toISOString();
  const auditId = crypto.randomUUID();
  const result = await c.env.DB.batch([
    inativarAvisoStatement(c.env.DB, { avisoId: id, now }),
    auditStatement(c.env.DB, {
      id: auditId,
      onlyIfPreviousWrite: true,
      userId: user.id,
      action: "aviso_inativado",
      entity: "aviso",
      entityId: id,
      details: "Aviso removido da lista de avisos ativos.",
      createdAt: now
    })
  ]);
  const inativou = result[0]?.meta?.changes === 1;
  if (!inativou) {
    return c.json(
      { error: "AVISO_NAO_ENCONTRADO", message: "Aviso não encontrado ou já inativado." },
      404
    );
  }
  return c.json({ ok: true });
});

export { avisoRoutes, adminAvisoRoutes };
