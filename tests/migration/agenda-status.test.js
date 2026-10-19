import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changeAppointmentStatus } from "../../worker/repositories/agendas.js";

const baseAppointment = { id: "appt1", agenda_id: "agenda1", status: "aguardando" };

function fakeDb() {
  const statements = [];
  const batches = [];
  const database = {
    statements,
    batches,
    prepare(sql) {
      const stmt = {
        sql, params: [],
        bind(...values) { this.params = values; return this; },
        async first() {
          if (sql.includes("FROM agendas a")) return {
            id: "agenda1", loja_id: "loja1", status_dia: "aberto",
            store_code: "01", store_name: "Loja 01"
          };
          if (sql.includes("FROM agendamentos WHERE id = ?")) return {
            ...baseAppointment, status: "recebido"
          };
          throw Error("Consulta não esperada: " + sql);
        }
      };
      statements.push(stmt);
      return stmt;
    },
    async batch(rows) { batches.push(rows); return rows.map(() => ({ meta: { changes: 1 } })); }
  };
  return database;
}

describe("Regras de status com observação e histórico", () => {
  it("não faz operações D1 quando status não muda", async () => {
    const db = fakeDb();
    const result = await changeAppointmentStatus(db, baseAppointment, "admin1", "aguardando");
    assert.equal(result, baseAppointment);
    assert.equal(db.statements.length, 0);
  });

  it("grava status, histórico e auditoria em um único batch", async () => {
    const db = fakeDb();
    const result = await changeAppointmentStatus(db, baseAppointment, "admin1", "recebido");
    assert.equal(result.status, "recebido");
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0].length, 3);
    const statusUpdate = db.statements.find(s => s.sql.startsWith("UPDATE agendamentos"));
    assert.equal(statusUpdate.sql, "UPDATE agendamentos SET status = ?, observacao = ?, atualizado_em = ? WHERE id = ?");
    assert.equal(statusUpdate.params[1], null);
    assert.equal(statusUpdate.params[0], "recebido");
    const history = db.statements.find(s => s.sql.includes("INSERT INTO historico_status"));
    assert.ok(history);
    const audit = db.statements.find(s => s.sql.includes("INSERT INTO auditoria"));
    assert.ok(audit);
    assert.equal(JSON.stringify(db.statements).includes("observacao"), true);
  });
  it("bloqueia não recebido sem motivo e não altera o banco", async () => {
    const db = fakeDb();
    await assert.rejects(
      changeAppointmentStatus(db, baseAppointment, "conf1", "nao_chegou"),
      /Motivo obrigatório/
    );
    assert.equal(db.batches.length, 0);
  });
  it("salva o motivo em status, histórico e auditoria", async () => {
    const db = fakeDb();
    await changeAppointmentStatus(db, baseAppointment, "conf1", "nao_chegou", undefined, "Sem pedido");
    const statusUpdate = db.statements.find(s => s.sql.startsWith("UPDATE agendamentos"));
    const history = db.statements.find(s => s.sql.includes("INSERT INTO historico_status"));
    assert.equal(statusUpdate.params[1], "Sem pedido");
    assert.equal(history.params[5], "Sem pedido");
    assert.equal(db.batches.length, 1);
  });
  it("limpa a observação atual sem perder o histórico anterior", async () => {
    const db = fakeDb();
    await changeAppointmentStatus(db, { ...baseAppointment, status: "nao_chegou", observacao: "Sem pedido" },
      "conf1", "recebido");
    const statusUpdate = db.statements.find(s => s.sql.startsWith("UPDATE agendamentos"));
    const history = db.statements.find(s => s.sql.includes("INSERT INTO historico_status"));
    assert.equal(statusUpdate.params[1], null);
    assert.equal(history.params[3], "nao_chegou");
    assert.equal(history.params[4], "recebido");
  });
});
