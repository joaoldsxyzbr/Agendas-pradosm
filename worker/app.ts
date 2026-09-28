import { Hono } from "hono";
import type { AppEnv } from "./env";
import {
  requireAdmin,
  requireAuth,
  restrictDashboardViewer,
} from "./middleware/auth";
import { businessDate } from "./lib/time";
import {
  apiSecurityHeaders,
  internalServerError,
  limitAgendaImportBody,
  validateMutationOrigin,
} from "./lib/http";
import {
  adminAgendaRoutes,
  adminAppointmentRoutes,
} from "./routes/admin-agendas";
import { adminAuditRoutes } from "./routes/admin-audit";
import { adminStoreRoutes } from "./routes/admin-stores";
import { adminUserRoutes } from "./routes/admin-users";
import { adminViewerRoutes } from "./routes/admin-viewers";
import { authRoutes } from "./routes/auth";
import {
  storeAgendaRoutes,
  storeAppointmentRoutes,
} from "./routes/store-agendas";

export const app = new Hono<AppEnv>();

async function closePastOpenAgendas(db: D1Database) {
  const today = businessDate();
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO auditoria (
          id, usuario_id, acao, entidade, entidade_id, loja_id, agenda_id,
          antes, depois, detalhes, criado_em
        )
        SELECT
          lower(hex(randomblob(16))), NULL, 'dia_concluido_automaticamente',
          'agenda', id, loja_id, id, '{"dayStatus":"aberto"}',
          '{"dayStatus":"concluido"}',
          'Dia concluído automaticamente após a virada da data operacional.', ?
        FROM agendas
        WHERE status_dia = 'aberto' AND data_agenda < ?`,
      )
      .bind(now, today),
    db
      .prepare(
        "UPDATE agendas SET status_dia = 'concluido', concluido_em = ?, concluido_por = NULL, atualizado_em = ? WHERE status_dia = 'aberto' AND data_agenda < ?",
      )
      .bind(now, now, today),
  ]);
}

app.use("/api/*", apiSecurityHeaders);

app.onError((error, c) => {
  console.error("Unhandled API error", error);
  return internalServerError(c);
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.use("/api/auth/bootstrap-register", validateMutationOrigin);
app.route("/api/auth", authRoutes);

app.use(
  "/api/admin/*",
  requireAuth,
  requireAdmin,
  restrictDashboardViewer,
  validateMutationOrigin,
);
app.use("/api/admin/agendas/import", limitAgendaImportBody);
app.use("/api/admin/agendas", async (c, next) => {
  await closePastOpenAgendas(c.env.DB);
  await next();
});
app.route("/api/admin/stores", adminStoreRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/admin/viewers", adminViewerRoutes);
app.route("/api/admin/agendas", adminAgendaRoutes);
app.route("/api/admin/appointments", adminAppointmentRoutes);
app.route("/api/admin/audit", adminAuditRoutes);

app.use("/api/store/*", requireAuth, validateMutationOrigin);
app.use("/api/store/today", async (c, next) => {
  await closePastOpenAgendas(c.env.DB);
  await next();
});
app.route("/api/store", storeAgendaRoutes);
app.route("/api/store/appointments", storeAppointmentRoutes);
