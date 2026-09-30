import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const now = "2026-09-30T18:00:00.000Z";

async function seedUser(input: {
  role: "admin" | "visualizador" | "conferente";
  store?: boolean;
}) {
  const userId = crypto.randomUUID();
  const storeId = input.store ? crypto.randomUUID() : null;

  if (storeId) {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(
        storeId,
        `RT-${userId.slice(0, 8)}`,
        "Loja Realtime",
        now,
        now,
      )
      .run();
  }

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(
      userId,
      storeId,
      "Usuário Realtime",
      `realtime-${userId}`,
      passwordHash,
      input.role,
      now,
      now,
    )
    .run();

  const token = await createSessionToken(userId, 1, sessionSecret);
  return {
    userId,
    storeId,
    cookie: `agenda_session=${token}`,
  };
}

function websocketRequest(
  cookie?: string,
  origin = "https://example.com",
  extraHeaders: Record<string, string> = {},
) {
  return new Request("https://example.com/api/realtime", {
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
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

describe("infraestrutura realtime", () => {
  it("rejeita conexão anônima", async () => {
    const response = await exports.default.fetch(websocketRequest());
    expect(response.status).toBe(401);
  });

  it("rejeita origem diferente da própria aplicação", async () => {
    const admin = await seedUser({ role: "admin" });

    const response = await exports.default.fetch(
      websocketRequest(admin.cookie, "https://evil.example"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "ORIGEM_INVALIDA",
    });
  });

  it("exige upgrade WebSocket mesmo com sessão válida", async () => {
    const admin = await seedUser({ role: "admin" });

    const response = await exports.default.fetch(
      new Request("https://example.com/api/realtime", {
        headers: {
          Cookie: admin.cookie,
          Origin: "https://example.com",
        },
      }),
    );

    expect(response.status).toBe(426);
    expect(await response.json()).toMatchObject({
      error: "WEBSOCKET_NECESSARIO",
    });
  });

  it("admin autenticado conecta e recebe protocolo v1", async () => {
    const admin = await seedUser({ role: "admin" });

    const response = await exports.default.fetch(
      websocketRequest(admin.cookie),
    );

    expect(response.status).toBe(101);

    const socket = (
      response as Response & { webSocket?: WebSocket }
    ).webSocket;
    expect(socket).toBeTruthy();

    socket!.accept();

    const ready = JSON.parse(await nextMessage(socket!)) as {
      version: number;
      type: string;
    };

    expect(ready).toEqual({
      version: 1,
      type: "realtime.ready",
    });

    socket!.send("ping");
    expect(await nextMessage(socket!)).toBe("pong");

    socket!.close(1000, "teste concluído");
  });

  it("visualizador autenticado também pode abrir o canal do dashboard", async () => {
    const viewer = await seedUser({ role: "visualizador" });

    const response = await exports.default.fetch(
      websocketRequest(viewer.cookie),
    );

    expect(response.status).toBe(101);
    const socket = (
      response as Response & { webSocket?: WebSocket }
    ).webSocket;
    socket?.accept();
    socket?.close(1000, "teste concluído");
  });

  it("conferente autenticado conecta somente com loja ativa resolvida pelo servidor", async () => {
    const conferente = await seedUser({
      role: "conferente",
      store: true,
    });

    const response = await exports.default.fetch(
      websocketRequest(conferente.cookie, "https://example.com", {
        "X-Agenda-Realtime-User-Id": "usuario-forjado",
        "X-Agenda-Realtime-Role": "admin",
        "X-Agenda-Realtime-Store-Id": "loja-forjada",
      }),
    );

    expect(response.status).toBe(101);

    const socket = (
      response as Response & { webSocket?: WebSocket }
    ).webSocket;
    socket?.accept();
    socket?.close(1000, "teste concluído");
  });

  it("hub rejeita identidade incompleta quando chamado sem o proxy autenticado", async () => {
    const namespace = (
      env as unknown as { REALTIME_HUB: DurableObjectNamespace }
    ).REALTIME_HUB;
    const hub = namespace.get(namespace.idFromName("teste-identidade"));

    const response = await hub.fetch(
      new Request("https://internal/realtime", {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          "X-Agenda-Realtime-Role": "conferente",
        },
      }),
    );

    expect(response.status).toBe(400);
  });
});
