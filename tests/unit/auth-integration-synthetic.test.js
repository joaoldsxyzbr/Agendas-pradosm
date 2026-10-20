import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.js";
import { hashPassword, PASSWORD_HASH_ITERATIONS } from "../../worker/lib/password.js";

// Contrato Hono + WebCrypto + SQLite local. NÃO conecta D1/Cloudflare remoto,
// não cria usuário de produção e não injeta credenciais em logs.
function syntheticDB() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY, loja_id TEXT, nome TEXT NOT NULL, login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL, papel TEXT NOT NULL, ativo INTEGER NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 1, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT
    );
    CREATE TABLE lojas (
      id TEXT PRIMARY KEY, codigo TEXT NOT NULL, nome TEXT NOT NULL,
      ativo INTEGER NOT NULL, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT
    );
    CREATE TABLE agendas (
      id TEXT PRIMARY KEY, loja_id TEXT NOT NULL, data_agenda TEXT NOT NULL,
      status_dia TEXT NOT NULL, concluido_em TEXT, concluido_por TEXT,
      atualizado_em TEXT, arquivo_original TEXT, criado_por TEXT, criado_em TEXT
    );
    CREATE TABLE agendamentos (
      id TEXT PRIMARY KEY, agenda_id TEXT, ativo INTEGER, status TEXT,
      origem TEXT, fornecedor TEXT, protocolo TEXT, observacao TEXT
    );
    CREATE TABLE historico_agenda (
      id TEXT PRIMARY KEY, agenda_id TEXT, acao TEXT, detalhes TEXT, alterado_em TEXT,
      usuario_id TEXT
    );
    CREATE TABLE auditoria (
      id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT,
      loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT,
      depois TEXT, detalhes TEXT, criado_em TEXT
    );
  `);
  return {
    sqlite,
    d1: {
      prepare(sql) {
        const stmt = sqlite.prepare(sql);
        let args = [];
        const bound = {
          bind(...values) { args = values; return bound; },
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() {
            const result = stmt.run(...args);
            return { success: true, meta: { changes: Number(result.changes) } };
          }
        };
        return bound;
      }
    }
  };
}

describe("API real com autenticação e dados sintéticos (sem mocks de rota)", () => {
  it("respeita 100 mil iterações, sessões e permissões de 3 perfis", async () => {
    assert.equal(PASSWORD_HASH_ITERATIONS, 100_000);
    const { sqlite, d1 } = syntheticDB();
    try {
      const hash = await hashPassword("SenhaSintetica2026!");
      assert.match(hash, /^pbkdf2_sha256\$100000\$/);
      sqlite.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES ('loja1','F01','Loja Sintética',1)").run();
      const add = sqlite.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,ativo,session_version) VALUES (?,?,?,?,?,?,?,1)");
      add.run("admin1", null, "Adm sintético", "adm-sintetico", hash, "admin", 1);
      add.run("viewer1", null, "Viewer sintético", "viewer-sintetico", hash, "visualizador", 1);
      add.run("store1", "loja1", "Conferente sintético", "store-sintetico", hash, "conferente", 1);
      const env = {
        DB: d1,
        SESSION_SECRET: "teste-isolado-nunca-em-producao-0123456789",
        LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
        REALTIME_MODE: "off"
      };
      const call = (path, options = {}) => app.request(
        "http://localhost" + path, options, env
      );
      const login = async (username, password = "SenhaSintetica2026!") => {
        const response = await call("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost" },
          body: JSON.stringify({ login: username, senha: password })
        });
        return response;
      };
      assert.equal((await call("/api/auth/me")).status, 401);
      assert.equal((await login("adm-sintetico", "senha-errada")).status, 401);
      for (const [username, role] of [
        ["adm-sintetico", "admin"],
        ["viewer-sintetico", "visualizador"],
        ["store-sintetico", "conferente"]
      ]) {
        const response = await login(username);
        assert.equal(response.status, 200, "Login válido: " + role);
        assert.equal((await response.json()).papel, role);
        const cookie = response.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie?.startsWith("agenda_session="));
        const get = path => call(path, { headers: { cookie } });
        const me = await get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal((await me.json()).papel, role);
        const denied = await get("/api/admin/users");
        assert.equal(denied.status, role === "admin" ? 200 : 403,
          "Acesso aos usuários deve exigir administrador");
        if (role === "visualizador") {
          assert.equal((await get("/api/admin/reports?start=2026-10-01&end=2026-10-19")).status, 200);
          assert.equal((await get("/api/admin/stores")).status, 200);
        }
        if (role === "conferente") {
          assert.equal((await get("/api/admin/reports?start=2026-10-01&end=2026-10-19")).status, 403);
        }
        sqlite.prepare("UPDATE usuarios SET session_version = session_version + 1 WHERE login = ?").run(username);
        assert.equal((await get("/api/auth/me")).status, 401,
          "Revogação por versionamento deve invalidar sessão anterior");
      }
    } finally {
      sqlite.close();
    }
  });
});
