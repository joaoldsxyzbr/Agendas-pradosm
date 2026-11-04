import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../worker/app.ts";
import { createSessionToken } from "../../worker/lib/session.ts";

const SECRET = "somente-testes-sinteticos-de-migrations-sem-credencial-real";
const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));

/** Executa o schema real (migrações completas), não uma cópia reduzida de tabelas. */
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("PRAGMA foreign_keys = ON");
    const migrationNames = readdirSync(migrationsDir).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
    assert.ok(migrationNames.length >= 21, "As migrations devem permanecer disponíveis para o smoke de integração");
    for (const name of migrationNames) {
      sqlite.exec(readFileSync(join(migrationsDir, name), "utf8"));
    }
    const integrity = sqlite.prepare("PRAGMA integrity_check").get();
    assert.equal(integrity.integrity_check, "ok");
    const index = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_agendamentos_agenda_horario'").get();
    assert.ok(index);

    const now = "2026-10-31T12:00:00.000Z";
    const store = sqlite.prepare("INSERT INTO lojas (id,codigo,nome,criado_em,atualizado_em) VALUES (?,?,?,?,?)");
    store.run("store1", "F01", "Loja de teste 1", now, now);
    store.run("store2", "F02", "Loja de teste 2", now, now);
    const user = sqlite.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?)");
    user.run("adm", null, "Admin sintético", "adm", "sintetico", "admin", now, now);
    user.run("conf1", "store1", "Conferente 1", "conf1", "sintetico", "conferente", now, now);
    user.run("conf2", "store2", "Conferente 2", "conf2", "sintetico", "conferente", now, now);
    const agenda = sqlite.prepare(
      "INSERT INTO agendas (id,loja_id,data_agenda,arquivo_original,criado_por,status_dia,criado_em,atualizado_em) VALUES (?,?,?,?,?,'concluido',?,?)"
    );
    const appointment = sqlite.prepare(
      "INSERT INTO agendamentos (id,agenda_id,protocolo,horario_inicio,horario_fim,fornecedor,ativo,status,origem,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    );
    for (let day = 1; day <= 25; day++) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      for (const storeId of ["store1", "store2"]) {
        const id = `${storeId}-${date}`;
        agenda.run(id, storeId, date, "agenda.csv", "adm", now, now);
        appointment.run("apt-" + id, id, "P-" + day, "08:00", "09:00", "Fornecedor de teste", 1, "recebido", "importado", now, now);
      }
    }
    assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
    const db = {
      prepare(sql) {
        const stmt = sqlite.prepare(sql);
        let params = [];
        const request = {
          bind(...values) { params = values; return request; },
          async first() { return stmt.get(...params) ?? null; },
          async all() { return { results: stmt.all(...params) }; },
          async run() {
            const result = stmt.run(...params);
            return { success: true, meta: { changes: Number(result.changes) } };
          }
        };
        return request;
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          const result = [];
          for (const stmt of statements) result.push(await stmt.run());
          sqlite.exec("COMMIT");
          return result;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      }
    };
    const env = { DB: db, SESSION_SECRET: SECRET, REALTIME_MODE: "off" };
    async function get(userId, path) {
      const token = await createSessionToken(userId, 1, SECRET);
      return app.request("http://localhost" + path, {
        method: "GET", headers: { Cookie: "agenda_session=" + token }
      }, env);
    }
    return { sqlite, db, get };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

describe("Integração de consultas com todas as migrations reais e SQLite em memória", () => {
  it("isola o histórico da loja, mantém contrato legado e pagina sem duplicações", async () => {
    const f = fixture();
    try {
      const legacy = await f.get("conf1", "/api/store/history");
      assert.equal(legacy.status, 200);
      const rows = await legacy.json();
      assert.equal(rows.length, 25);
      assert.ok(rows.every(row => row.storeId === "store1"));
      const gathered = [];
      for (const offset of [0, 10, 20, 30]) {
        const res = await f.get("conf1", `/api/store/history?limit=10&offset=${offset}`);
        assert.equal(res.status, 200);
        const page = await res.json();
        assert.equal(page.hasMore, offset + 10 < 25);
        gathered.push(...page.items);
      }
      assert.deepEqual(gathered.map(row => row.id), rows.map(row => row.id));
      assert.equal(new Set(gathered.map(row => row.id)).size, 25);
      assert.ok(gathered.every(row => row.total === 1 && row.recebido === 1));
      const other = await f.get("conf2", "/api/store/history?limit=10&offset=0");
      assert.equal(other.status, 200);
      assert.ok((await other.json()).items.every(row => row.storeId === "store2"));
      assert.equal((await f.get("adm", "/api/store/history?limit=10")).status, 403);
      for (const query of ["limit=0", "limit=51", "limit=xyz", "offset=5", "limit=10&offset=-1"]) {
        const res = await f.get("conf1", "/api/store/history?" + query);
        assert.equal(res.status, 400, query);
      }
      assert.equal(f.sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
    } finally {
      f.sqlite.close();
    }
  });

  it("mantém o retorno antigo de agendas do administrador e pagina a rota real", async () => {
    const f = fixture();
    try {
      const legacy = await f.get("adm", "/api/admin/agendas");
      assert.equal(legacy.status, 200);
      const rows = await legacy.json();
      assert.equal(rows.length, 50);
      const found = [];
      for (const offset of [0, 20, 40]) {
        const res = await f.get("adm", `/api/admin/agendas?limit=20&offset=${offset}`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.hasMore, offset < 40);
        found.push(...data.items);
      }
      assert.deepEqual(found.map(row => row.id), rows.map(row => row.id));
      assert.equal((await f.get("conf1", "/api/admin/agendas?limit=20")).status, 403);
    } finally {
      f.sqlite.close();
    }
  });
});
