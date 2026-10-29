import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  changeAppointmentStatus,
  changeAppointmentExchanges,
  changeAgendaDayStatus
} from "../../worker/repositories/agendas.js";

// SQLite real, dados sintéticos e a mesma semântica transacional do D1.batch().
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec([
    "CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT, nome TEXT)",
    "CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT)",
    "CREATE TABLE agendas (id TEXT PRIMARY KEY, loja_id TEXT, data_agenda TEXT, arquivo_original TEXT, criado_por TEXT, status_dia TEXT, concluido_em TEXT, concluido_por TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendamentos (id TEXT PRIMARY KEY, agenda_id TEXT, protocolo TEXT, horario_inicio TEXT, horario_fim TEXT, fornecedor TEXT, itens INTEGER, volumes INTEGER, paletes INTEGER, carga_batida TEXT, tipo TEXT, nfe TEXT, pedidos TEXT, status TEXT, trocas INTEGER, observacao TEXT, origem TEXT, ativo INTEGER, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE historico_status (id TEXT PRIMARY KEY, agendamento_id TEXT NOT NULL, usuario_id TEXT NOT NULL, status_anterior TEXT NOT NULL, status_novo TEXT NOT NULL, observacao TEXT, alterado_em TEXT NOT NULL)",
    "CREATE TABLE historico_agenda (id TEXT PRIMARY KEY, agenda_id TEXT, usuario_id TEXT, acao TEXT, detalhes TEXT, alterado_em TEXT)",
    "CREATE TABLE auditoria (id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT)"
  ].join(";\n") + ";");
  sql.prepare("INSERT INTO lojas VALUES ('loja1','01','Loja sintética')").run();
  sql.prepare("INSERT INTO usuarios VALUES ('adm1','Administrador')").run();
  sql.prepare("INSERT INTO agendas VALUES ('agenda1','loja1','2026-10-29','teste.csv','adm1','aberto',NULL,NULL,'t0','t0')").run();
  sql.prepare("INSERT INTO agendamentos (id,agenda_id,protocolo,horario_inicio,horario_fim,fornecedor,status,trocas,observacao,origem,ativo,criado_em,atualizado_em) VALUES ('appt1','agenda1','P1','08:00','08:30','Fornecedor sintético','aguardando',0,NULL,'importado',1,'t0','t0')").run();
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      let args = [];
      const wrapper = {
        bind(...values) { args = values; return wrapper; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        async run() {
          const result = statement.run(...args);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return wrapper;
    },
    async batch(operations) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const op of operations) results.push(await op.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    }
  };
  const appointment = () => sql.prepare("SELECT * FROM agendamentos WHERE id='appt1'").get();
  const agenda = () => sql.prepare("SELECT * FROM agendas WHERE id='agenda1'").get();
  const count = (table) => sql.prepare("SELECT COUNT(*) AS n FROM " + table).get().n;
  return { sql, db, appointment, agenda, count };
}

describe("CAS de recebimentos e dias no D1 (SQLite sintético)", () => {
  it("impede sobrescrita de status e não cria histórico nem auditoria falsos", async () => {
    const f = fixture();
    try {
      const old = f.appointment();
      await changeAppointmentStatus(f.db, old, "adm1", "recebido");
      await assert.rejects(
        changeAppointmentStatus(f.db, old, "adm1", "recusado"),
        (error) => error.code === "CONFLITO_ESTADO"
      );
      assert.equal(f.appointment().status, "recebido");
      assert.equal(f.count("historico_status"), 1);
      assert.equal(f.count("auditoria"), 1);
    } finally { f.sql.close(); }
  });

  it("protege alterações de observação e de trocas com a mesma versão lida", async () => {
    const f = fixture();
    try {
      const old = f.appointment();
      await changeAppointmentStatus(f.db, old, "adm1", "aguardando", undefined, "Observação A");
      await assert.rejects(
        changeAppointmentStatus(f.db, old, "adm1", "recebido"),
        (error) => error.code === "CONFLITO_ESTADO"
      );
      const beforeExchanges = f.appointment();
      await changeAppointmentExchanges(f.db, beforeExchanges, "adm1", true);
      await assert.rejects(
        changeAppointmentExchanges(f.db, beforeExchanges, "adm1", true),
        (error) => error.code === "CONFLITO_ESTADO"
      );
      assert.equal(f.appointment().trocas, 1);
      assert.equal(f.appointment().observacao, "Observação A");
      assert.equal(f.count("historico_status"), 1);
      assert.equal(f.count("auditoria"), 2);
    } finally { f.sql.close(); }
  });

  it("conclui uma única vez, classifica pendências e preserva histórico no conflito", async () => {
    const f = fixture();
    try {
      const old = f.agenda();
      await changeAgendaDayStatus(f.db, old, "adm1", "concluido");
      await assert.rejects(
        changeAgendaDayStatus(f.db, old, "adm1", "concluido"),
        (error) => error.code === "CONFLITO_ESTADO"
      );
      assert.equal(f.agenda().status_dia, "concluido");
      assert.equal(f.appointment().status, "nao_chegou");
      assert.equal(f.appointment().observacao, "Não compareceu");
      assert.equal(f.count("historico_agenda"), 1);
      assert.equal(f.count("auditoria"), 2);
      await changeAgendaDayStatus(f.db, f.agenda(), "adm1", "aberto");
      assert.equal(f.agenda().status_dia, "aberto");
      assert.equal(f.count("historico_agenda"), 2);
      assert.equal(f.count("auditoria"), 3);
    } finally { f.sql.close(); }
  });
});
