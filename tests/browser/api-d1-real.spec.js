import { test, expect } from "@playwright/test";
import { createSessionToken } from "../../worker/lib/session.js";

// Sem interceptação: Worker e D1 locais com dados sintéticos do seed E2E.
const SECRET = "agendas-prado-migracao-e2e-somente-local";
const ids = {
  admin: "20000000-0000-4000-8000-000000000001",
  viewer: "20000000-0000-4000-8000-000000000002",
  clerk: "20000000-0000-4000-8000-000000000003",
  appointment: "40000000-0000-4000-8000-000000000001"
};
async function auth(user) {
  return { Cookie: "agenda_session=" + await createSessionToken(ids[user], 1, SECRET) };
}

test("Worker real confirma saúde do D1 local migrado", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true, database: "ok" });
});

test("API real respeita os três perfis e a loja do conferente", async ({ request }) => {
  const users = await request.get("/api/admin/users", { headers: await auth("admin") });
  expect(users.status()).toBe(200);
  expect((await users.json()).length).toBeGreaterThanOrEqual(3);
  expect((await request.get("/api/admin/users", { headers: await auth("viewer") })).status()).toBe(403);
  expect((await request.get("/api/admin/users", { headers: await auth("clerk") })).status()).toBe(403);
  expect((await request.get("/api/admin/stores", { headers: await auth("viewer") })).status()).toBe(200);
  expect((await request.get("/api/store/history", { headers: await auth("viewer") })).status()).toBe(403);
  const history = await request.get("/api/store/history", { headers: await auth("clerk") });
  expect(history.status()).toBe(200);
  const rows = await history.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].storeCode).toBe("F05");
  expect(rows[0].dayStatus).toBe("concluido");
});

test("Dia concluído impede escrita na API real e preserva status", async ({ request }) => {
  const path = "/api/store/appointments/" + ids.appointment;
  const response = await request.patch(path + "/status", {
    headers: { ...await auth("clerk"), Origin: "http://127.0.0.1:8789" },
    data: { status: "aguardando" }
  });
  expect(response.status()).toBe(409);
  const appointment = await request.get(path, { headers: await auth("clerk") });
  expect(appointment.status()).toBe(200);
  expect((await appointment.json()).status).toBe("recebido");
});
