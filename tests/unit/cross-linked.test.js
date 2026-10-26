import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { adminLinkedCrossRoutes, storeLinkedCrossRoutes } from "../../worker/routes/cross-linked.js";

const migration = path => readFileSync(new URL(path, import.meta.url), "utf8");
const DATE = "2026-10-26";
const ADMIN = { id: "admin1", papel: "admin" };
const DOCK = { id: "dock-user", papel: "conferente", lojaCodigo: "CD DOCA 01", lojaId: "dock1" };

function synthetic() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE lojas (
      id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, excluido_em TEXT
    );
    CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT, papel TEXT);
    CREATE TABLE agendas (
      id TEXT PRIMARY KEY, loja_id TEXT NOT NULL REFERENCES lojas(id),
      data_agenda TEXT NOT NULL, status_dia TEXT NOT NULL DEFAULT 'aberto'
    );
    CREATE TABLE agendamentos (
      id TEXT PRIMARY KEY, agenda_id TEXT NOT NULL REFERENCES agendas(id),
      protocolo TEXT NOT NULL, fornecedor TEXT NOT NULL, horario_inicio TEXT NOT NULL,
      horario_fim TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE auditoria (
      id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT,
      loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT, depois TEXT,
      detalhes TEXT, criado_em TEXT
    );
    INSERT INTO lojas (id,codigo,nome) VALUES
      ('dock1','CD DOCA 01','CD Doca 1'), ('other1','CD DOCA 02','CD Doca 2');
    INSERT INTO usuarios (id,nome,papel) VALUES ('admin1','Admin Teste','admin');
    INSERT INTO agendas (id,loja_id,data_agenda,status_dia) VALUES
      ('agenda1','dock1','2026-10-26','aberto'),
      ('agenda2','other1','2026-10-26','aberto'),
      ('agenda-old','dock1','2026-10-25','aberto'),
      ('agenda-done','dock1','2026-10-27','concluido');
    INSERT INTO agendamentos (id,agenda_id,protocolo,fornecedor,horario_inicio,horario_fim) VALUES
      ('ap1','agenda1','99026101','TESTE - ALFA','07:00','07:30'),
      ('ap2','agenda1','99026102','TESTE - BETA','08:10','08:40'),
      ('ap-other','agenda2','99026103','TESTE - GAMA','09:20','09:50'),
      ('ap-old','agenda-old','99026104','TESTE - DELTA','12:30','13:00'),
      ('ap-done','agenda-done','99026105','TESTE - EPSILON','15:00','15:30');
  `);
  sqlite.exec(migration("../../migrations/0020_cross_docking.sql"));
  sqlite.exec(migration("../../migrations/0021_cross_agendamento_vinculo.sql"));
  const d1 = {
    prepare(sql) {
      const query = sqlite.prepare(sql);
      let args = [];
      const obj = {
        bind(...values) { args = values; return obj; },
        async first() { return query.get(...args) ?? null; },
        async all() { return { results: query.all(...args) }; },
        async run() {
          const result = query.run(...args);
          return { meta: { changes: Number(result.changes) } };
        }
      };
      return obj;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    }
  };
  return { sqlite, d1 };
}

const row = {
  storeNumber: "01", storeName: "LOJA UM",
  department: "MERCEARIA", productCode: "12345", description: "PRODUTO SINTETICO",
  gtin: "7896007811298", orderCode: "80776", dispatchCode: "27896007811292",
  packageSize: 24, dispatchQty: 1, separateQty: 24
};
function input(extra = {}) {
  return {
    operationalDate: DATE, reportDate: DATE, reportCode: "Scm405",
    reference: "Carga sintética", fileName: "cross-sintetico.pdf",
    declared: { lines: 1, dispatchQty: 1, separateQty: 24 },
    rows: [row], ...extra
  };
}

function client(d1, actor, routes) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", actor);
    await next();
  });
  app.route("/cross", routes);
  return (path, body) => app.request("https://test.example/cross" + path, body ? {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  } : undefined, { DB: d1 });
}
const path = (agenda = "agenda1", appointment = "ap1") =>
  `/agendas/${agenda}/appointments/${appointment}`;
const json = async response => response.json();

describe("Cross P1: migração aditiva e API por agendamento", () => {
  it("aceita dados legados não vinculados e não os inclui na consulta por fornecedor", async () => {
    const { sqlite, d1 } = synthetic();
    try {
      sqlite.prepare(`INSERT INTO cross_relatorios
        (id,data_operacional,data_relatorio,codigo_relatorio,arquivo_original,
         hash_conteudo,lojas,linhas,quantidade_expedicao,quantidade_separar,criado_por,criado_em)
         VALUES ('legacy',?,?,?,?,?,?,?,?,?,?,?)`)
        .run(DATE, DATE, "Scm405", "legado.pdf", "legacyhash", 1, 1, 1, 24, "admin1", DATE);
      const legacy = sqlite.prepare("SELECT agenda_id,agendamento_id,versao,ativo FROM cross_relatorios WHERE id = 'legacy'").get();
      assert.deepEqual({ ...legacy }, { agenda_id: null, agendamento_id: null, versao: 1, ativo: 1 });
      const get = client(d1, ADMIN, adminLinkedCrossRoutes);
      const result = await get("/agendas/agenda1");
      assert.equal(result.status, 200);
      assert.deepEqual((await json(result)).suppliers, []);
    } finally { sqlite.close(); }
  });

  it("importa Cross em agendamento exato, lista por agenda e libera somente a Doca 1", async () => {
    const { sqlite, d1 } = synthetic();
    try {
      const adm = client(d1, ADMIN, adminLinkedCrossRoutes);
      const store = client(d1, DOCK, storeLinkedCrossRoutes);
      const created = await adm(path(), input());
      assert.equal(created.status, 201, JSON.stringify(await created.clone().json()));
      const saved = await json(created);
      assert.equal(saved.agendaId, "agenda1");
      assert.equal(saved.appointmentId, "ap1");
      assert.equal(saved.version, 1);
      const list = await json(await store("/agendas/agenda1"));
      assert.equal(list.suppliers.length, 1);
      assert.equal(list.suppliers[0].appointment.supplier, "TESTE - ALFA");
      const detail = await store(path());
      assert.equal(detail.status, 200);
      assert.equal((await json(detail)).rows[0].description, "PRODUTO SINTETICO");
      assert.equal((await client(d1, DOCK, storeLinkedCrossRoutes)(path("agenda2","ap-other"))).status, 404);
      assert.equal((await client(d1, { ...DOCK, lojaId:"other1" }, storeLinkedCrossRoutes)(path())).status, 403);
      assert.equal((await client(d1, { ...DOCK, lojaCodigo:"CD DOCA 02" }, storeLinkedCrossRoutes)(path())).status, 403);
      assert.equal((await client(d1, { papel:"conferente",lojaCodigo:"F01",lojaId:"dock1" }, storeLinkedCrossRoutes)(path())).status, 403);
      assert.equal((await client(d1, { papel:"visualizador",id:"view1" }, adminLinkedCrossRoutes)(path())).status, 403);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM auditoria WHERE agendamento_id = 'ap1'").get().n, 1);
    } finally { sqlite.close(); }
  });

  it("bloqueia agenda errada, outro agendamento, data divergente, concluído e totais inválidos", async () => {
    const { sqlite, d1 } = synthetic();
    try {
      const adm = client(d1, ADMIN, adminLinkedCrossRoutes);
      assert.equal((await adm(path("agenda2","ap-other"), input())).status, 404);
      assert.equal((await adm(path("agenda1","ap-other"), input())).status, 404);
      assert.equal((await adm(path("agenda-old","ap-old"), input())).status, 422);
      assert.equal((await adm(path("agenda-done","ap-done"), input({operationalDate:"2026-10-27"}))).status, 409);
      assert.equal((await adm(path(), input({declared:{lines:1,dispatchQty:1,separateQty:100}}))).status, 422);
      assert.equal((await client(d1, DOCK, adminLinkedCrossRoutes)(path(), input())).status, 403);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM cross_relatorios").get().n, 0);
    } finally { sqlite.close(); }
  });

  it("permite mesmo PDF em protocolos distintos, sem compartilhar vínculo", async () => {
    const { sqlite, d1 } = synthetic();
    try {
      const adm = client(d1, ADMIN, adminLinkedCrossRoutes);
      assert.equal((await adm(path(), input())).status, 201);
      assert.equal((await adm(path("agenda1","ap2"), input())).status, 201);
      assert.equal(sqlite.prepare("SELECT COUNT(DISTINCT hash_conteudo) n FROM cross_relatorios").get().n, 2);
      assert.equal((await adm(path(), input())).status, 409);
      const list = await json(await adm("/agendas/agenda1"));
      assert.equal(list.suppliers.length, 2);
    } finally { sqlite.close(); }
  });

  it("só substitui explicitamente, mantém versões e recupera histórico", async () => {
    const { sqlite, d1 } = synthetic();
    try {
      const adm = client(d1, ADMIN, adminLinkedCrossRoutes);
      const first = await json(await adm(path(), input()));
      const revised = input({rows:[{...row,description:"PRODUTO SINTETICO REVISAO"}]});
      assert.equal((await adm(path(), revised)).status, 409);
      assert.equal((await adm(path(), { ...revised, replaceActiveReportId:"invalid-report" })).status, 409);
      const secondResponse = await adm(path(), { ...revised, replaceActiveReportId:first.id });
      assert.equal(secondResponse.status, 201);
      const second = await json(secondResponse);
      assert.equal(second.version, 2);
      assert.equal(second.replacedReportId, first.id);
      const active = await json(await adm(path()));
      assert.equal(active.report.id, second.id);
      const history = await json(await adm(path()+"/history"));
      assert.deepEqual(history.versions.map(v=>[v.version,v.active]),[[2,true],[1,false]]);
      const old = await json(await adm(path()+"/history/"+first.id));
      assert.equal(old.rows[0].description, "PRODUTO SINTETICO");
      assert.equal((await adm(path(), { ...revised, replaceActiveReportId: first.id })).status, 409);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM auditoria").get().n,2);
    } finally { sqlite.close(); }
  });

  it("índices/triggers D1 impedem vínculo cruzado, versões repetidas e dois ativos", () => {
    const { sqlite } = synthetic();
    try {
      const insert = sqlite.prepare(`INSERT INTO cross_relatorios
        (id,data_operacional,data_relatorio,codigo_relatorio,arquivo_original,
         hash_conteudo,lojas,linhas,quantidade_expedicao,quantidade_separar,
         criado_por,criado_em,agenda_id,agendamento_id,versao,ativo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const put = (id,hash,agenda,appointment,version,active=1) =>
        insert.run(id,DATE,DATE,"Scm405","test.pdf",hash,1,1,1,24,"admin1",DATE,agenda,appointment,version,active);
      assert.throws(()=>put("bad","bad","agenda1","ap-other",1), /CROSS_AGENDAMENTO_INVALIDO/);
      assert.throws(()=>put("bad2","bad2","agenda2","ap-other",1), /CROSS_AGENDAMENTO_INVALIDO/);
      put("first","hash1","agenda1","ap1",1);
      assert.throws(()=>put("second","hash2","agenda1","ap1",2), /UNIQUE constraint/);
      sqlite.prepare("UPDATE cross_relatorios SET ativo = 0 WHERE id = 'first'").run();
      put("second","hash2","agenda1","ap1",2);
      assert.throws(()=>put("third","hash3","agenda1","ap1",2,0), /UNIQUE constraint/);
      assert.throws(()=>sqlite.prepare("UPDATE cross_relatorios SET agendamento_id='ap2',agenda_id='agenda2' WHERE id='first'").run(), /CROSS_AGENDAMENTO_INVALIDO/);
    } finally { sqlite.close(); }
  });
});
