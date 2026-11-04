import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listAdminAgendas, listAdminAgendasPage } from "../../worker/repositories/agendas.ts";
import { app } from "../../worker/app.ts";
import { createSessionToken } from "../../worker/lib/session.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec([
    "CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT NOT NULL, nome TEXT NOT NULL)",
    "CREATE TABLE usuarios (id TEXT PRIMARY KEY, loja_id TEXT, nome TEXT, login TEXT, senha_hash TEXT, papel TEXT, ativo INTEGER, session_version INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendas (id TEXT PRIMARY KEY, loja_id TEXT, data_agenda TEXT, arquivo_original TEXT, criado_por TEXT, status_dia TEXT, concluido_em TEXT, concluido_por TEXT, digitado_em TEXT, digitado_por TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendamentos (id TEXT PRIMARY KEY, agenda_id TEXT, horario_inicio TEXT, ativo INTEGER, status TEXT, origem TEXT)",
    "CREATE INDEX idx_agendamentos_agenda_horario ON agendamentos (agenda_id, horario_inicio)"
  ].join(";") + ";");
  for (let s = 1; s <= 3; s++) {
    sqlite.prepare("INSERT INTO lojas (id,codigo,nome) VALUES (?,?,?)").run(`l${s}`, `F0${s}`, `Loja ${s}`);
  }
  sqlite.prepare("INSERT INTO usuarios (id,nome,papel,ativo,session_version) VALUES ('admin-sintetico','Administrador','admin',1,1)").run();
  const agenda = sqlite.prepare("INSERT INTO agendas (id,loja_id,data_agenda,status_dia) VALUES (?,?,?,'aberto')");
  const agendamento = sqlite.prepare("INSERT INTO agendamentos (id,agenda_id,horario_inicio,ativo,status,origem) VALUES (?,?,?,?,?,?)");
  for (let day = 1; day <= 18; day++) {
    const date = `2026-10-${String(day).padStart(2, "0")}`;
    for (let store = 1; store <= 3; store++) {
      const id = `a-${day}-${store}`;
      agenda.run(id, `l${store}`, date);
      agendamento.run(id + "-1", id, "08:00", 1, "aguardando", "importado");
      agendamento.run(id + "-2", id, "09:00", 1, "recebido", "importado");
      agendamento.run(id + "-3", id, "10:00", 0, "recusado", "manual");
    }
  }
  let lastSql = "";
  const db = {
    prepare(sql) {
      lastSql = sql;
      const stmt = sqlite.prepare(sql);
      let args = [];
      const request = {
        bind(...values) { args = values; return request; },
        async all() { return { results: stmt.all(...args) }; },
        async first() { return stmt.get(...args) ?? null; }
      };
      return request;
    }
  };
  return { sqlite, db, getLastSql: () => lastSql };
}

describe("Paginação do histórico administrativo (SQLite sintético)", () => {
  it("reproduz todas as agendas e totais em páginas sem repetir linhas", async () => {
    const f = fixture();
    try {
      const legacy = await listAdminAgendas(f.db);
      assert.equal(legacy.length, 54);
      const gathered = [];
      for (let offset = 0; offset <= 60; offset += 20) {
        const page = await listAdminAgendasPage(f.db, {}, 20, offset);
        assert.equal(page.items.length, Math.min(20, Math.max(0, 54 - offset)));
        assert.equal(page.hasMore, offset + 20 < 54);
        assert.match(f.getLastSql(), /WITH selected AS/);
        gathered.push(...page.items);
      }
      // Impede regressão para uma varredura completa das agendas após a seleção.
      const statement = f.getLastSql();
      assert.match(statement, /FROM selected p\s+CROSS JOIN agendas a/);
      assert.deepEqual(gathered.map(row => row.id), legacy.map(row => row.id));
      assert.ok(gathered.every(row =>
        row.total === 2 && row.aguardando === 1 && row.recebido === 1 && row.recusado === 0
      ));
      assert.equal(new Set(gathered.map(row => row.id)).size, 54);
    } finally {
      f.sqlite.close();
    }
  });


  it("mantém array legado e valida parâmetros e resposta opt-in na rota HTTP", async () => {
    const f = fixture();
    const secret = "teste-historico-sintetico-sem-segredo-real";
    try {
      const token = await createSessionToken("admin-sintetico", 1, secret);
      const env = { DB: f.db, SESSION_SECRET: secret, REALTIME_MODE: "off" };
      const get = async (query = "") => app.request("http://localhost/api/admin/agendas" + query, {
        method: "GET", headers: { Cookie: "agenda_session=" + token }
      }, env);
      const legacy = await get();
      assert.equal(legacy.status, 200);
      const legacyRows = await legacy.json();
      assert.equal(Array.isArray(legacyRows), true);
      assert.equal(legacyRows.length, 54);
      const first = await get("?limit=20&offset=0");
      assert.equal(first.status, 200);
      const firstData = await first.json();
      assert.deepEqual(Object.keys(firstData).sort(), ["hasMore", "items"]);
      assert.equal(firstData.items.length, 20);
      assert.equal(firstData.hasMore, true);
      assert.deepEqual(firstData.items.map(row => row.id), legacyRows.slice(0, 20).map(row => row.id));
      const second = await get("?limit=20&offset=40&storeCode=F01");
      assert.equal(second.status, 200);
      assert.deepEqual(await second.json(), { items: [], hasMore: false });
      for (const query of ["?limit=0", "?limit=51", "?limit=abc", "?offset=20", "?limit=20&offset=-1"]) {
        const invalid = await get(query);
        assert.equal(invalid.status, 400, query);
      }
    } finally {
      f.sqlite.close();
    }
  });

  it("filtra por loja e data sem vazar agendas das demais lojas", async () => {
    const f = fixture();
    try {
      const filtered = await listAdminAgendasPage(f.db, { date: "2026-10-07", storeCode: "F02" }, 20, 0);
      assert.equal(filtered.hasMore, false);
      assert.deepEqual(filtered.items.map(row => row.id), ["a-7-2"]);
      const store = await listAdminAgendasPage(f.db, { storeCode: "F01" }, 10, 10);
      assert.equal(store.items.length, 8);
      assert.equal(store.hasMore, false);
      assert.ok(store.items.every(row => row.store_code === "F01"));
      const empty = await listAdminAgendasPage(f.db, { date: "2026-11-04" }, 20, 0);
      assert.deepEqual(empty, { items: [], hasMore: false });
    } finally {
      f.sqlite.close();
    }
  });
});
