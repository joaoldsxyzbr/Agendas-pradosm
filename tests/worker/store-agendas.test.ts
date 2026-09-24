import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";
import { businessDate } from "../../worker/lib/time";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$600000$AAECAwQFBgcICQoLDA0ODw==$mjQnW0x82GJVUIdErtKLjhrDkQnpSUvwhVvXx4B1L3M=";
const now = "2026-09-24T12:00:00.000Z";

async function seedStoreUser(input: {
  storeId: string;
  storeCode: string;
  userId: string;
}) {
  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(
      input.storeId,
      input.storeCode,
      `Loja ${input.storeCode}`,
      now,
      now,
    )
    .run();

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'loja', 1, ?, ?)",
    )
    .bind(
      input.userId,
      input.storeId,
      `Usuário ${input.userId}`,
      `login-${input.userId}`,
      passwordHash,
      now,
      now,
    )
    .run();

  const token = await createSessionToken(input.userId, sessionSecret);
  return `agenda_session=${token}`;
}

async function seedAgenda(input: {
  agendaId: string;
  storeId: string;
  creatorId: string;
  date: string;
}) {
  await db
    .prepare(
      "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, 'agenda.pdf', ?, ?, ?)",
    )
    .bind(
      input.agendaId,
      input.storeId,
      input.date,
      input.creatorId,
      now,
      now,
    )
    .run();
}

async function seedAppointment(input: {
  id: string;
  agendaId: string;
  protocol: string;
  startTime: string;
  status?: string;
}) {
  await db
    .prepare(
      "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, '23:59', ?, 1, 1, 0, NULL, 'Pedido', '[]', '[\"50001\"]', ?, 1, ?, ?)",
    )
    .bind(
      input.id,
      input.agendaId,
      input.protocol,
      input.startTime,
      `Fornecedor ${input.protocol}`,
      input.status ?? "aguardando",
      now,
      now,
    )
    .run();
}

