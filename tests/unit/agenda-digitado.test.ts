import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setAgendaDigitado } from "../../worker/repositories/agendas.ts";

const baseAgenda = {
  id: "agenda1", loja_id: "loja1", digitado_em: null, digitado_por: null,
  store_code: "F01", store_name: "Loja 01"
};

function fakeDb(agenda = { ...baseAgenda }) {
  const state = { agenda };
  const statements = [];
  const batches = [];
  const database = {
    statements,
    batches,
    failChanges: false,
    prepare(sql) {
      const stmt = {
        sql, params: [],
        bind(...values) { this.params = values; return this; },
        async first() {
          if (sql.includes("FROM agendas a")) return { ...state.agenda };
          throw Error("Consulta não esperada: " + sql);
        }
      };
      statements.push(stmt);
      return stmt;
    },
    async batch(rows) {
      batches.push(rows);
      if (database.failChanges) return rows.map(() => ({ meta: { changes: 0 } }));
      const update = rows[0];
      if (update.sql.includes("digitado_em IS NOT NULL")) {
        state.agenda = { ...state.agenda, digitado_em: null, digitado_por: null };
      } else if (update.sql.includes("digitado_em IS NULL")) {
        state.agenda = { ...state.agenda, digitado_em: update.params[0], digitado_por: update.params[1] };
      }
      return rows.map(() => ({ meta: { changes: 1 } }));
    }
  };
  return database;
}

describe("Marcação de agenda digitada para o conferente", () => {
  it("não faz operações D1 quando a marcação não muda", async () => {
    const db = fakeDb({ ...baseAgenda, digitado_em: "2026-11-03T10:00:00.000Z", digitado_por: "adm" });
    const result = await setAgendaDigitado(db, { ...baseAgenda, digitado_em: "2026-11-03T10:00:00.000Z" }, "adm", true);
    assert.equal(result.digitado_em, "2026-11-03T10:00:00.000Z");
    assert.equal(db.batches.length, 0);
  });

  it("marca digitada com guarda concorrente e auditoria em um único batch", async () => {
    const db = fakeDb();
    const result = await setAgendaDigitado(db, { ...baseAgenda }, "admin1", true);
    assert.equal(result.digitado_em, db.batches[0][0].params[0]);
    assert.equal(result.digitado_por, "admin1");
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0].length, 2);
    const update = db.statements.find(s => s.sql.startsWith("UPDATE agendas"));
    assert.equal(update.sql,
      "UPDATE agendas SET digitado_em = ?, digitado_por = ?, atualizado_em = ? WHERE id = ? AND digitado_em IS NULL");
    assert.equal(update.params[1], "admin1");
    assert.equal(update.params[3], "agenda1");
    const audit = db.statements.find(s => s.sql.includes("INSERT INTO auditoria"));
    assert.ok(audit);
    assert.equal(audit.params[2], "agenda_digitada_para_conferente");
    assert.match(audit.sql, /WHERE changes\\(\\) = 1/);
  });

  it("remove a marcação com guarda e auditoria próprias", async () => {
    const db = fakeDb({ ...baseAgenda, digitado_em: "2026-11-03T10:00:00.000Z", digitado_por: "admin1" });
    const result = await setAgendaDigitado(
      db,
      { ...baseAgenda, digitado_em: "2026-11-03T10:00:00.000Z", digitado_por: "admin1" },
      "admin1",
      false
    );
    assert.equal(result.digitado_em, null);
    assert.equal(result.digitado_por, null);
    const update = db.statements.find(s => s.sql.startsWith("UPDATE agendas"));
    assert.equal(update.sql,
      "UPDATE agendas SET digitado_em = NULL, digitado_por = NULL, atualizado_em = ? WHERE id = ? AND digitado_em IS NOT NULL");
    const audit = db.statements.find(s => s.sql.includes("INSERT INTO auditoria"));
    assert.equal(audit.params[2], "agenda_digitacao_removida");
  });

  it("conflito concorrente falha sem registrar auditoria fictícia", async () => {
    const db = fakeDb();
    db.failChanges = true;
    await assert.rejects(
      setAgendaDigitado(db, { ...baseAgenda }, "admin1", true),
      /alterada por outra operação/
    );
    assert.equal(db.batches.length, 1);
  });
});
