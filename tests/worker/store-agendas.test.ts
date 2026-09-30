import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";
import { businessDate, businessTime } from "../../worker/lib/time";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
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
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'conferente', 1, ?, ?)",
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

  const token = await createSessionToken(input.userId, 1, sessionSecret);
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

  it("formata o horário operacional em America/Sao_Paulo", () => {
    expect(businessTime(new Date("2026-09-25T16:31:00.000Z"))).toBe("13:31");
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

  it("adiciona fornecedor sem agenda como aguardando na agenda de hoje", async () => {
    const today = businessDate(new Date());
    const cookie = await seedStoreUser({
      storeId: "store-manual-a",
      storeCode: "F81",
      userId: "user-manual-a",
    });
    await seedAgenda({
      agendaId: "agenda-manual-a",
      storeId: "store-manual-a",
      creatorId: "user-manual-a",
      date: today,
    });

    const response = await request("/api/store/today/manual", cookie, {
      method: "POST",
      body: { supplier: "  FORNECEDOR EXTRA LTDA  " },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      protocol: string;
      startTime: string;
      endTime: string;
      supplier: string;
      type: string | null;
      origin: string;
      status: string;
    };

    expect(body).toMatchObject({
      protocol: "Sem agenda",
      supplier: "FORNECEDOR EXTRA LTDA",
      type: "Sem agenda",
      origin: "manual",
      status: "aguardando",
    });
    expect(body.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(body.endTime).toBe(body.startTime);

    const stored = await db
      .prepare(
        "SELECT protocolo, fornecedor, tipo, origem, status, ativo FROM agendamentos WHERE id = ?",
      )
      .bind(body.id)
      .first<{
        protocolo: string;
        fornecedor: string;
        tipo: string;
        origem: string;
        status: string;
        ativo: number;
      }>();

    expect(stored).toMatchObject({
      fornecedor: "FORNECEDOR EXTRA LTDA",
      tipo: "Sem agenda",
      origem: "manual",
      status: "aguardando",
      ativo: 1,
    });
    expect(stored?.protocolo).toMatch(/^manual:/);

    const todayResponse = await request("/api/store/today", cookie);
    const todayBody = (await todayResponse.json()) as {
      appointments: Array<{ id: string; protocol: string; origin: string }>;
    };
    expect(todayBody.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: body.id,
          protocol: "Sem agenda",
          origin: "manual",
        }),
      ]),
    );
  });

  it("não adiciona fornecedor sem agenda quando o dia não tem agenda importada", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-manual-no-agenda",
      storeCode: "F82",
      userId: "user-manual-no-agenda",
    });

    const response = await request("/api/store/today/manual", cookie, {
      method: "POST",
      body: { supplier: "FORNECEDOR SEM AGENDA" },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "AGENDA_NAO_DISPONIVEL",
    });
  });

  it("rejeita nome vazio no fornecedor sem agenda", async () => {
    const today = businessDate(new Date());
    const cookie = await seedStoreUser({
      storeId: "store-manual-invalid",
      storeCode: "F83",
      userId: "user-manual-invalid",
    });
    await seedAgenda({
      agendaId: "agenda-manual-invalid",
      storeId: "store-manual-invalid",
      creatorId: "user-manual-invalid",
      date: today,
    });

    const response = await request("/api/store/today/manual", cookie, {
      method: "POST",
      body: { supplier: "   " },
    });

    expect(response.status).toBe(400);
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

  it("conferente conclui o próprio dia e registra o evento", async () => {
    const userId = "user-complete-day";
    const cookie = await seedStoreUser({
      storeId: "store-complete-day",
      storeCode: "F85",
      userId,
    });
    await seedAgenda({
      agendaId: "agenda-complete-day",
      storeId: "store-complete-day",
      creatorId: userId,
      date: "2026-09-20",
    });

    const response = await request(
      "/api/store/agenda/2026-09-20/complete",
      cookie,
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "agenda-complete-day",
      dayStatus: "concluido",
      completedBy: { id: userId },
    });

    const history = await db
      .prepare(
        "SELECT usuario_id, acao FROM historico_agenda WHERE agenda_id = ?",
      )
      .bind("agenda-complete-day")
      .all<{ usuario_id: string; acao: string }>();

    expect(history.results).toEqual([
      { usuario_id: userId, acao: "concluido" },
    ]);
  });

  it("permite fornecedor sem agenda em dia anterior enquanto estiver aberto", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-manual-past",
      storeCode: "F86",
      userId: "user-manual-past",
    });
    await seedAgenda({
      agendaId: "agenda-manual-past",
      storeId: "store-manual-past",
      creatorId: "user-manual-past",
      date: "2026-09-18",
    });

    const response = await request(
      "/api/store/agenda/2026-09-18/manual",
      cookie,
      { method: "POST", body: { supplier: "FORNECEDOR RETROATIVO" } },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      supplier: "FORNECEDOR RETROATIVO",
      status: "aguardando",
    });
  });

  it("bloqueia alterações do conferente depois que o dia é concluído", async () => {
    const userId = "user-closed-day";
    const cookie = await seedStoreUser({
      storeId: "store-closed-day",
      storeCode: "F87",
      userId,
    });
    await seedAgenda({
      agendaId: "agenda-closed-day",
      storeId: "store-closed-day",
      creatorId: userId,
      date: "2026-09-19",
    });
    await seedAppointment({
      id: "appt-closed-day",
      agendaId: "agenda-closed-day",
      protocol: "97000001",
      startTime: "08:00",
    });

    expect(
      (
        await request("/api/store/agenda/2026-09-19/complete", cookie, {
          method: "POST",
        })
      ).status,
    ).toBe(200);

    const status = await request(
      "/api/store/appointments/appt-closed-day/status",
      cookie,
      { method: "PATCH", body: { status: "recebido" } },
    );
    expect(status.status).toBe(409);
    expect(await status.json()).toMatchObject({ error: "DIA_CONCLUIDO" });

    const exchanges = await request(
      "/api/store/appointments/appt-closed-day/exchanges",
      cookie,
      { method: "PATCH", body: { hasExchanges: true } },
    );
    expect(exchanges.status).toBe(409);

    const manual = await request(
      "/api/store/agenda/2026-09-19/manual",
      cookie,
      { method: "POST", body: { supplier: "BLOQUEADO" } },
    );
    expect(manual.status).toBe(409);
  });

  it("edita e remove fornecedor manual com soft delete e auditoria", async () => {
    const userId = "user-manual-edit";
    const cookie = await seedStoreUser({
      storeId: "store-manual-edit",
      storeCode: "F91",
      userId,
    });
    await seedAgenda({
      agendaId: "agenda-manual-edit",
      storeId: "store-manual-edit",
      creatorId: userId,
      date: "2026-09-20",
    });

    const createdResponse = await request(
      "/api/store/agenda/2026-09-20/manual",
      cookie,
      { method: "POST", body: { supplier: "FORNECEDOR ERRADO" } },
    );
    const created = (await createdResponse.json()) as { id: string };

    const editedResponse = await request(
      `/api/store/appointments/${created.id}/manual`,
      cookie,
      { method: "PATCH", body: { supplier: "FORNECEDOR CORRETO" } },
    );
    expect(editedResponse.status).toBe(200);
    expect(await editedResponse.json()).toMatchObject({
      supplier: "FORNECEDOR CORRETO",
      origin: "manual",
    });

    const deletedResponse = await request(
      `/api/store/appointments/${created.id}/manual`,
      cookie,
      { method: "DELETE" },
    );
    expect(deletedResponse.status).toBe(204);

    const stored = await db
      .prepare("SELECT fornecedor, ativo FROM agendamentos WHERE id = ?")
      .bind(created.id)
      .first<{ fornecedor: string; ativo: number }>();
    expect(stored).toEqual({ fornecedor: "FORNECEDOR CORRETO", ativo: 0 });

    const audit = await db
      .prepare(
        "SELECT acao, antes, depois FROM auditoria WHERE agendamento_id = ? ORDER BY criado_em ASC, rowid ASC",
      )
      .bind(created.id)
      .all<{ acao: string; antes: string | null; depois: string | null }>();

    expect(audit.results.map((item) => item.acao)).toEqual([
      "fornecedor_manual_criado",
      "fornecedor_manual_editado",
      "fornecedor_manual_removido",
    ]);
  });

  it("bloqueia edição e remoção manual para conferente em dia concluído", async () => {
    const userId = "user-manual-closed";
    const cookie = await seedStoreUser({
      storeId: "store-manual-closed",
      storeCode: "F92",
      userId,
    });
    await seedAgenda({
      agendaId: "agenda-manual-closed",
      storeId: "store-manual-closed",
      creatorId: userId,
      date: "2026-09-20",
    });

    const createdResponse = await request(
      "/api/store/agenda/2026-09-20/manual",
      cookie,
      { method: "POST", body: { supplier: "FORNECEDOR FECHADO" } },
    );
    const created = (await createdResponse.json()) as { id: string };

    await request("/api/store/agenda/2026-09-20/complete", cookie, {
      method: "POST",
    });

    expect(
      (
        await request(`/api/store/appointments/${created.id}/manual`, cookie, {
          method: "PATCH",
          body: { supplier: "NOVO NOME" },
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await request(`/api/store/appointments/${created.id}/manual`, cookie, {
          method: "DELETE",
        })
      ).status,
    ).toBe(409);
  });

  it("marca e desmarca trocas sem alterar o status", async () => {
    const cookie = await seedStoreUser({
      storeId: "store-exchanges-a",
      storeCode: "F84",
      userId: "user-exchanges-a",
    });
    await seedAgenda({
      agendaId: "agenda-exchanges-a",
      storeId: "store-exchanges-a",
      creatorId: "user-exchanges-a",
      date: "2026-09-20",
    });
    await seedAppointment({
      id: "appt-exchanges-a",
      agendaId: "agenda-exchanges-a",
      protocol: "93500001",
      startTime: "08:00",
    });

    const marked = await request(
      "/api/store/appointments/appt-exchanges-a/exchanges",
      cookie,
      { method: "PATCH", body: { hasExchanges: true } },
    );
    expect(marked.status).toBe(200);
    expect(await marked.json()).toMatchObject({
      status: "aguardando",
      hasExchanges: true,
    });

    const unmarked = await request(
      "/api/store/appointments/appt-exchanges-a/exchanges",
      cookie,
      { method: "PATCH", body: { hasExchanges: false } },
    );
    expect(unmarked.status).toBe(200);
    expect(await unmarked.json()).toMatchObject({
      status: "aguardando",
      hasExchanges: false,
    });

    const row = await db
      .prepare("SELECT status, trocas FROM agendamentos WHERE id = ?")
      .bind("appt-exchanges-a")
      .first<{ status: string; trocas: number }>();

    expect(row).toMatchObject({ status: "aguardando", trocas: 0 });

    const audit = await db
      .prepare(
        "SELECT acao FROM auditoria WHERE agendamento_id = ? AND acao = 'trocas_alteradas'",
      )
      .bind("appt-exchanges-a")
      .all<{ acao: string }>();
    expect(audit.results).toHaveLength(2);
  });

  it("muda status, volta para aguardando e grava todo o histórico", async () => {
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

    const received = await request(
      "/api/store/appointments/appt-status-a/status",
      cookie,
      { method: "PATCH", body: { status: "recebido" } },
    );
    expect(received.status).toBe(200);
    expect(await received.json()).toMatchObject({ status: "recebido" });

    const reset = await request(
      "/api/store/appointments/appt-status-a/status",
      cookie,
      { method: "PATCH", body: { status: "aguardando" } },
    );
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({ status: "aguardando" });

    const missed = await request(
      "/api/store/appointments/appt-status-a/status",
      cookie,
      { method: "PATCH", body: { status: "nao_chegou" } },
    );
    expect(missed.status).toBe(200);
    expect(await missed.json()).toMatchObject({ status: "nao_chegou" });

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
        status_novo: "aguardando",
      },
      {
        usuario_id: userId,
        status_anterior: "aguardando",
        status_novo: "nao_chegou",
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
