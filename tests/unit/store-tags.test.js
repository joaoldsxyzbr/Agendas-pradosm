import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { storeTagsRoutes } from "../../worker/routes/store-tags.js";

function syntheticDb() {
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE lojas(id TEXT PRIMARY KEY,codigo TEXT NOT NULL,nome TEXT NOT NULL);
    CREATE TABLE usuarios(id TEXT PRIMARY KEY,nome TEXT NOT NULL);
    CREATE TABLE agendas(id TEXT PRIMARY KEY,loja_id TEXT NOT NULL REFERENCES lojas(id),
       data_agenda TEXT,arquivo_original TEXT,criado_por TEXT,status_dia TEXT,
       concluido_em TEXT,concluido_por TEXT,criado_em TEXT,atualizado_em TEXT);
    CREATE TABLE agendamentos(id TEXT PRIMARY KEY,agenda_id TEXT NOT NULL REFERENCES agendas(id),
       protocolo TEXT,horario_inicio TEXT,horario_fim TEXT,fornecedor TEXT,
       itens INTEGER,volumes INTEGER,paletes INTEGER,carga_batida TEXT,tipo TEXT,nfe TEXT,pedidos TEXT,
       status TEXT,trocas INTEGER,observacao TEXT,origem TEXT,ativo INTEGER,criado_em TEXT,atualizado_em TEXT);
    CREATE TABLE auditoria(id TEXT PRIMARY KEY,usuario_id TEXT,acao TEXT,entidade TEXT,entidade_id TEXT,
       loja_id TEXT,agenda_id TEXT,agendamento_id TEXT,antes TEXT,depois TEXT,detalhes TEXT,criado_em TEXT);
  `);
  sqlite.exec(readFileSync(new URL("../../migrations/0030_supplier_tags.sql",import.meta.url),"utf8"));
  sqlite.exec(`
    INSERT INTO lojas VALUES ('l1','F01','Loja A'),('l2','F02','Loja B');
    INSERT INTO usuarios VALUES ('u1','Conferente');
    INSERT INTO agendas VALUES ('agenda1','l1','2026-10-30','teste','u1','aberto',NULL,NULL,'now','now'),
                              ('agenda2','l2','2026-10-30','teste','u1','aberto',NULL,NULL,'now','now');
    INSERT INTO agendamentos(id,agenda_id,fornecedor,ativo) VALUES
      ('a1','agenda1','Fornecedor sintético',1),('a2','agenda2','Outro fornecedor sintético',1);
  `);
  const db={
    prepare(sql) {
      const stmt=sqlite.prepare(sql);
      let args=[];
      const bound={
        bind(...values){args=values;return bound;},
        async first(){return stmt.get(...args)??null;},
        async all(){return {results:stmt.all(...args)};},
        async run(){const r=stmt.run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
      };
      return bound;
    },
    async batch(statements){
      const result=[];
      sqlite.exec("BEGIN");
      try{for(const stmt of statements)result.push(await stmt.run());sqlite.exec("COMMIT");return result;}
      catch(e){sqlite.exec("ROLLBACK");throw e;}
    }
  };
  return {sqlite,db};
}
function appWithUser(db) {
  const app=new Hono();
  app.use("/*",async(c,next)=>{
    c.set("authUser",{id:"u1",papel:c.req.header("x-role")||"conferente",
      lojaId:c.req.header("x-store")||"l1"});
    await next();
  });
  app.route("/api/store/tags",storeTagsRoutes);
  const call=(path,method="GET",body=null,headers={})=>app.request("http://localhost/api/store/tags"+(path==="/"? "":path),{
    method,headers:{"content-type":"application/json",...headers},
    ...(body===null?{}:{body:JSON.stringify(body)})
  },{DB:db,REALTIME_MODE:"off"});
  return {call};
}
describe("Tags do conferente com SQLite sintético",()=>{
  it("cria, lista, atribui, arquiva e preserva marcações históricas",async()=>{
    const {sqlite,db}=syntheticDb();
    try{
      const {call}=appWithUser(db);
      assert.equal((await call("/","POST",{name:"Urgente",color:"vermelho"},{'x-role':"admin"})).status,403);
      assert.equal((await call("/","POST",{name:"Urgente",color:"vermelho"})).status,201);
      const tags=await (await call("/")).json();
      assert.equal(tags.length,1);
      assert.equal(tags[0].name,"Urgente");
      assert.equal((await call("/","POST",{name:"urgente",color:"azul"})).status,409);
      assert.equal((await call("/","POST",{name:"Outro",color:"invalid"})).status,400);
      const id=tags[0].id;
      assert.equal((await call("/appointments/a1","PUT",{tagIds:[id]},{'x-store':"l2"})).status,404);
      assert.equal((await call("/appointments/a1","PUT",{tagIds:["00000000-0000-4000-8000-000000000000"]})).status,400);
      assert.equal((await call("/appointments/a1","PUT",{tagIds:[id]})).status,200);
      const assignments=await (await call("/agenda/2026-10-30")).json();
      assert.deepEqual(assignments.assignments.a1,[tags[0]]);
      assert.deepEqual((await (await call("/agenda/2026-10-30", "GET",null,{'x-store':"l2"})).json()).assignments,{});
      assert.equal((await call("/"+id,"DELETE",null,{'x-store':"l2"})).status,404);
      assert.equal((await call("/"+id,"DELETE")).status,204);
      assert.deepEqual(await (await call("/")).json(),[]);
      const history=await (await call("/agenda/2026-10-30")).json();
      assert.deepEqual(history.assignments.a1,[tags[0]]);
      sqlite.exec("UPDATE agendas SET status_dia='concluido' WHERE id='agenda1'");
      assert.equal((await call("/appointments/a1","PUT",{tagIds:[]})).status,409);
      const audit=sqlite.prepare("SELECT COUNT(*) AS total FROM auditoria").get();
      assert.equal(audit.total,3);
    }finally{sqlite.close();}
  });
});
