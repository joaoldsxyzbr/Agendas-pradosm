import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";
import { businessDate } from "../../worker/lib/time";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const now = "2026-09-24T12:00:00.000Z";

async function seedAdmin(id: string) {
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em) VALUES (?, NULL, ?, ?, ?, 'admin', 1, ?, ?)",
    )
    .bind(id, `Admin ${id}`, `login-${id}`, passwordHash, now, now)
    .run();

  const token = await createSessionToken(id, sessionSecret);
  return `agenda_session=${token}`;
}

async function seedStore(id: string, code: string) {
  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(id, code, `Loja ${code}`, now, now)
    .run();
}

function appointment(protocol: string, supplier = "FORNECEDOR TESTE LTDA") {
  return {
    protocol,
    startTime: "08:00",
    endTime: "08:10",
    supplier,
    items: 10,
    volumes: 5,
    pallets: 1,
    cargaBatida: null,
    type: "Pedido",
    nfe: [],
    orders: ["50001"],
    status: "recebido",
  };
}

function payload(
  storeCode: string,
  appointments = [appointment("90000001")],
  extra: Record<string, unknown> = {},
) {
  return {
    storeCode,
    date: "2026-09-24",
    originalFileName: "agenda-f99.pdf",
    appointments,
    ...extra,
  };
}

