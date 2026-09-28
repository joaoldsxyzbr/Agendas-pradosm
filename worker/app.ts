import { Hono } from "hono";
import type { AppEnv } from "./env";
import {
  requireAdmin,
  requireAuth,
  restrictDashboardViewer,
} from "./middleware/auth";
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
import { authRoutes } from "./routes/auth";
import {
  storeAgendaRoutes,
  storeAppointmentRoutes,
} from "./routes/store-agendas";
import { closePastOpenAgendas } from "./services/agenda-maintenance";

export const app = new Hono<AppEnv>();

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
