import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.js";
import { createSessionToken } from "../../worker/lib/session.js";
import {
  normalizeDiagnostic, recordDiagnostic, listDiagnostics, pruneDiagnostics
} from "../../worker/repositories/diagnostics.js";
import { safeDiagnosticPayload, sendDiagnostic, installBrowserDiagnostics } from "../../frontend/diagnostic-client.js";

const secret = "diagnosticos-teste-local-credencial-sintetica-2026";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT, nome TEXT, ativo INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT);
    CREATE TABLE usuarios (id TEXT PRIMARY KEY, loja_id TEXT, nome TEXT, login TEXT, senha_hash TEXT,
      papel TEXT, ativo INTEGER, session_version INTEGER, excluido_em TEXT);
    CREATE TABLE auditoria (id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT,
      entidade_id TEXT, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT,
      antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT);`);
  sql.exec(readFileSync(new URL("../../migrations/0018_diagnosticos.sql", import.meta.url), "utf8"));
  sql.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES ('store1','F01','Loja sintética',1)").run();
  const ins = sql.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,ativo,session_version) VALUES (?,?,?,?,?,?,1,1)");
  ins.run("admin1",null,"Admin sintético","admin","hash-sintetico","admin");
  ins.run("viewer1",null,"Viewer sintético","viewer","hash-sintetico","visualizador");
  ins.run("clerk1","store1","Conferente sintético","clerk","hash-sintetico","conferente");
  const db = { prepare(statement) {
    const stmt = sql.prepare(statement);
    let vals = [];
    const bound = {
      bind(...values) { vals = values; return bound; },
      async first() { return stmt.get(...vals) ?? null; },
      async all() { return { results: stmt.all(...vals) }; },
      async run() { const result = stmt.run(...vals); return { success:true,meta:{changes:Number(result.changes)} }; }
    };
    return bound;
  } };
  const env = { DB:db, SESSION_SECRET:secret };
  async function call(user, path, method="GET", body=null, origin="http://localhost") {
    const token = user && await createSessionToken(user,1,secret);
    const headers = { Origin:origin };
    if(token) headers.Cookie = "agenda_session=" + token;
    if(body!==null) headers["Content-Type"] = "application/json";
    return app.request("http://localhost" + path, {
      method,headers,body:body===null?undefined:JSON.stringify(body)
    }, env);
  }
  return { sql,db,call };
}

describe("Diagnósticos seguros", () => {
  it("não persiste dados arbitrários, URL nem stack enviados pelo navegador", async () => {
    const payload = safeDiagnosticPayload("IMPORT_READ_FAILED",{
      nivel:"error",operacao:"importacao",formato:"csv",
      message:"senha secreta",url:"https://site?t=token",
      stack:"segredo",filename:"cliente.csv"
    });
    assert.deepEqual(Object.keys(payload).sort(),["correlacao","evento","formato","nivel","operacao"]);
    assert.equal(normalizeDiagnostic({...payload,origem:"browser"}).evento,"IMPORT_READ_FAILED");
    assert.equal(safeDiagnosticPayload("EVENTO_FALSO",{message:"senha"}),null);
    assert.throws(()=>normalizeDiagnostic({
      origem:"browser",nivel:"error",evento:"EXEMPLO_INVENTADO",operacao:"api"
    }),TypeError);
  });
  it("falha em telemetria não interfere no aplicativo", async () => {
    assert.equal(await sendDiagnostic("IMPORT_READ_FAILED",{operacao:"importacao"},
      async()=>{throw Error("sem rede");}),false);
    const received=[];
    const win=new EventTarget();
    const off=installBrowserDiagnostics(win,()=>({id:"admin1"}),async (event,options)=>{
      received.push({event,options});
      return true;
    });
    win.dispatchEvent(new Event("error"));
    win.dispatchEvent(new Event("unhandledrejection"));
    assert.deepEqual(received.map(x=>x.event),["BROWSER_EXCEPTION","BROWSER_REJECTION"]);
    off();
    win.dispatchEvent(new Event("error"));
    assert.equal(received.length,2);
  });
  it("autentica gravação, bloqueia origem cruzada, limita payload e leitura a admin", async () => {
    const f=fixture();
    try {
      const body={evento:"IMPORT_READ_FAILED",nivel:"error",operacao:"importacao",formato:"csv"};
      assert.equal((await f.call(null,"/api/diagnostics/events","POST",body)).status,401);
      assert.equal((await f.call("admin1","/api/diagnostics/events","POST",body,"https://outro.example")).status,403);
      assert.equal((await f.call("admin1","/api/diagnostics/events","POST",{...body,senha:"segredo"})).status,400);
      assert.equal((await f.call("admin1","/api/diagnostics/events","POST",{...body,evento:"INVENTADO"})).status,400);
      assert.equal((await f.call("admin1","/api/diagnostics/events","POST",body)).status,204);
      assert.equal((await f.call("clerk1","/api/diagnostics/events","POST",body)).status,204);
      const storeLog=await f.call("admin1","/api/admin/diagnostics?storeId=store1&userId=clerk1");
      assert.equal(storeLog.status,200);
      const storeRows=await storeLog.json();
      assert.equal(storeRows.length,1);
      assert.equal(storeRows[0].storeId,"store1");
      assert.equal((await f.call("admin1","/api/admin/audit?storeId=store1&userId=admin1")).status,200);
      assert.equal((await f.call("viewer1","/api/admin/diagnostics")).status,403);
      assert.equal((await f.call("clerk1","/api/admin/diagnostics")).status,403);
      assert.equal((await f.call(null,"/api/admin/diagnostics")).status,401);
      const answer=await f.call("admin1","/api/admin/diagnostics?nivel=error&operacao=importacao");
      assert.equal(answer.status,200);
      const rows=await answer.json();
      assert.equal(rows.length,2);
      assert.equal(rows[0].event,"IMPORT_READ_FAILED");
      assert.ok(rows.some(row=>row.user.id==="admin1"));
      assert.ok(rows.some(row=>row.user.id==="clerk1"));
      assert.equal("senha" in rows[0],false);
      assert.equal((await f.call("admin1","/api/admin/diagnostics?nivel=INVALIDO")).status,400);
    } finally { f.sql.close(); }
  });
  it("limita eventos por usuário e aplica retenção de 30 dias somente em diagnósticos", async () => {
    const f=fixture();
    try {
      const event={origem:"worker",nivel:"error",evento:"WORKER_EXCEPTION",operacao:"api",userId:"admin1"};
      const old=await recordDiagnostic(f.db,event);
      f.sql.prepare("UPDATE diagnosticos SET criado_em=? WHERE id=?")
        .run("2026-01-01T00:00:00.000Z",old.id);
      await recordDiagnostic(f.db,event);
      const oldAudit="2026-01-01T00:00:00.000Z";
      f.sql.prepare("INSERT INTO auditoria (id,usuario_id,acao,entidade,entidade_id,criado_em) VALUES ('log1','admin1','teste','usuario','admin1',?)").run(oldAudit);
      await pruneDiagnostics(f.db,new Date("2026-10-22T00:00:00.000Z"));
      assert.equal((await listDiagnostics(f.db)).length,1);
      assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM auditoria").get().n,1);
      for(let i=0;i<29;i++) await recordDiagnostic(f.db,event);
      assert.equal((await f.call("admin1","/api/diagnostics/events","POST",{
        evento:"IMPORT_SELECTED",nivel:"info",operacao:"importacao"
      })).status,429);
    } finally { f.sql.close(); }
  });
});