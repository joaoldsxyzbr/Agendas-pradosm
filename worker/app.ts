import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";

export const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);

// Placeholder protegido até a implementação do CRUD administrativo na Task 4.
app.get("/api/admin/stores", requireAuth, requireAdmin, (c) => c.json([]));
