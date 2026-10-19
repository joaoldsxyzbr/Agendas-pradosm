import { Hono } from "hono";
import {
  requireAdmin,
  requireAuth,
  restrictDashboardViewer,
} from "./middleware/auth.js";
import {
  apiSecurityHeaders,
  internalServerError,
  limitAgendaImportBody,
  validateMutationOrigin,
} from "./lib/http.js";
import {
  adminAgendaRoutes,
  adminAppointmentRoutes,
} from "./routes/admin-agendas.js";
import { adminAuditRoutes } from "./routes/admin-audit.js";
import { adminStoreRoutes } from "./routes/admin-stores.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { authRoutes } from "./routes/auth.js";
import { realtimeRoutes } from "./routes/realtime.js";
import { adminPresenceRoutes, storePresenceRoutes } from "./routes/presence.js";
import {
  storeAgendaRoutes,
  storeAppointmentRoutes,
} from "./routes/store-agendas.js";
import { closePastOpenAgendas } from "./services/agenda-maintenance.js";

export const app = new Hono();

app.use("/api/*", apiSecurityHeaders);

app.onError((error, c) => {
  console.error("Unhandled API error", error);
  return internalServerError(c);
});

app.get("/api/health", async (c) => {
  try {
    const database = await c.env.DB.prepare("SELECT 1 AS ok").first();
    if (database?.ok !== 1) {
      throw new Error("D1 readiness query returned an unexpected result.");
    }

    return c.json({ ok: true, database: "ok" });
  } catch (error) {
    console.error("Health check failed", error);
    return c.json({ ok: false, database: "unavailable" }, 503);
  }
});
app.use("/api/auth/bootstrap-register", validateMutationOrigin);
app.route("/api/auth", authRoutes);

app.use("/api/realtime", requireAuth);
app.use("/api/realtime/*", requireAuth);
app.route("/api/realtime", realtimeRoutes);

app.use(
  "/api/admin/*",
  requireAuth,
  requireAdmin,
  restrictDashboardViewer,
  validateMutationOrigin,
);
app.use("/api/admin/agendas/import", limitAgendaImportBody);
app.use("/api/admin/agendas/import/bulk", limitAgendaImportBody);
app.use("/api/admin/agendas", async (c, next) => {
  await closePastOpenAgendas(c.env.DB);
  await next();
});
app.route("/api/admin/stores", adminStoreRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/admin/agendas", adminAgendaRoutes);
app.route("/api/admin/appointments", adminAppointmentRoutes);
app.route("/api/admin/audit", adminAuditRoutes);
app.route("/api/admin/presence", adminPresenceRoutes);

app.use("/api/store/*", requireAuth, validateMutationOrigin);
app.use("/api/store/today", async (c, next) => {
  await closePastOpenAgendas(c.env.DB);
  await next();
});
app.route("/api/store", storeAgendaRoutes);
app.route("/api/store/presence", storePresenceRoutes);
app.route("/api/store/appointments", storeAppointmentRoutes);