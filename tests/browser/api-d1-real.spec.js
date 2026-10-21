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

const importAgenda = ({ date, storeCode = "F05", replace = false, supplier = "Fornecedor Sintético" }) => ({
  storeCode,
  date,
  originalFileName: "agenda-sintetica-e2e.csv",
  replace,
  appointments: [{
    protocol: "987654320001",
    startTime: "09:00",
    endTime: "10:00",
    supplier,
    items: 2,
    volumes: 3,
    pallets: 1,
    cargaBatida: null,
    type: "Nota fiscal",
    nfe: ["12345"],
    orders: ["67890"]
  }]
});
async function postImport(request, user, agendas) {
  return request.post("/api/admin/agendas/import/bulk", {
    headers: { ...await auth(user), Origin: "http://127.0.0.1:8789" },
    data: { agendas }
  });
}

test("Importação real em D1 local grava, exige confirmação e preserva status ao substituir", async ({ request }) => {
  const date = "2038-04-06";
  const original = importAgenda({ date });
  expect((await postImport(request, "viewer", [original])).status()).toBe(403);
  const created = await postImport(request, "admin", [original]);
  expect(created.status()).toBe(201);
  const summary = await created.json();
  expect(summary.totalAgendas).toBe(1);
  expect(summary.totalAppointments).toBe(1);
  const agendaId = summary.agendas[0].agendaId;

  const agendas = await request.get("/api/admin/agendas?date=" + date, { headers: await auth("admin") });
  expect(agendas.status()).toBe(200);
  expect((await agendas.json()).find(a=>a.id===agendaId)?.total).toBe(1);

  const conflict = await postImport(request, "admin", [original]);
  expect(conflict.status()).toBe(409);

  const firstDetail = await request.get("/api/admin/agendas/" + agendaId, { headers: await auth("admin") });
  expect(firstDetail.status()).toBe(200);
  const appointmentId = (await firstDetail.json()).appointments[0].id;
  const statusUpdated = await request.patch("/api/admin/appointments/" + appointmentId + "/status", {
    headers: { ...await auth("admin"), Origin: "http://127.0.0.1:8789" },
    data: { status: "recebido", observation: null }
  });
  expect(statusUpdated.status()).toBe(200);

  const replacement = await postImport(request, "admin", [
    importAgenda({ date, replace: true, supplier: "Fornecedor Atualizado" })
  ]);
  expect(replacement.status()).toBe(200);
  const details = await request.get("/api/admin/agendas/" + agendaId, { headers: await auth("admin") });
  expect(details.status()).toBe(200);
  const rows = (await details.json()).appointments;
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(appointmentId);
  expect(rows[0].status).toBe("recebido");
  expect(rows[0].supplier).toBe("Fornecedor Atualizado");

  const history = await request.get("/api/admin/appointments/" + appointmentId + "/history", { headers: await auth("admin") });
  expect(history.status()).toBe(200);
  expect((await history.json()).some(h=>h.statusNovo==="recebido")).toBe(true);
});

test("Lote com loja não cadastrada rejeita tudo sem gravação parcial", async ({ request }) => {
  const date = "2038-04-07";
  const result = await postImport(request, "admin", [
    importAgenda({ date }),
    importAgenda({ date, storeCode: "F99" })
  ]);
  expect(result.status()).toBe(422);
  const agendas = await request.get("/api/admin/agendas?date=" + date, { headers: await auth("admin") });
  expect(agendas.status()).toBe(200);
  expect(await agendas.json()).toEqual([]);
});
