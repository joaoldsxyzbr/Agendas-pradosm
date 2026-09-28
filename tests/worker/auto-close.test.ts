import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../../worker/lib/session";
import { businessDate } from "../../worker/lib/time";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const now = "2026-09-24T12:00:00.000Z";

async function seedStoreUser() {
  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES ('store-auto-close', 'FAC', 'Loja Auto Close', 1, ?, ?)",
    )
    .bind(now, now)
    .run();

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES ('user-auto-close', 'store-auto-close', 'Conferente Auto Close', 'auto-close', ?, 'conferente', 1, ?, ?)",
    )
    .bind(passwordHash, now, now)
    .run();

  const token = await createSessionToken("user-auto-close", sessionSecret);
  return `agenda_session=${token}`;
}

async function seedAgenda(id: string, date: string) {
  await db
    .prepare(
      "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, 'store-auto-close', ?, 'agenda.pdf', 'user-auto-close', ?, ?)",
    )
    .bind(id, date, now, now)
    .run();
}

describe("conclusão automática de agendas", () => {
  it("conclui agenda anterior ao dia atual e preserva a data original", async () => {
    const cookie = await seedStoreUser();
    const today = businessDate(new Date());

    await seedAgenda("agenda-auto-close-past", "2026-01-01");
    await seedAgenda("agenda-auto-close-today", today);

    const response = await exports.default.fetch(
      new Request("https://example.com/api/store/today", {
        headers: { Cookie: cookie },
      }),
    );

    expect(response.status).toBe(200);

    const past = await db
      .prepare(
        "SELECT data_agenda, status_dia, concluido_em, concluido_por FROM agendas WHERE id = 'agenda-auto-close-past'",
      )
      .first<{
        data_agenda: string;
        status_dia: string;
        concluido_em: string | null;
        concluido_por: string | null;
      }>();
    const current = await db
      .prepare(
        "SELECT status_dia, concluido_em FROM agendas WHERE id = 'agenda-auto-close-today'",
      )
      .first<{ status_dia: string; concluido_em: string | null }>();

    expect(past).toMatchObject({
      data_agenda: "2026-01-01",
      status_dia: "concluido",
      concluido_por: null,
    });
    expect(past?.concluido_em).toBeTruthy();
    expect(current).toEqual({ status_dia: "aberto", concluido_em: null });

    const audit = await db
      .prepare(
        "SELECT usuario_id, acao FROM auditoria WHERE agenda_id = 'agenda-auto-close-past' AND acao = 'dia_concluido_automaticamente'",
      )
      .all<{ usuario_id: string | null; acao: string }>();

    expect(audit.results).toEqual([
      { usuario_id: null, acao: "dia_concluido_automaticamente" },
    ]);
  });
});