function request(
  url: string,
  cookie: string,
  init: { method?: string; body?: unknown } = {},
) {
  return exports.default.fetch(
    new Request(`https://example.com${url}`, {
      method: init.method ?? "GET",
      headers: {
        Cookie: cookie,
        ...(init.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

describe("businessDate", () => {
  it("usa America/Sao_Paulo perto da meia-noite UTC", () => {
    expect(businessDate(new Date("2026-09-25T02:30:00.000Z"))).toBe(
      "2026-09-24",
    );
    expect(businessDate(new Date("2026-09-25T03:30:00.000Z"))).toBe(
      "2026-09-25",
    );
  });
});

describe("store agenda workflow", () => {
  it("loja vê somente a própria agenda de hoje e agendamentos ordenados", async () => {
    const today = businessDate(new Date());
    const cookieA = await seedStoreUser({
      storeId: "store-today-a",
      storeCode: "F71",
      userId: "user-today-a",
    });
    await seedStoreUser({
      storeId: "store-today-b",
      storeCode: "F72",
      userId: "user-today-b",
    });

    await seedAgenda({
      agendaId: "agenda-today-a",
      storeId: "store-today-a",
      creatorId: "user-today-a",
      date: today,
    });
    await seedAgenda({
      agendaId: "agenda-today-b",
      storeId: "store-today-b",
      creatorId: "user-today-b",
      date: today,
    });

    await seedAppointment({
      id: "appt-a-late",
      agendaId: "agenda-today-a",
      protocol: "91000002",
      startTime: "10:00",
    });
    await seedAppointment({
      id: "appt-a-early",
      agendaId: "agenda-today-a",
      protocol: "91000001",
      startTime: "08:00",
    });
    await seedAppointment({
      id: "appt-b",
      agendaId: "agenda-today-b",
      protocol: "92000001",
      startTime: "07:00",
    });

    const response = await request("/api/store/today", cookieA);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      agenda: { storeCode: string; date: string };
      appointments: Array<{ id: string; startTime: string }>;
    };

    expect(body.agenda).toMatchObject({
      storeCode: "F71",
      date: today,
    });
    expect(body.appointments.map((item) => item.id)).toEqual([
      "appt-a-early",
      "appt-a-late",
    ]);
  });

  it("loja não acessa detalhe nem altera status de outra loja", async () => {
    const cookieA = await seedStoreUser({
      storeId: "store-isolation-a",
      storeCode: "F73",
      userId: "user-isolation-a",
    });
    await seedStoreUser({
      storeId: "store-isolation-b",
      storeCode: "F74",
      userId: "user-isolation-b",
    });
    await seedAgenda({
      agendaId: "agenda-isolation-b",
      storeId: "store-isolation-b",
      creatorId: "user-isolation-b",
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-isolation-b",
      agendaId: "agenda-isolation-b",
      protocol: "93000001",
      startTime: "08:00",
    });

    const detail = await request(
      "/api/store/appointments/appt-isolation-b",
      cookieA,
    );
    expect(detail.status).toBe(404);

    const change = await request(
      "/api/store/appointments/appt-isolation-b/status",
      cookieA,
      { method: "PATCH", body: { status: "recebido" } },
    );
    expect(change.status).toBe(404);

    const row = await db
      .prepare("SELECT status FROM agendamentos WHERE id = ?")
      .bind("appt-isolation-b")
      .first<{ status: string }>();
    expect(row?.status).toBe("aguardando");
  });

  it("histórico lista somente dias da loja autenticada", async () => {
    const cookieA = await seedStoreUser({
      storeId: "store-history-a",
      storeCode: "F75",
      userId: "user-history-a",
    });
    await seedStoreUser({
      storeId: "store-history-b",
      storeCode: "F76",
      userId: "user-history-b",
    });

    await seedAgenda({
      agendaId: "agenda-history-a-1",
      storeId: "store-history-a",
      creatorId: "user-history-a",
      date: "2026-09-20",
    });
    await seedAgenda({
      agendaId: "agenda-history-a-2",
      storeId: "store-history-a",
      creatorId: "user-history-a",
      date: "2026-09-21",
    });
    await seedAgenda({
      agendaId: "agenda-history-b",
      storeId: "store-history-b",
      creatorId: "user-history-b",
      date: "2026-09-22",
    });

    const response = await request("/api/store/history", cookieA);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ date: string }>;
    expect(body.map((item) => item.date)).toEqual([
      "2026-09-21",
      "2026-09-20",
    ]);

    const detail = await request("/api/store/history/2026-09-20", cookieA);
    expect(detail.status).toBe(200);
  });

  it("muda status, grava histórico e permite correção posterior", async () => {
    const userId = "user-status-a";
    const cookie = await seedStoreUser({
      storeId: "store-status-a",
      storeCode: "F77",
      userId,
    });
    await seedAgenda({
      agendaId: "agenda-status-a",
      storeId: "store-status-a",
      creatorId: userId,
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-status-a",
      agendaId: "agenda-status-a",
      protocol: "94000001",
      startTime: "08:00",
    });

    const first = await request(
      "/api/store/appointments/appt-status-a/status",
      cookie,
      { method: "PATCH", body: { status: "recebido" } },
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: "recebido" });

    const corrected = await request(
      "/api/store/appointments/appt-status-a/status",
      cookie,
      { method: "PATCH", body: { status: "recusado" } },
    );
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toMatchObject({ status: "recusado" });

    const history = await db
      .prepare(
        "SELECT usuario_id, status_anterior, status_novo FROM historico_status WHERE agendamento_id = ? ORDER BY alterado_em ASC, rowid ASC",
      )
      .bind("appt-status-a")
      .all<{
        usuario_id: string;
        status_anterior: string;
        status_novo: string;
      }>();

    expect(history.results).toEqual([
      {
        usuario_id: userId,
        status_anterior: "aguardando",
        status_novo: "recebido",
      },
      {
        usuario_id: userId,
        status_anterior: "recebido",
        status_novo: "recusado",
      },
    ]);
  });

  it("status inválido retorna 400 sem alterar o registro", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-status-invalid",
      storeCode: "F78",
      userId: "user-status-invalid",
    });
    await seedAgenda({
      agendaId: "agenda-status-invalid",
      storeId: "store-status-invalid",
      creatorId: "user-status-invalid",
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-status-invalid",
      agendaId: "agenda-status-invalid",
      protocol: "95000001",
      startTime: "08:00",
    });

    const response = await request(
      "/api/store/appointments/appt-status-invalid/status",
      cookie,
      { method: "PATCH", body: { status: "qualquer" } },
    );

    expect(response.status).toBe(400);
    const row = await db
      .prepare("SELECT status FROM agendamentos WHERE id = ?")
      .bind("appt-status-invalid")
      .first<{ status: string }>();
    expect(row?.status).toBe("aguardando");
  });


  it("não permite que a loja volte o status para aguardando", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-status-awaiting",
      storeCode: "F80",
      userId: "user-status-awaiting",
    });
    await seedAgenda({
      agendaId: "agenda-status-awaiting",
      storeId: "store-status-awaiting",
      creatorId: "user-status-awaiting",
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-status-awaiting",
      agendaId: "agenda-status-awaiting",
      protocol: "95500001",
      startTime: "08:00",
      status: "recebido",
    });

    const response = await request(
      "/api/store/appointments/appt-status-awaiting/status",
      cookie,
      { method: "PATCH", body: { status: "aguardando" } },
    );

    expect(response.status).toBe(400);
    const row = await db
      .prepare("SELECT status FROM agendamentos WHERE id = ?")
      .bind("appt-status-awaiting")
      .first<{ status: string }>();
    expect(row?.status).toBe("recebido");
  });

  it("rollbacka a mudança se a gravação do histórico falhar", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-status-atomic",
      storeCode: "F79",
      userId: "user-status-atomic",
    });
    await seedAgenda({
      agendaId: "agenda-status-atomic",
      storeId: "store-status-atomic",
      creatorId: "user-status-atomic",
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-status-atomic",
      agendaId: "agenda-status-atomic",
      protocol: "96000001",
      startTime: "08:00",
    });

    await db
      .prepare(
        "CREATE TRIGGER fail_status_history BEFORE INSERT ON historico_status BEGIN SELECT RAISE(ABORT, 'forced history failure'); END",
      )
      .run();

    const response = await request(
      "/api/store/appointments/appt-status-atomic/status",
      cookie,
      { method: "PATCH", body: { status: "recebido" } },
    );

    expect(response.status).toBe(500);

    const row = await db
      .prepare("SELECT status FROM agendamentos WHERE id = ?")
      .bind("appt-status-atomic")
      .first<{ status: string }>();
    expect(row?.status).toBe("aguardando");
  });
});
