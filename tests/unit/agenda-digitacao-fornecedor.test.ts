import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listAgendaSuppliers, listDigitacaoProgressByDate, changeSupplierCheck, supplierKey } from "../../worker/services/agenda-digitacao.ts";

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec([
    "CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT)",
    "CREATE TABLE agendas (id TEXT PRIMARY KEY, loja_id TEXT, data_agenda TEXT)",
    "CREATE TABLE agendamentos (id TEXT PRIMARY KEY, agenda_id TEXT, protocolo TEXT, horario_inicio TEXT, horario_fim TEXT, fornecedor TEXT, itens INTEGER, volumes INTEGER, paletes INTEGER, carga_batida TEXT, tipo TEXT, nfe TEXT, pedidos TEXT, status TEXT, trocas INTEGER, observacao TEXT, origem TEXT, ativo INTEGER, criado_em TEXT, atualizado_em TEXT, csv_campos TEXT)",
    "CREATE INDEX idx_agendamentos_agenda_horario ON agendamentos(agenda_id, horario_inicio)",
    "CREATE TABLE agenda_digitacao_fornecedor (agenda_id TEXT NOT NULL, fornecedor_chave TEXT NOT NULL, fornecedor_nome TEXT NOT NULL, dados_hash TEXT NOT NULL, digitado_em TEXT, digitado_por TEXT, PRIMARY KEY(agenda_id, fornecedor_chave))",
    "CREATE TABLE auditoria (id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT)"
  ].join(";") + ";");
  sqlite.prepare("INSERT INTO usuarios (id, nome) VALUES (?, ?)").run("adm", "Administradora");
  sqlite.prepare("INSERT INTO agendas (id, loja_id, data_agenda) VALUES (?, ?, ?)").run("agenda1", "loja1", "2026-11-03");
  const insert = sqlite.prepare(
    "INSERT INTO agendamentos (id, agenda_id, protocolo, horario_inicio, horario_fim, fornecedor, itens, volumes, paletes, carga_batida, tipo, nfe, pedidos, status, origem, ativo, csv_campos) VALUES (?, 'agenda1', ?, '08:00', '09:00', ?, 2, 3, 1, '-', 'Nota fiscal', '[\"123\"]', '[\"456\"]', 'aguardando', 'importado', 1, ?)"
  );
  insert.run("item1", "111111", "Fornecedor Á", JSON.stringify({ Doca: "01", Pedidos: "456" }));
  insert.run("item2", "222222", "FORNECEDOR A", JSON.stringify({ Doca: "01", Pedidos: "456" }));

  const d1 = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      let values = [];
      const d1Stmt = {
        bind(...args) { values = args; return d1Stmt; },
        async first() { return stmt.get(...values) ?? null; },
        async all() { return { results: stmt.all(...values) }; },
        async run() {
          const result = stmt.run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return d1Stmt;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const stmt of statements) results.push(await stmt.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
  return { sqlite, d1, agenda: { id: "agenda1", loja_id: "loja1" } };
}

describe("Digitação administrativa por fornecedor — preview", () => {
  it("usa o índice do agendamento para filtrar a data, sem alterar o total", async () => {
    const { sqlite, d1 } = setup();
    let dailyQuery = "";
    const originalPrepare = d1.prepare;
    d1.prepare = (sql) => {
      if (sql.includes("SELECT ag.id, ag.agenda_id") && sql.includes("ag.csv_campos")) {
        dailyQuery = sql;
      }
      return originalPrepare(sql);
    };
    try {
      const progress = await listDigitacaoProgressByDate(d1, "2026-11-03");
      assert.deepEqual(progress.get("agenda1"), { digitadas: 0, fornecedores: 1 });
      assert.match(dailyQuery, /FROM agendas a CROSS JOIN agendamentos ag/);
      const plan = sqlite.prepare("EXPLAIN QUERY PLAN " + dailyQuery).all("2026-11-03");
      assert.ok(
        plan.some(row => String(row.detail).includes("SEARCH ag USING INDEX idx_agendamentos_agenda_horario")),
        JSON.stringify(plan)
      );
      assert.ok(!plan.some(row => String(row.detail).includes("SCAN ag")), JSON.stringify(plan));
      const originalJoin = dailyQuery.replace(
        "FROM agendas a CROSS JOIN agendamentos ag ON ag.agenda_id = a.id",
        "FROM agendamentos ag JOIN agendas a ON a.id = ag.agenda_id"
      );
      assert.deepEqual(
        sqlite.prepare(dailyQuery).all("2026-11-03"),
        sqlite.prepare(originalJoin).all("2026-11-03")
      );
    } finally {
      sqlite.close();
    }
  });

  it("resumo diário respeita checks válidos, agrupa fornecedores e invalida CSV alterado", async () => {
    const { sqlite, d1, agenda } = setup();
    try {
      const before = await listDigitacaoProgressByDate(d1, "2026-11-03");
      assert.deepEqual(before.get(agenda.id), { digitadas: 0, fornecedores: 1 });
      assert.equal((await listDigitacaoProgressByDate(d1, "2026-11-04")).size, 0);
      const supplier = (await listAgendaSuppliers(d1, agenda.id))[0];
      await changeSupplierCheck(d1, agenda, "adm", {
        supplier: supplier.supplier, hash: supplier.hash,
        digitado: true, expectedDigitadoEm: null
      });
      const marked = await listDigitacaoProgressByDate(d1, "2026-11-03");
      assert.deepEqual(marked.get(agenda.id), { digitadas: 1, fornecedores: 1 });
      sqlite.prepare("UPDATE agendamentos SET pedidos = ? WHERE id = ?").run('["NOVO"]', "item1");
      const changed = await listDigitacaoProgressByDate(d1, "2026-11-03");
      assert.deepEqual(changed.get(agenda.id), { digitadas: 0, fornecedores: 1 });
    } finally {
      sqlite.close();
    }
  });

  it("agrupa protocolos com nome equivalente e persiste check sem alterar recebimento", async () => {
    const { sqlite, d1, agenda } = setup();
    assert.equal(supplierKey("  FORNECEDOR Á "), "fornecedor a");
    const first = await listAgendaSuppliers(d1, agenda.id);
    assert.equal(first.length, 1);
    assert.equal(first[0].appointments.length, 2);
    assert.equal(first[0].appointments[0].csvFields.Doca, "01");
    assert.equal(first[0].digitadoEm, null);
    const changed = await changeSupplierCheck(d1, agenda, "adm", {
      supplier: first[0].supplier, hash: first[0].hash, digitado: true, expectedDigitadoEm: null
    });
    assert.ok(changed?.digitadoEm);
    const after = await listAgendaSuppliers(d1, agenda.id);
    assert.equal(after[0].digitadoPor.name, "Administradora");
    assert.ok(after[0].digitadoEm);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM auditoria").get().n, 1);
    assert.deepEqual(sqlite.prepare("SELECT status FROM agendamentos ORDER BY id").all().map(row => row.status), ["aguardando", "aguardando"]);
    await changeSupplierCheck(d1, agenda, "adm", {
      supplier: after[0].supplier, hash: after[0].hash, digitado: false,
      expectedDigitadoEm: after[0].digitadoEm
    });
    assert.equal((await listAgendaSuppliers(d1, agenda.id))[0].digitadoEm, null);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM auditoria").get().n, 2);
    sqlite.close();
  });

  it("invalida check quando muda pedido do CSV e rejeita hash desatualizado", async () => {
    const { sqlite, d1, agenda } = setup();
    const first = (await listAgendaSuppliers(d1, agenda.id))[0];
    await changeSupplierCheck(d1, agenda, "adm", {
      supplier: first.supplier, hash: first.hash, digitado: true, expectedDigitadoEm: null
    });
    sqlite.prepare("UPDATE agendamentos SET pedidos = ? WHERE id = ?").run('["NOVO"]', "item1");
    const changed = (await listAgendaSuppliers(d1, agenda.id))[0];
    assert.notEqual(changed.hash, first.hash);
    assert.equal(changed.digitadoEm, null);
    await assert.rejects(() => changeSupplierCheck(d1, agenda, "adm", {
      supplier: first.supplier, hash: first.hash, digitado: true, expectedDigitadoEm: null
    }), error => error?.code === "CONFLITO_ESTADO");
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM auditoria").get().n, 1);
    sqlite.close();
  });
});
