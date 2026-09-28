import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { listAudit, recordAudit } from "../../worker/repositories/audit";

const db = (env as unknown as { DB: D1Database }).DB;
const now = "2026-09-27T20:00:00.000Z";

beforeEach(async () => {
  await db.exec(
    "DELETE FROM auditoria; DELETE FROM historico_agenda; DELETE FROM historico_status; DELETE FROM agendamentos; DELETE FROM agendas; DELETE FROM usuarios; DELETE FROM lojas;",
  );
});

describe("auditoria", () => {
  it("registra quem, quando, ação e valores antes/depois", async () => {
    await db
      .prepare(
        "INSERT INTO lojas (id, codigo, nome, ativo, criado_em, atualizado_em) VALUES ('store-audit', 'F90', 'Loja Auditoria', 1, ?, ?)",
      )
      .bind(now, now)
      .run();

    await db
      .prepare(
        "INSERT INTO usuarios (id, loja_id, nome, login, senha_hash, papel, ativo, criado_em, atualizado_em) VALUES ('user-audit', 'store-audit', 'Conferente Auditoria', 'audit-user', 'hash', 'conferente', 1, ?, ?)",
      )
      .bind(now, now)
      .run();

    await recordAudit(db, {
      userId: "user-audit",
      action: "usuario_atualizado",
      entity: "usuario",
      entityId: "user-audit",
      storeId: "store-audit",
      before: { nome: "Nome antigo", ativo: true },
      after: { nome: "Nome novo", ativo: true },
      details: "Nome alterado.",
      createdAt: now,
    });

    const records = await listAudit(db, {
      entity: "usuario",
      entityId: "user-audit",
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      usuario_id: "user-audit",
      usuario_nome: "Conferente Auditoria",
      acao: "usuario_atualizado",
      entidade: "usuario",
      entidade_id: "user-audit",
      loja_id: "store-audit",
      detalhes: "Nome alterado.",
      criado_em: now,
    });
    expect(JSON.parse(records[0].antes!)).toEqual({
      nome: "Nome antigo",
      ativo: true,
    });
    expect(JSON.parse(records[0].depois!)).toEqual({
      nome: "Nome novo",
      ativo: true,
    });
  });

  it("aceita evento de sistema sem usuário autenticado", async () => {
    await recordAudit(db, {
      userId: null,
      action: "evento_sistema",
      entity: "agenda",
      entityId: "agenda-system",
      details: "Evento automático.",
      createdAt: now,
    });

    const records = await listAudit(db, {
      entity: "agenda",
      entityId: "agenda-system",
    });

    expect(records).toHaveLength(1);
    expect(records[0].usuario_id).toBeNull();
    expect(records[0].usuario_nome).toBeNull();
  });
});
