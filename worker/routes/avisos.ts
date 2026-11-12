import type { AppEnv } from "../env.ts";
import { Hono } from "hono";
import { auditStatement } from "../repositories/audit.ts";
import { publicarAvisoSchema } from "../../shared/avisos.ts";
import {
  avisoJson,
  listAvisos,
  markAvisoLido,
  markTodosAvisosLidos,
  publishAvisoStatements
} from "../repositories/avisos.ts";

// Rotas de avisos/notificações in-app (spec 2026-11-11, melhorias de 12/11).
// - /api/avisos: qualquer papel autenticado lê e marca os próprios avisos
//   como lidos. O visualizador (dashboard) usa só estas rotas. Avisos são
//   registro permanente: a lista é o histórico completo (mais recentes
//   primeiro) e ninguém publica/exclui por aqui.
// - /api/admin/avisos: publicação exclusiva do admin (a cadeia /api/admin/*
//   já exige requireAuth + requireAdmin). Não existe inativação/exclusão.
// - Visibilidade (decisão de 12/11/2026): o conferente recebe apenas os
//   avisos publicados pelo admin; eventos automáticos do sistema são do
//   admin/gerente (visualizador).

const avisoRoutes = new Hono<AppEnv>();
const adminAvisoRoutes = new Hono<AppEnv>();

// Conferente vê os avisos da sua loja (e os de todas) e nenhum evento; os
// demais papéis, sem loja, veem tudo (avisos e eventos).
function lojaDoUsuario(user) {
  return user.papel === "conferente" ? user.lojaCodigo : null;
}

function verEventosDoUsuario(user) {
  return user.papel !== "conferente";
}

avisoRoutes.get("/", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const { avisos, naoLidos } = await listAvisos(c.env.DB, user.id, lojaDoUsuario(user), verEventosDoUsuario(user));
  return c.json({ avisos: avisos.map(avisoJson), naoLidos });
});

avisoRoutes.post("/:id/lido", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const id = c.req.param("id");
  const inserted = await markAvisoLido(c.env.DB, id, user.id, new Date().toISOString());
  if (!inserted) {
    // Idempotente: já lido OU aviso inexistente. A resposta é a mesma para
    // não vazar existência de aviso fora do que o usuário enxerga.
    return c.json({ ok: true, jaLido: true });
  }
  return c.json({ ok: true, jaLido: false });
});

// "Marcar todos": grava a leitura de todos os avisos visíveis ao usuário.
avisoRoutes.post("/marcar-todos", async (c) => {
  const user = c.get("authUser");
  if (!user) return c.json({ error: "NAO_AUTENTICADO", message: "Sessão inválida ou expirada." }, 401);
  const marcados = await markTodosAvisosLidos(
    c.env.DB,
    user.id,
    new Date().toISOString(),
    lojaDoUsuario(user),
    verEventosDoUsuario(user)
  );
  return c.json({ ok: true, marcados });
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
  const { titulo, mensagem, urgente } = parsed.data;
  const lojas = parsed.data.lojas ? [...new Set(parsed.data.lojas)] : null;
  // Direcionamento só para lojas ativas e existentes.
  if (lojas) {
    const rows = await c.env.DB.prepare(
      "SELECT codigo FROM lojas WHERE ativo = 1 AND excluido_em IS NULL"
    ).all();
    const validas = new Set((rows.results ?? []).map((row) => row.codigo));
    if (lojas.some((loja) => !validas.has(loja))) {
      return c.json(
        { error: "LOJAS_INVALIDAS", message: "Alguma loja escolhida não existe ou está inativa." },
        400
      );
    }
  }
  const now = new Date().toISOString();
  const avisoId = crypto.randomUUID();
  const statements = [
    ...publishAvisoStatements(c.env.DB, {
      id: avisoId,
      titulo,
      mensagem,
      criadoPor: user.id,
      autor: user.nome,
      criadoEm: now,
      urgente,
      lojas
    }),
    auditStatement(c.env.DB, {
      userId: user.id,
      action: "aviso_publicado",
      entity: "aviso",
      entityId: avisoId,
      after: { titulo, mensagem, urgente, lojas },
      details: lojas
        ? `Aviso publicado para as lojas ${lojas.join(", ")}.`
        : "Aviso publicado para todas as lojas.",
      createdAt: now
    })
  ];
  await c.env.DB.batch(statements);
  // Resposta é o aviso completo (avisoSchema): o frontend faz parse dela.
  // Divergir aqui fazia o admin ver erro com o aviso já criado (bug corrigido
  // em revisão — o mock de E2E era fiel ao schema, não à rota).
  return c.json(
    avisoJson({
      id: avisoId,
      tipo: "aviso",
      titulo,
      mensagem,
      criado_em: now,
      urgente: urgente ? 1 : 0,
      autor: user.nome,
      lojas: lojas ? lojas.join(",") : null,
      lido: 0
    }),
    201
  );
});

export { avisoRoutes, adminAvisoRoutes };
