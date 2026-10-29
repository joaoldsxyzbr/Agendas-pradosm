import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.js";
import { createSessionToken } from "../../worker/lib/session.js";

const SECRET = "somente-testes-sinteticos-sem-credencial-real-2026";

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec([
    "CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT, nome TEXT, ativo INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE usuarios (id TEXT PRIMARY KEY, loja_id TEXT, nome TEXT, login TEXT, senha_hash TEXT, papel TEXT, ativo INTEGER, session_version INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendas (id TEXT PRIMARY KEY, loja_id TEXT, data_agenda TEXT, arquivo_original TEXT, criado_por TEXT, status_dia TEXT, concluido_em TEXT, concluido_por TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendamentos (id TEXT PRIMARY KEY, agenda_id TEXT, protocolo TEXT, horario_inicio TEXT, horario_fim TEXT, fornecedor TEXT, itens INTEGER, volumes INTEGER, paletes INTEGER, carga_batida TEXT, tipo TEXT, nfe TEXT, pedidos TEXT, status TEXT, trocas INTEGER, observacao TEXT, origem TEXT, ativo INTEGER, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE historico_status (id TEXT PRIMARY KEY, agendamento_id TEXT, usuario_id TEXT, status_anterior TEXT, status_novo TEXT, observacao TEXT, alterado_em TEXT)",
    "CREATE TABLE auditoria (id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT)"
  ].join(";\n") + ";");
  const now = "2026-10-21T12:00:00.000Z";
  sqlite.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES (?,?,?,1)").run("loja1", "01", "Loja sintética 1");
  sqlite.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES (?,?,?,1)").run("loja2", "02", "Loja sintética 2");
  const addUser = sqlite.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,ativo,session_version) VALUES (?,?,?,?,?,?,1,1)");
  addUser.run("conf1", "loja1", "Conferente 1", "conf1", "sintetico", "conferente");
  addUser.run("conf2", "loja2", "Conferente 2", "conf2", "sintetico", "conferente");
  addUser.run("adm1", null, "Administrador", "adm1", "sintetico", "admin");
  addUser.run("view1", null, "Visualizador", "view1", "sintetico", "visualizador");
  sqlite.prepare("INSERT INTO agendas (id,loja_id,data_agenda,arquivo_original,criado_por,status_dia,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?)")
    .run("agenda1", "loja1", "2026-10-21", "sintetico.csv", "adm1", "aberto", now, now);
  sqlite.prepare("INSERT INTO agendamentos (id,agenda_id,protocolo,horario_inicio,horario_fim,fornecedor,nfe,pedidos,status,trocas,observacao,origem,ativo,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("agend1", "agenda1", "001", "08:00", "08:30", "Fornecedor sintético", "[]", "[]", "aguardando", 0, null, "importado", 1, now, now);

  let simulateAuditFailure = false;
  let simulateConcurrentUpdate = false;
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let bindings = [];
      const request = {
        sql,
        bind(...values) { bindings = values; return request; },
        async first() {
          const row = statement.get(...bindings) ?? null;
          // Replica outra solicitação que grava após a leitura da primeira.
          if (simulateConcurrentUpdate && sql.includes("FROM agendamentos ag")) {
            simulateConcurrentUpdate = false;
            sqlite.prepare("UPDATE agendamentos SET status='recusado' WHERE id='agend1'").run();
          }
          return row;
        },
        async all() { return { results: statement.all(...bindings) }; },
        async run() {
          if (simulateAuditFailure && sql.includes("INSERT INTO auditoria")) {
            throw new Error("falha de auditoria sintética");
          }
          const result = statement.run(...bindings);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return request;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
  const env = { DB: db, SESSION_SECRET: SECRET, REALTIME_MODE: "off" };
  async function callAs(userId, path, body, extraHeaders = {}) {
    const token = await createSessionToken(userId, 1, SECRET);
    return app.request("http://localhost" + path, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        Cookie: "agenda_session=" + token,
        ...extraHeaders
      },
      body: JSON.stringify(body)
    }, env);
  }
  const status = () => ({ ...sqlite.prepare("SELECT status,observacao FROM agendamentos WHERE id='agend1'").get() });
  const historyCount = () => sqlite.prepare("SELECT count(*) AS n FROM historico_status").get().n;
  const auditCount = () => sqlite.prepare("SELECT count(*) AS n FROM auditoria").get().n;
  return {
    sqlite, callAs, status, historyCount, auditCount,
    failAudit: () => { simulateAuditFailure = true; },
    concurrentUpdateOnNextRead: () => { simulateConcurrentUpdate = true; }
  };
}

describe("Recebimento integrado: Worker + SQLite sintético, sem mocks de endpoints", () => {
  it("restringe loja e perfis, exige motivo e preserva histórico", async () => {
    const f = createFixture();
    try {
      const path = "/api/store/appointments/agend1/status";
      assert.equal((await f.callAs("adm1", path, { status: "recebido" })).status, 403);
      assert.equal((await f.callAs("view1", path, { status: "recebido" })).status, 403);
      assert.equal((await f.callAs("conf2", path, { status: "recebido" })).status, 404);
      assert.equal((await f.callAs("conf1", path, { status: "nao_chegou" })).status, 400);
      assert.equal(f.historyCount(), 0);
      assert.equal((await f.callAs("conf1", path, { status: "nao_chegou", observation: "Sem pedido" })).status, 200);
      assert.deepEqual(f.status(), { status: "nao_chegou", observacao: "Sem pedido" });
      assert.equal(f.historyCount(), 1);
      assert.equal(f.auditCount(), 1);
      assert.equal((await f.callAs("conf1", path, { status: "recebido", observation: null })).status, 200);
      assert.deepEqual(f.status(), { status: "recebido", observacao: null });
      assert.equal(f.historyCount(), 2);
      assert.equal(f.auditCount(), 2);
      f.sqlite.prepare("UPDATE agendas SET status_dia='concluido' WHERE id='agenda1'").run();
      assert.equal((await f.callAs("conf1", path, { status: "aguardando" })).status, 409);
      assert.equal(f.historyCount(), 2);
    } finally {
      f.sqlite.close();
    }
  });

  it("faz rollback do status e histórico quando gravação de auditoria falha", async () => {
    const f = createFixture();
    try {
      f.failAudit();
      const response = await f.callAs("conf1", "/api/store/appointments/agend1/status", { status: "recebido" });
      assert.equal(response.status, 500);
      assert.deepEqual(f.status(), { status: "aguardando", observacao: null });
      assert.equal(f.historyCount(), 0);
      assert.equal(f.auditCount(), 0);
    } finally {
      f.sqlite.close();
    }
  });
  it("devolve HTTP 409 quando outra requisição alterou o status", async () => {
    const f = createFixture();
    try {
      f.concurrentUpdateOnNextRead();
      const response = await f.callAs("conf1", "/api/store/appointments/agend1/status", { status: "recebido" });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, "CONFLITO_ESTADO");
      assert.deepEqual(f.status(), { status: "recusado", observacao: null });
      assert.equal(f.historyCount(), 0);
      assert.equal(f.auditCount(), 0);
    } finally {
      f.sqlite.close();
    }
  });

});