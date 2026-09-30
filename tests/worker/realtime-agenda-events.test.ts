import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const now = "2026-09-30T19:30:00.000Z";

async function seedUser(input: {
  id: string;
  role: "admin" | "conferente";
  storeId?: string;
}) {
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(
      input.id,
      input.storeId ?? null,
      `Usuário ${input.id}`,
      `login-${input.id}`,
      passwordHash,
      input.role,
      now,
      now,
    )
    .run();

  const token = await createSessionToken(input.id, 1, sessionSecret);
  return `agenda_session=${token}`;
}

function websocketRequest(cookie: string) {
  return new Request("https://example.com/api/realtime", {
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
      Origin: "https://example.com",
      Cookie: cookie,
    },
  });
}

async function nextMessage(socket: WebSocket) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("WebSocket não recebeu mensagem a tempo.")),
      2_000,
    );

    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(String(event.data));
      },
      { once: true },
    );
  });
}

async function mutate(
  url: string,
  cookie: string,
  body: unknown,
) {
  return exports.default.fetch(
    new Request(`https://example.com${url}`, {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("eventos realtime de agenda", () => {
  it("publica somente depois de mutações D1 bem-sucedidas", async () => {
    const storeId = "store-realtime-events";
    const agendaId = "agenda-realtime-events";
    const appointmentId = "appointment-realtime-events";
    const conferenteId = "conferente-realtime-events";
    const adminId = "admin-realtime-events";

    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, 'F98', 'Loja Realtime Eventos', 1, ?, ?)",
      )
      .bind(storeId, now, now)
      .run();

    const conferenteCookie = await seedUser({
      id: conferenteId,
      role: "conferente",
      storeId,
    });
    const adminCookie = await seedUser({
      id: adminId,
      role: "admin",
    });

    await db
      .prepare(
        "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, '2026-09-30', 'agenda.pdf', ?, ?, ?)",
      )
      .bind(agendaId, storeId, adminId, now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, trocas, ativo, criado_em, atualizado_em) VALUES (?, ?, '98000001', '08:00', '09:00', 'Fornecedor Realtime', 1, 1, 0, NULL, 'Pedido', '[]', '[]', 'aguardando', 0, 1, ?, ?)",
      )
      .bind(appointmentId, agendaId, now, now)
      .run();

    const adminResponse = await exports.default.fetch(
      websocketRequest(adminCookie),
    );
    const adminSocket = (
      adminResponse as Response & { webSocket?: WebSocket }
    ).webSocket!;
    adminSocket.accept();

    await nextMessage(adminSocket);
    await nextMessage(adminSocket);

    const statusEvent = nextMessage(adminSocket);
    const status = await mutate(
      `/api/store/appointments/${appointmentId}/status`,
      conferenteCookie,
      { status: "recebido" },
    );
    expect(status.status).toBe(200);

    expect(JSON.parse(await statusEvent)).toEqual({
      version: 1,
      type: "agenda.changed",
      agendaId,
      storeId,
      date: "2026-09-30",
      reason: "status",
    });

    const invalid = await mutate(
      `/api/store/appointments/${appointmentId}/status`,
      conferenteCookie,
      { status: "invalido" },
    );
    expect(invalid.status).toBe(400);

    const exchangesEvent = nextMessage(adminSocket);
    const exchanges = await mutate(
      `/api/store/appointments/${appointmentId}/exchanges`,
      conferenteCookie,
      { hasExchanges: true },
    );
    expect(exchanges.status).toBe(200);

    expect(JSON.parse(await exchangesEvent)).toEqual({
      version: 1,
      type: "agenda.changed",
      agendaId,
      storeId,
      date: "2026-09-30",
      reason: "exchanges",
    });

    adminSocket.close(1000, "teste concluído");
  });
});
