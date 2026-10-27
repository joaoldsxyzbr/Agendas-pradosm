import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { adminLegacyCrossArchiveRoutes } from "../../worker/routes/cross.js";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE usuarios(id TEXT PRIMARY KEY);
    CREATE TABLE lojas(id TEXT PRIMARY KEY, codigo TEXT, ativo INTEGER, excluido_em TEXT);
    CREATE TABLE agendas(id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), data_agenda TEXT);
    CREATE TABLE agendamentos(id TEXT PRIMARY KEY, agenda_id TEXT REFERENCES agendas(id), ativo INTEGER);
    INSERT INTO usuarios VALUES ('admin1');
    INSERT INTO lojas VALUES ('dock1','CD DOCA 01',1,NULL);
    INSERT INTO agendas VALUES ('agenda1','dock1','2026-10-26');
    INSERT INTO agendamentos VALUES ('ap1','agenda1',1);
  `);
  for (const p of ["../../migrations/0020_cross_docking.sql", "../../migrations/0021_cross_agendamento_vinculo.sql"]) {
    sqlite.exec(readFileSync(new URL(p, import.meta.url), "utf8"));
  }
  const insert = sqlite.prepare(`INSERT INTO cross_relatorios
    (id, data_operacional, data_relatorio, codigo_relatorio, arquivo_original, hash_conteudo,
    lojas, linhas, quantidade_expedicao, quantidade_separar, criado_por, criado_em, agenda_id, agendamento_id)
    VALUES (?, '2026-10-26', '2026-10-26', 'Scm405', ?, ?, 1, 1, 1, 24, 'admin1',
      '2026-10-26T10:00:00Z', ?, ?)`);
  insert.run("legacy1","arquivo-antigo.pdf","fingerprint-legacy",null,null);
  insert.run("linked1","arquivo-novo.pdf","fingerprint-linked","agenda1","ap1");
  sqlite.prepare(`INSERT INTO cross_itens
    (id, relatorio_id, ordem, loja_numero, loja_nome, departamento, pedido,
    produto_codigo, descricao, gtin, expedicao_codigo, embalagem, quantidade_expedicao, quantidade_separar)
    VALUES ('i1','legacy1',0,'01','LOJA UM','MERCEARIA','80776',
      '12345','PRODUTO ANTIGO','7896007811298','27896007811292',24,1,24)`).run();
  const db = {
    prepare(sql) {
      const query = sqlite.prepare(sql);
      let args = [];
      const statement = {
        bind(...values) { args=values;return statement; },
        async first() { return query.get(...args) ?? null; },
        async all() { return {results:query.all(...args)}; }
      };
      return statement;
    }
  };
  return {sqlite,db};
}

async function request(db,role,path,method="GET") {
  const app=new Hono();
  app.use("*",async (c,next)=>{c.set("authUser",{id:"user1",papel:role});await next();});
  app.route("/cross",adminLegacyCrossArchiveRoutes);
  return app.request("https://test.local/cross"+path,{method},{DB:db});
}

describe("P4: preservação somente leitura dos relatórios sem vínculo", () => {
  it("ADM consulta relatório legado e seus produtos sem vincular automaticamente",async()=>{
    const {sqlite,db}=fixture();
    try {
      const list=await request(db,"admin","/legacy");
      assert.equal(list.status,200);
      const body=await list.json();
      assert.deepEqual(body.reports.map(r=>r.id),["legacy1"]);
      assert.equal(body.reports[0].archived,true);
      const detail=await request(db,"admin","/legacy/legacy1");
      assert.equal(detail.status,200);
      const report=await detail.json();
      assert.equal(report.rows[0].description,"PRODUTO ANTIGO");
      assert.equal(report.report.archived,true);
      assert.equal((await request(db,"admin","/legacy/linked1")).status,404);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM cross_relatorios").get().n,2);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM cross_itens").get().n,1);
    } finally {sqlite.close();}
  });

  it("ADM não consegue importar PDF sem fornecedor ou alterar arquivo",async()=>{
    const {sqlite,db}=fixture();
    try {
      for(const [path,method] of [["/","POST"],["/","GET"],["/legacy","POST"],["/legacy/legacy1","DELETE"]]){
        const result=await request(db,"admin",path,method);
        assert.equal(result.status,404,`${method} ${path}`);
      }
    }finally{sqlite.close();}
  });

  it("Conferente e visualizador não podem consultar arquivos legados",async()=>{
    const {sqlite,db}=fixture();
    try {
      for (const role of ["conferente","visualizador"]) {
        assert.equal((await request(db,role,"/legacy")).status,403);
        assert.equal((await request(db,role,"/legacy/legacy1")).status,403);
      }
      assert.equal((await request(db,"admin","/legacy?date=2026-19-99")).status,400);
      assert.equal((await request(db,"admin","/legacy?offset=-1")).status,400);
      const none=await request(db,"admin","/legacy?date=2026-10-25");
      assert.deepEqual((await none.json()).reports,[]);
    }finally{sqlite.close();}
  });
});
