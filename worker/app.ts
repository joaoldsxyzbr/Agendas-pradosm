import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requireAdmin, requireAuth } from "./middleware/auth";
import {
  adminAgendaRoutes,
  adminAppointmentRoutes,
} from "./routes/admin-agendas";
import { adminStoreRoutes } from "./routes/admin-stores";
import { adminUserRoutes } from "./routes/admin-users";
import { authRoutes } from "./routes/auth";

export const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);

app.use("/api/admin/*", requireAuth, requireAdmin);
app.route("/api/admin/stores", adminStoreRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/admin/agendas", adminAgendaRoutes);
app.route("/api/admin/appointments", adminAppointmentRoutes);