async function request(
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

async function importAgenda(
  cookie: string,
  body: unknown,
) {
  return request("/api/admin/agendas/import", cookie, {
    method: "POST",
    body,
  });
}

describe("admin agenda import", () => {
  it("retorna 422 quando a loja não existe", async () => {
    const cookie = await seedAdmin("admin-import-missing-store");

    const response = await importAgenda(cookie, payload("F61"));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "LOJA_NAO_ENCONTRADA",
    });
  });

  it("rejeita payload sem agendamentos e nome de arquivo com caminho", async () => {
    const cookie = await seedAdmin("admin-import-invalid");
    await seedStore("store-import-invalid", "F62");

    const empty = await importAgenda(cookie, payload("F62", []));
    expect(empty.status).toBe(400);

    const pathName = await importAgenda(
      cookie,
      payload("F62", [appointment("90000002")], {
        originalFileName: "../agenda.pdf",
      }),
    );
    expect(pathName.status).toBe(400);
  });

  it("primeira importação cria a agenda e ignora status enviado pelo frontend", async () => {
    const cookie = await seedAdmin("admin-import-first");
    await seedStore("store-import-first", "F63");

    const response = await importAgenda(cookie, payload("F63"));

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      agenda: { storeCode: string; date: string };
      appointments: Array<{ protocol: string; status: string; ativo: boolean }>;
    };

    expect(body.agenda).toMatchObject({
      storeCode: "F63",
      date: "2026-09-24",
    });
    expect(body.appointments).toEqual([
      expect.objectContaining({
        protocol: "90000001",
        status: "aguardando",
        ativo: true,
      }),
    ]);
  });

  it("não duplica a mesma loja e data sem replace explícito", async () => {
    const cookie = await seedAdmin("admin-import-duplicate");
    await seedStore("store-import-duplicate", "F64");

    expect((await importAgenda(cookie, payload("F64"))).status).toBe(201);

    const duplicate = await importAgenda(cookie, payload("F64"));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: "AGENDA_JA_EXISTE",
    });
  });

  it("replace preserva status e histórico, adiciona novos e desativa removidos", async () => {
    const adminId = "admin-import-replace";
    const cookie = await seedAdmin(adminId);
    await seedStore("store-import-replace", "F65");

    const first = await importAgenda(
      cookie,
      payload("F65", [
        appointment("90000101", "FORNECEDOR UM"),
        appointment("90000102", "FORNECEDOR DOIS"),
      ]),
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as {
      appointments: Array<{ id: string; protocol: string }>;
    };
    const kept = firstBody.appointments.find(
      (item) => item.protocol === "90000101",
    )!;

    await db
      .prepare(
        "UPDATE agendamentos SET status = 'recebido' WHERE id = ?",
      )
      .bind(kept.id)
      .run();

    await db
      .prepare(
        "INSERT INTO historico_status (id, agendamento_id, usuario_id, status_anterior, status_novo, alterado_em) VALUES (?, ?, ?, 'aguardando', 'recebido', ?)",
      )
      .bind("history-replace-1", kept.id, adminId, now)
      .run();

    const replaced = await importAgenda(
      cookie,
      payload(
        "F65",
        [
          appointment("90000101", "FORNECEDOR UM ATUALIZADO"),
          appointment("90000103", "FORNECEDOR TRES"),
        ],
        { replace: true, originalFileName: "agenda-f65-revisada.pdf" },
      ),
    );

    expect(replaced.status).toBe(200);
    const body = (await replaced.json()) as {
      appointments: Array<{
        id: string;
        protocol: string;
        supplier: string;
        status: string;
        ativo: boolean;
      }>;
    };

    expect(body.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: kept.id,
          protocol: "90000101",
          supplier: "FORNECEDOR UM ATUALIZADO",
          status: "recebido",
          ativo: true,
        }),
        expect.objectContaining({
          protocol: "90000103",
          status: "aguardando",
          ativo: true,
        }),
      ]),
    );

    const removed = await db
      .prepare(
        "SELECT ativo FROM agendamentos WHERE protocolo = '90000102' LIMIT 1",
      )
      .first<{ ativo: number }>();
    expect(removed?.ativo).toBe(0);

    const history = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM historico_status WHERE agendamento_id = ?",
      )
      .bind(kept.id)
      .first<{ total: number }>();
    expect(history?.total).toBe(1);
  });

  it("replace preserva fornecedor manual mesmo se ele não existir no PDF", async () => {
    const cookie = await seedAdmin("admin-import-manual");
    await seedStore("store-import-manual", "F68");

    const first = await importAgenda(
      cookie,
      payload("F68", [appointment("90000201", "FORNECEDOR IMPORTADO")]),
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as {
      agenda: { id: string };
    };

    await db
      .prepare(
        "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, '12:30', '12:30', ?, 'Sem agenda', '[]', '[]', 'aguardando', 'manual', 1, ?, ?)",
      )
      .bind(
        "appt-manual-preserved",
        firstBody.agenda.id,
        "manual:appt-manual-preserved",
        "FORNECEDOR MANUAL",
        now,
        now,
      )
      .run();

    const replaced = await importAgenda(
      cookie,
      payload(
        "F68",
        [appointment("90000202", "NOVO FORNECEDOR IMPORTADO")],
        { replace: true, originalFileName: "agenda-f68-revisada.pdf" },
      ),
    );

    expect(replaced.status).toBe(200);

    const manual = await db
      .prepare(
        "SELECT ativo, origem, fornecedor FROM agendamentos WHERE id = ?",
      )
      .bind("appt-manual-preserved")
      .first<{ ativo: number; origem: string; fornecedor: string }>();

    expect(manual).toEqual({
      ativo: 1,
      origem: "manual",
      fornecedor: "FORNECEDOR MANUAL",
    });
  });

  it("falha no batch não deixa substituição parcial", async () => {
    const cookie = await seedAdmin("admin-import-atomic");
    await seedStore("store-import-atomic", "F66");

    const first = await importAgenda(
      cookie,
      payload("F66", [
        appointment("90000201", "ORIGINAL UM"),
        appointment("90000202", "ORIGINAL DOIS"),
      ]),
    );
    expect(first.status).toBe(201);

    await db
      .prepare(
        "CREATE TRIGGER fail_replace BEFORE UPDATE OF fornecedor ON agendamentos WHEN NEW.fornecedor = 'FORCAR_FALHA' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      )
      .run();

    const failed = await importAgenda(
      cookie,
      payload(
        "F66",
        [
          appointment("90000201", "FORCAR_FALHA"),
          appointment("90000203", "NOVO TRES"),
        ],
        { replace: true, originalFileName: "arquivo-novo.pdf" },
      ),
    );
    expect(failed.status).toBe(500);

    const agenda = await db
      .prepare(
        "SELECT arquivo_original FROM agendas WHERE loja_id = ? AND data_agenda = '2026-09-24'",
      )
      .bind("store-import-atomic")
      .first<{ arquivo_original: string }>();
    expect(agenda?.arquivo_original).toBe("agenda-f99.pdf");

    const rows = await db
      .prepare(
        "SELECT protocolo, fornecedor, ativo FROM agendamentos WHERE agenda_id = (SELECT id FROM agendas WHERE loja_id = ? AND data_agenda = '2026-09-24') ORDER BY protocolo",
      )
      .bind("store-import-atomic")
      .all<{ protocolo: string; fornecedor: string; ativo: number }>();

    expect(rows.results).toEqual([
      { protocolo: "90000201", fornecedor: "ORIGINAL UM", ativo: 1 },
      { protocolo: "90000202", fornecedor: "ORIGINAL DOIS", ativo: 1 },
    ]);
  });

  it("resumo de hoje conta fornecedores sem agenda separadamente", async () => {
    const adminId = "admin-dashboard-manual";
    const cookie = await seedAdmin(adminId);
    await seedStore("store-dashboard-manual", "F69");
    const today = businessDate(new Date());

    await db
      .prepare(
        "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "agenda-dashboard-manual",
        "store-dashboard-manual",
        today,
        "agenda-dashboard.pdf",
        adminId,
        now,
        now,
      )
      .run();

    await db.batch([
      db
        .prepare(
          "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, '08:00', '08:10', ?, 'Pedido', '[]', '[]', 'recebido', 'importado', 1, ?, ?)",
        )
        .bind(
          "appt-dashboard-imported",
          "agenda-dashboard-manual",
          "90000301",
          "FORNECEDOR IMPORTADO",
          now,
          now,
        ),
      db
        .prepare(
          "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, tipo, nfe, pedidos, status, origem, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, '09:30', '09:30', ?, 'Sem agenda', '[]', '[]', 'aguardando', 'manual', 1, ?, ?)",
        )
        .bind(
          "appt-dashboard-manual",
          "agenda-dashboard-manual",
          "manual:dashboard",
          "FORNECEDOR SEM AGENDA",
          now,
          now,
        ),
    ]);

    const response = await request("/api/admin/agendas/today", cookie);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{
      storeCode: string;
      total: number;
      aguardando: number;
      recebido: number;
      semAgenda: number;
    }>;

    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeCode: "F69",
          total: 2,
          aguardando: 1,
          recebido: 1,
          semAgenda: 1,
        }),
      ]),
    );
  });

  it("admin consulta agenda histórica e histórico de status", async () => {
    const adminId = "admin-import-history";
    const cookie = await seedAdmin(adminId);
    await seedStore("store-import-history", "F67");

    const imported = await importAgenda(cookie, payload("F67"));
    expect(imported.status).toBe(201);
    const importedBody = (await imported.json()) as {
      appointments: Array<{ id: string }>;
    };
    const appointmentId = importedBody.appointments[0].id;

    await db
      .prepare(
        "INSERT INTO historico_status (id, agendamento_id, usuario_id, status_anterior, status_novo, alterado_em) VALUES (?, ?, ?, 'aguardando', 'recebido', ?)",
      )
      .bind("history-query-1", appointmentId, adminId, now)
      .run();

    const list = await request(
      "/api/admin/agendas?date=2026-09-24&storeCode=F67",
      cookie,
    );
    expect(list.status).toBe(200);
    const agendas = (await list.json()) as Array<{ id: string; storeCode: string }>;
    expect(agendas).toHaveLength(1);
    expect(agendas[0].storeCode).toBe("F67");

    const detail = await request(
      `/api/admin/agendas/${agendas[0].id}`,
      cookie,
    );
    expect(detail.status).toBe(200);

    const history = await request(
      `/api/admin/appointments/${appointmentId}/history`,
      cookie,
    );
    expect(history.status).toBe(200);
    expect(await history.json()).toEqual([
      expect.objectContaining({
        statusAnterior: "aguardando",
        statusNovo: "recebido",
        usuario: expect.objectContaining({ id: adminId }),
      }),
    ]);
  });
});
