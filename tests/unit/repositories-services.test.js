import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listAudit, parseAuditJson } from "../../worker/repositories/audit.js";
import { listStores, findActiveStoreById, hasStoreUsers } from "../../worker/repositories/stores.js";
import { listUsers, findUserByLogin } from "../../worker/repositories/users.js";
import { closePastOpenAgendas } from "../../worker/services/agenda-maintenance.js";
import { publishAgendaChanged, revokeRealtimeUser } from "../../worker/services/realtime.js";

function fakeDb(results = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async all() { return { results }; },
        async first() { return results[0] ?? null; },
        async run() { return { meta: { changes: 1 } }; }
      };
    },
    async batch(statements) {
      assert.ok(statements.length >= 2);
      return statements.map(() => ({ meta: { changes: 1 } }));
    }
  };
}

describe("Migração de repositórios e serviços JS", () => {
  it("auditoria mantém filtros e limite de consulta", async () => {
    const db = fakeDb([{ id: "a" }]);
    const rows = await listAudit(db, { entity: "agenda", agendaId: "a", limit: 999 });
    assert.deepEqual(rows, [{ id: "a" }]);
    assert.match(db.calls[0].sql, /ORDER BY a\.criado_em DESC/);
    assert.deepEqual(db.calls[0].values, ["agenda", "a", 500]);
    assert.deepEqual(parseAuditJson('{"acao":"status"}'), { acao: "status" });
    assert.equal(parseAuditJson("{quebrado"), null);
  });
  it("lojas e conferentes usam as mesmas consultas parametrizadas", async () => {
    const db = fakeDb([{ id: "l1", codigo: "01" }]);
    assert.equal((await listStores(db)).length, 1);
    assert.match(db.calls[0].sql, /tem_conferente_ativo|CASE WHEN EXISTS/);
    assert.equal((await findActiveStoreById(db, "l1")).id, "l1");
    assert.deepEqual(db.calls[1].values, ["l1"]);
    assert.equal(await hasStoreUsers(db, "l1"), true);
  });
  it("usuários preservam papel, versão de sessão e filtro de login", async () => {
    const db = fakeDb([{ id: "u", papel: "conferente" }]);
    assert.equal((await listUsers(db)).length, 1);
    assert.match(db.calls[0].sql, /session_version/);
    assert.equal((await findUserByLogin(db, "Usuario")).id, "u");
    assert.deepEqual(db.calls[1].values, ["Usuario"]);
    assert.match(db.calls[1].sql, /COLLATE NOCASE/);
  });
  it("fechamento diário preserva SQL de auditoria e regra de reabertura", async () => {
    const db = fakeDb();
    await closePastOpenAgendas(db, new Date("2026-10-18T15:00:00Z"));
    assert.equal(db.calls.length, 2);
    assert.match(db.calls[0].sql, /INSERT INTO auditoria/);
    assert.match(db.calls[1].sql, /UPDATE agendas/);
    for (const call of db.calls) {
      assert.match(call.sql, /reaberto/);
      assert.ok(call.values.includes("2026-10-18"));
    }
  });
  it("tempo real desligado não dispara requisição ao Durable Object", async () => {
    assert.equal(await publishAgendaChanged({ REALTIME_MODE: "off" }, { agendaId: "a" }), false);
    assert.equal(await revokeRealtimeUser({ REALTIME_MODE: "off" }, "u1"), false);
  });
});