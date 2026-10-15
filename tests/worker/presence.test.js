import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../../worker/lib/password";
import {
  conferentePresenceStatus,
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_SIGNAL_WINDOW_MS
} from "../../worker/lib/presence";
import { createSessionToken } from "../../worker/lib/session";
const db = env.DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash = "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const seedTime = "2026-09-30T12:00:00.000Z";
async function seedStore(code) {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)"
  ).bind(id, code, `Loja ${code}`, seedTime, seedTime).run();
  return id;
}
async function seedConferente(storeId, suffix) {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'conferente', 1, ?, ?)"
  ).bind(
    id,
    storeId,
    `Conferente ${suffix}`,
    `presence-${suffix}-${id}`,
    passwordHash,
    seedTime,
    seedTime
  ).run();
  const token = await createSessionToken(id, 1, sessionSecret);
  return { id, cookie: `agenda_session=${token}` };
}
async function seedAdmin() {
  const id = crypto.randomUUID();
  const senhaHash = await hashPassword("senha-admin-presence");
  await db.prepare(
    "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, NULL, 'Admin Presen\xE7a', ?, ?, 'admin', 1, ?, ?)"
  ).bind(id, `admin-presence-${id}`, senhaHash, seedTime, seedTime).run();
  const token = await createSessionToken(id, 1, sessionSecret);
  return `agenda_session=${token}`;
}
function apiRequest(path, cookie, init = {}) {
  return exports.default.fetch(
    new Request(`https://example.com${path}`, {
      method: init.method ?? "GET",
      headers: {
        Cookie: cookie,
        Origin: "https://example.com",
        ...init.body === void 0 ? {} : { "Content-Type": "application/json" }
      },
      body: init.body === void 0 ? void 0 : JSON.stringify(init.body)
    })
  );
}
function isoAgo(nowMs, ageMs) {
  return new Date(nowMs - ageMs).toISOString();
}
describe("presen\xE7a do conferente", () => {
  it("classifica os limites de 3 e 7 minutos", () => {
    const nowMs = Date.parse("2026-09-30T15:00:00.000Z");
    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, PRESENCE_ONLINE_WINDOW_MS),
        isoAgo(nowMs, 6e4),
        nowMs
      )
    ).toBe("online");
    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, PRESENCE_ONLINE_WINDOW_MS + 1),
        isoAgo(nowMs, PRESENCE_SIGNAL_WINDOW_MS),
        nowMs
      )
    ).toBe("away");
    expect(
      conferentePresenceStatus(
        isoAgo(nowMs, 6e4),
        isoAgo(nowMs, PRESENCE_SIGNAL_WINDOW_MS + 1),
        nowMs
      )
    ).toBe("offline");
  });
  it("heartbeat atualiza o sinal sem inventar nova intera\xE7\xE3o", async () => {
    const storeId = await seedStore(`P${crypto.randomUUID().slice(0, 8)}`);
    const conferente = await seedConferente(storeId, "heartbeat");
    const first = await apiRequest("/api/store/presence", conferente.cookie, {
      method: "POST",
      body: { interacted: true }
    });
    expect(first.status).toBe(200);
    const initial = await db.prepare(
      "SELECT loja_id, ultima_interacao_em, ultimo_sinal_em FROM conferente_presenca WHERE usuario_id = ?"
    ).bind(conferente.id).first();
    expect(initial?.loja_id).toBe(storeId);
    expect(initial?.ultima_interacao_em).toBeTruthy();
    expect(initial?.ultima_interacao_em).toBe(initial?.ultimo_sinal_em);
    const heartbeat = await apiRequest(
      "/api/store/presence",
      conferente.cookie,
      {
        method: "POST",
        body: { interacted: false }
      }
    );
    expect(heartbeat.status).toBe(200);
    const afterHeartbeat = await db.prepare(
      "SELECT ultima_interacao_em, ultimo_sinal_em FROM conferente_presenca WHERE usuario_id = ?"
    ).bind(conferente.id).first();
    expect(afterHeartbeat?.ultima_interacao_em).toBe(
      initial?.ultima_interacao_em
    );
    expect(Date.parse(afterHeartbeat.ultimo_sinal_em)).toBeGreaterThanOrEqual(
      Date.parse(initial.ultimo_sinal_em)
    );
    const offline = await apiRequest(
      "/api/store/presence",
      conferente.cookie,
      { method: "DELETE" }
    );
    expect(offline.status).toBe(204);
    expect(
      await db.prepare(
        "SELECT usuario_id FROM conferente_presenca WHERE usuario_id = ?"
      ).bind(conferente.id).first()
    ).toBeNull();
  });
  it("agrega por loja usando o conferente mais ativo", async () => {
    const nowMs = Date.now();
    const onlineStore = await seedStore(
      `O${crypto.randomUUID().slice(0, 8)}`
    );
    const awayStore = await seedStore(
      `A${crypto.randomUUID().slice(0, 8)}`
    );
    const offlineStore = await seedStore(
      `F${crypto.randomUUID().slice(0, 8)}`
    );
    const onlineUser = await seedConferente(onlineStore, "online");
    const onlineStoreAwayUser = await seedConferente(
      onlineStore,
      "online-store-away"
    );
    const awayUser = await seedConferente(awayStore, "away");
    const offlineUser = await seedConferente(offlineStore, "offline");
    const rows = [
      {
        userId: onlineUser.id,
        storeId: onlineStore,
        interaction: isoAgo(nowMs, 6e4),
        signal: isoAgo(nowMs, 6e4)
      },
      {
        userId: onlineStoreAwayUser.id,
        storeId: onlineStore,
        interaction: isoAgo(nowMs, 4 * 6e4),
        signal: isoAgo(nowMs, 6e4)
      },
      {
        userId: awayUser.id,
        storeId: awayStore,
        interaction: isoAgo(nowMs, 4 * 6e4),
        signal: isoAgo(nowMs, 6e4)
      },
      {
        userId: offlineUser.id,
        storeId: offlineStore,
        interaction: isoAgo(nowMs, 6e4),
        signal: isoAgo(nowMs, 8 * 6e4)
      }
    ];
    for (const row of rows) {
      await db.prepare(
        "INSERT INTO conferente_presenca (usuario_id, loja_id, ultima_interacao_em, ultimo_sinal_em, atualizado_em) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        row.userId,
        row.storeId,
        row.interaction,
        row.signal,
        row.signal
      ).run();
    }
    const adminCookie = await seedAdmin();
    const response = await apiRequest(
      "/api/admin/presence",
      adminCookie
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeId: onlineStore,
          status: "online"
        }),
        expect.objectContaining({
          storeId: awayStore,
          status: "away"
        }),
        expect.objectContaining({
          storeId: offlineStore,
          status: "offline"
        })
      ])
    );
  });
  it("bloqueia presen\xE7a de usu\xE1rio que n\xE3o \xE9 conferente", async () => {
    const adminCookie = await seedAdmin();
    const response = await apiRequest(
      "/api/store/presence",
      adminCookie,
      {
        method: "POST",
        body: { interacted: true }
      }
    );
    expect(response.status).toBe(403);
  });
});
