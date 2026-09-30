import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import type { WorkerEnv } from "../../worker/env";
import { createSessionToken } from "../../worker/lib/session";
import { businessDate } from "../../worker/lib/time";
import { listAgendaHistory } from "../../worker/repositories/agendas";

const db = (env as unknown as { DB: D1Database }).DB;
const sessionSecret = "agenda-prado-test-session-secret";
const passwordHash =
  "pbkdf2_sha256$100000$AAECAwQFBgcICQoLDA0ODw==$AYxgQLgLfLPsbb0egTJrnCsUalhEK5g5ZPOz/f7bl64=";
const now = "2026-09-24T12:00:00.000Z";

async function seedStoreUser(suffix: string) {
  const storeId = `store-auto-close-${suffix}`;
  const userId = `user-auto-close-${suffix}`;

  await db
    .prepare(
      "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(storeId, `FAC-${suffix}`, `Loja Auto Close ${suffix}`, now, now)
    .run();

  await db
    .prepare(
      "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 'conferente', 1, ?, ?)",
    )
    .bind(
      userId,
      storeId,
      `Conferente Auto Close ${suffix}`,
      `auto-close-${suffix}`,
      passwordHash,
      now,
      now,
    )
    .run();

  const token = await createSessionToken(userId, 1, sessionSecret);
  return {
    cookie: `agenda_session=${token}`,
    storeId,
    userId,
  };
}

async function seedAgenda(
  id: string,
  date: string,
  storeId: string,
  userId: string,
) {
  await db
    .prepare(
      "INSERT INTO agendas (id, loja_id, data_agenda, arquivo_original, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, 'agenda.pdf', ?, ?, ?)",
    )
    .bind(id, storeId, date, userId, now, now)
    .run();
}

async function agendaState(id: string) {
  return db
    .prepare(
      "SELECT data_agenda, status_dia, concluido_em, concluido_por FROM agendas WHERE id = ?",
    )
    .bind(id)
    .first<{
      data_agenda: string;
      status_dia: string;
      concluido_em: string | null;
      concluido_por: string | null;
    }>();
}

describe("conclusão automática de agendas", () => {
  it("conclui agenda anterior ao dia atual e preserva a data original", async () => {
    const seeded = await seedStoreUser("http");
    const today = businessDate(new Date());

    await seedAgenda(
      "agenda-auto-close-past",
      "2026-01-01",
      seeded.storeId,
      seeded.userId,
    );
    await seedAgenda(
      "agenda-auto-close-today",
      today,
      seeded.storeId,
      seeded.userId,
    );

    const response = await exports.default.fetch(
      new Request("https://example.com/api/store/today", {
        headers: { Cookie: seeded.cookie },
      }),
    );

    expect(response.status).toBe(200);

    const past = await agendaState("agenda-auto-close-past");
    const current = await agendaState("agenda-auto-close-today");

    expect(past).toMatchObject({
      data_agenda: "2026-01-01",
      status_dia: "concluido",
      concluido_por: null,
    });
    expect(past?.concluido_em).toBeTruthy();
    expect(current).toMatchObject({
      status_dia: "aberto",
      concluido_em: null,
    });

    const audit = await db
      .prepare(
        "SELECT usuario_id, acao FROM auditoria WHERE agenda_id = 'agenda-auto-close-past' AND acao = 'dia_concluido_automaticamente'",
      )
      .all<{ usuario_id: string | null; acao: string }>();

    expect(audit.results).toEqual([
      { usuario_id: null, acao: "dia_concluido_automaticamente" },
    ]);

    const dayHistory = await listAgendaHistory(db, "agenda-auto-close-past");
    expect(dayHistory).toEqual([
      expect.objectContaining({
        agenda_id: "agenda-auto-close-past",
        usuario_id: null,
        usuario_nome: null,
        acao: "concluido_automaticamente",
        detalhes:
          "Dia concluído automaticamente após a virada da data operacional.",
      }),
    ]);
  });

  it("fecha agendas passadas pelo handler scheduled sem depender de acesso HTTP", async () => {
    const seeded = await seedStoreUser("cron");

    await seedAgenda(
      "agenda-cron-past",
      "2026-09-28",
      seeded.storeId,
      seeded.userId,
    );
    await seedAgenda(
      "agenda-cron-current",
      "2026-09-29",
      seeded.storeId,
      seeded.userId,
    );

    await worker.scheduled(
      {
        cron: "5 3 * * *",
        scheduledTime: new Date("2026-09-29T03:05:00.000Z").getTime(),
        noRetry() {},
      } as ScheduledController,
      env as unknown as WorkerEnv,
      {} as ExecutionContext,
    );

    expect(await agendaState("agenda-cron-past")).toMatchObject({
      data_agenda: "2026-09-28",
      status_dia: "concluido",
      concluido_por: null,
    });
    expect(await agendaState("agenda-cron-current")).toMatchObject({
      data_agenda: "2026-09-29",
      status_dia: "aberto",
      concluido_em: null,
    });

    const audit = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM auditoria WHERE agenda_id = 'agenda-cron-past' AND acao = 'dia_concluido_automaticamente'",
      )
      .first<{ total: number }>();

    expect(audit?.total).toBe(1);
  });
});
