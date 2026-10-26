import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.js";
import { quickLoginEnabled, matchesQuickCode } from "../../worker/routes/preview-quick-login.js";

const previewOrigin = "https://testes.agendaspradosm.joaolds.xyz.br";
const testCode = "PREVIEW-TEST-CODE-ONLY-123456789";
const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
const testHash = async () => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testCode)));

function d1Synthetic() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE lojas (
      id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
      ativo INTEGER NOT NULL, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT
    );
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL, papel TEXT NOT NULL,
      ativo INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      excluido_em TEXT, criado_em TEXT, atualizado_em TEXT
    );
    CREATE TABLE auditoria (
      id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT NOT NULL, entidade TEXT NOT NULL,
      entidade_id TEXT NOT NULL, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT,
      antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT
    );
  `);
  return {
    sqlite,
    d1: {
      prepare(query) {
        const statement = sqlite.prepare(query);
        let args = [];
        const stmt = {
          bind(...values) { args = values; return stmt; },
          async first() { return statement.get(...args) ?? null; },
          async run() { const result = statement.run(...args); return { meta: { changes: Number(result.changes) } }; },
          async all() { return { results: statement.all(...args) }; }
        };
        return stmt;
      }
    }
  };
}

describe("Login rápido exclusivamente em Preview", () => {
  it("não expõe o mecanismo em produção ou em outra preview", async () => {
    const hash = await testHash();
    const env = { PREVIEW_QUICK_LOGIN_ENABLED:"on", PREVIEW_QUICK_LOGIN_HASH:hash, SESSION_SECRET:"preview-secret-sintetico-0123456789" };
    assert.equal(quickLoginEnabled(env, previewOrigin + "/login"), true);
    assert.equal(quickLoginEnabled(env, "https://agendaspradosm.joaolds.xyz.br/login"), false);
    assert.equal(quickLoginEnabled(env, "https://branch-qualquer.agendaspradosm.joaolds.xyz.br/login"), false);
    assert.equal(quickLoginEnabled({ ...env, PREVIEW_QUICK_LOGIN_ENABLED:undefined }, previewOrigin), false);
    assert.equal(quickLoginEnabled({ ...env, PREVIEW_QUICK_LOGIN_HASH:"invalid" }, previewOrigin), false);
  });

  it("confere o código sem aceitar credenciais curtas ou incorretas", async () => {
    const hash = await testHash();
    assert.equal(await matchesQuickCode(testCode, hash), true);
    assert.equal(await matchesQuickCode("senha-invalida", hash), false);
    assert.equal(await matchesQuickCode("PREVIEW-TEST-CODE-ONLY-000000000", hash), false);
  });

  it("cria apenas contas sintéticas e valida sessões dos três perfis", async () => {
    const { sqlite, d1 } = d1Synthetic();
    const env = {
      DB: d1, PREVIEW_QUICK_LOGIN_ENABLED:"on", PREVIEW_QUICK_LOGIN_HASH:await testHash(),
      SESSION_SECRET:"preview-secret-sintetico-0123456789",
      LOGIN_RATE_LIMITER:{ limit:async()=>({success:true}) },
      REALTIME_MODE:"off"
    };
    try {
      const request = (path, init={}) => app.request(previewOrigin+path, init, env);
      assert.equal((await request("/api/auth/quick-login/status")).status, 200);
      assert.deepEqual(await (await request("/api/auth/quick-login/status")).json(),{enabled:true});
      const submit = (role, code) => request("/api/auth/quick-login",{
        method:"POST",
        headers:{origin:previewOrigin,"content-type":"application/json"},
        body:JSON.stringify({role,code})
      });
      assert.equal((await submit("admin","INVALID-CODE-INVALID-CODE")).status,401);
      assert.equal(sqlite.prepare("SELECT COUNT(*) as n FROM usuarios").get().n,0);
      for (const [role,expected] of [
        ["admin","admin"],["doca1","conferente"],["visualizador","visualizador"]
      ]) {
        const result = await submit(role,testCode);
        assert.equal(result.status,200,role);
        const user = await result.json();
        assert.equal(user.papel,expected);
        if(role==="doca1") assert.equal(user.lojaCodigo,"CD DOCA 01");
        const cookie = result.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie?.startsWith("agenda_session="));
        const me = await request("/api/auth/me",{headers:{cookie}});
        assert.equal(me.status,200);
        assert.equal((await me.json()).papel,expected);
      }
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM usuarios").get().n,3);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lojas").get().n,1);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM auditoria").get().n,3);
      const repeated=await submit("doca1",testCode);
      assert.equal(repeated.status,200);
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM usuarios").get().n,3);
    } finally { sqlite.close(); }
  });

  it("recusa chamadas sem segredo, mesmo no endereço de testes", async () => {
    const env = { PREVIEW_QUICK_LOGIN_ENABLED:"on",
      PREVIEW_QUICK_LOGIN_HASH:await testHash(), SESSION_SECRET:"preview-secret-sintetico-0123456789" };
    const response = await app.request(previewOrigin+"/api/auth/quick-login",{method:"POST",
      headers:{origin:"https://dominio-malicioso.example","content-type":"application/json"},
      body:JSON.stringify({role:"admin",code:testCode})
    },env);
    assert.equal(response.status,403);
    const disabled = await app.request(previewOrigin+"/api/auth/quick-login",{method:"POST",
      headers:{origin:previewOrigin,"content-type":"application/json"},
      body:JSON.stringify({role:"admin",code:testCode})
    },{...env,PREVIEW_QUICK_LOGIN_ENABLED:"off"});
    assert.equal(disabled.status,404);
  });
});
