import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../../worker/lib/password";
import {
  conferentePresenceStatus,
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_SIGNAL_WINDOW_MS,
} from "../../worker/lib/presence";
import { createSessionToken } from "../../worker/lib/session";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const seedTime = "2026-09-30T12:00:00.000Z";

async function seedStore(code: string) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(id, code, `Loja ${code}`, seedTime, seedTime)
    .run();
  return id;
}

async function seedConferente(storeId: string, suffix: string) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'conferente', 1, ?, ?)",
    )
    .bind(
      id,
      storeId,
      `Conferente ${suffix}`,
      `presence-${suffix}-${id}`,
      passwordHash,
      seedTime,
      seedTime,
    )
    .run();

  const token = await createSessionToken(id, 1, sessionSecret);
  return { id, cookie: `agenda_session=${token}` };
}

async function seedAdmin() {
  const id = crypto.randomUUID();
  const senhaHash = await hashPassword("senha-admin-presence");
  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, NULL, 'Admin Presença', ?, ?, 'admin', 1, ?, ?)",
    )
    .bind(id, `admin-presence-${id}`, senhaHash, seedTime, seedTime)
    .run();

  const token = await createSessionToken(id, 1, sessionSecret);
  return `agenda_session=${token}`;
}

function apiRequest(
  path: string,
  cookie: string,
  init: { method?: string; body?: unknown } = {},
) {
  return exports.default.fetch(
    new Request(`https://example.com${path}`, {
      method: init.method ?? "GET",
      headers: {
        Cookie: cookie,
        Origin: "https://example.com",
        ...(init.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

function isoAgo(nowMs: number, ageMs: number) {
  return new Date(nowMs - ageMs).toISOString();
}

describe("presença do conferente", () => {
  it("classifica os limites de 3 e 7 minutos", () => {
    const nowMs = Date.parse("2026-09-30T15:00:00.000Z");

    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, PRESENCE_ONLINE_WINDOW_MS),
        isoAgo(nowMs, 60_000),
        nowMs,
      ),
    ).toBe("online");

    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, PRESENCE_ONLINE_WINDOW_MS + 1),
        isoAgo(nowMs, PRESENCE_SIGNAL_WINDOW_MS),
        nowMs,
      ),
    ).toBe("away");

    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, 60_000),
        isoAgo(nowMs, PRESENCE_SIGNAL_WINDOW_MS + 1),
        nowMs,
      ),
    ).toBe("offline");
  });

  it("heartbeat atualiza o sinal sem inventar nova interação", async () => {
    const storeId = await seedStore(`P${crypto.randomUUID().slice(0, 8)}`);
    const conferente = await seedConferente(storeId, "heartbeat");

    const first = await apiRequest("/api/store/presence", conferente.cookie, {
      method: "POST",
      body: { interacted: true },
    });
    expect(first.status).toBe(200);

    const initial = await db
      .prepare(
        "SELECT loja_id, ultima_interacao_em, ultimo_sinal_em FROM conferente_presenca WHERE usuario_id = ?",
      )
      .bind(conferente.id)
      .first<{
        loja_id: string;
        ultima_interacao_em: string | null;
        ultimo_sinal_em: string;
      }>();

    expect(initial?.loja_id).toBe(storeId);
    expect(initial?.ultima_interacao_em).toBeTruthy();
    expect(initial?.ultima_interacao_em).toBe(initial?.ultimo_sinal_em);

    const heartbeat = await apiRequest(
      "/api/store/presence",
      conferente.cookie,
      {
        method: "POST",
        body: { interacted: false },
      },
    );
    expect(heartbeat.status).toBe(200);

    const afterHeartbeat = await db
      .prepare(
        "SELECT ultima_interacao_em, ultimo_sinal_em FROM conferente_presenca WHERE usuario_id = ?",
      )
      .bind(conferente.id)
      .first<{
        ultima_interacao_em: string | null;
        ultimo_sinal_em: string;
      }>();

    expect(afterHeartbeat?.ultima_interacao_em).toBe(
      initial?.ultima_interacao_em,
    );
    expect(Date.parse(afterHeartbeat!.ultimo_sinal_em)).toBeGreaterThanOrEqual(
      Date.parse(initial!.ultimo_sinal_em),
    );

    const offline = await apiRequest(
      "/api/store/presence",
      conferente.cookie,
      { method: "DELETE" },
    );
    expect(offline.status).toBe(204);

    expect(
      await db
        .prepare(
          "SELECT usuario_id FROM conferente_presenca WHERE usuario_id = ?",
        )
        .bind(conferente.id)
        .first(),
    ).toBeNull();
  });

  it("agrega por loja usando o conferente mais ativo", async () => {
    const nowMs = Date.now();
    const onlineStore = await seedStore(
      `O${crypto.randomUUID().slice(0, 8)}`,
    );
    const awayStore = await seedStore(
      `A${crypto.randomUUID().slice(0, 8)}`,
    );
    const offlineStore = await seedStore(
      `F${crypto.randomUUID().slice(0, 8)}`,
    );

    const onlineUser = await seedConferente(onlineStore, "online");
    const onlineStoreAwayUser = await seedConferente(
      onlineStore,
      "online-store-away",
    );
    const awayUser = await seedConferente(awayStore, "away");
    const offlineUser = await seedConferente(offlineStore, "offline");

    const rows = [
      {
        userId: onlineUser.id,
        storeId: onlineStore,
        interaction: isoAgo(nowMs, 60_000),
        signal: isoAgo(nowMs, 60_000),
      },
      {
        userId: onlineStoreAwayUser.id,
        storeId: onlineStore,
        interaction: isoAgo(nowMs, 4 * 60_000),
        signal: isoAgo(nowMs, 60_000),
      },
      {
        userId: awayUser.id,
        storeId: awayStore,
        interaction: isoAgo(nowMs, 4 * 60_000),
        signal: isoAgo(nowMs, 60_000),
      },
      {
        userId: offlineUser.id,
        storeId: offlineStore,
        interaction: isoAgo(nowMs, 60_000),
        signal: isoAgo(nowMs, 8 * 60_000),
      },
    ];

    for (const row of rows) {
      await db
        .prepare(
          "INSERT INTO conferente_presenca (usuario_id, loja_id, ultima_interacao_em, ultimo_sinal_em, atualizado_em) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          row.userId,
          row.storeId,
          row.interaction,
          row.signal,
          row.signal,
        )
        .run();
    }

    const adminCookie = await seedAdmin();
    const response = await apiRequest(
      "/api/admin/presence",
      adminCookie,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{
      storeId: string;
      status: string;
    }>;

    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeId: onlineStore,
          status: "online",
        }),
        expect.objectContaining({
          storeId: awayStore,
          status: "away",
        }),
        expect.objectContaining({
          storeId: offlineStore,
          status: "offline",
        }),
      ]),
    );
  });

  it("bloqueia presença de usuário que não é conferente", async () => {
    const adminCookie = await seedAdmin();
    const response = await apiRequest(
      "/api/store/presence",
      adminCookie,
      {
        method: "POST",
        body: { interacted: true },
      },
    );

    expect(response.status).toBe(403);
  });
});
