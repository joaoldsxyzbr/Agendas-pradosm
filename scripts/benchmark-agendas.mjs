// Benchmark sintético e opcional: sem token, HTTP ou conexão com Cloudflare/D1 real.
// Node 22+ inclui node:sqlite (experimental em algumas versões).
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { listAdminAgendas, listStoreAgendas } from "../worker/repositories/agendas.js";

const quick = process.argv.includes("--quick");
const sizes = quick ? [40] : [162, 1_000, 5_000];
const stores = 10;
const appointmentsPerAgenda = 15;
const repetitions = quick ? 2 : 5;
const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT NOT NULL, nome TEXT NOT NULL);
  CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
  CREATE TABLE agendas (
    id TEXT PRIMARY KEY, loja_id TEXT NOT NULL, data_agenda TEXT NOT NULL,
    arquivo_original TEXT NOT NULL, criado_por TEXT NOT NULL,
    status_dia TEXT NOT NULL, concluido_em TEXT, concluido_por TEXT,
    criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
    UNIQUE (loja_id, data_agenda)
  );
  CREATE TABLE agendamentos (
    id TEXT PRIMARY KEY, agenda_id TEXT NOT NULL,
    ativo INTEGER NOT NULL, status TEXT NOT NULL, origem TEXT NOT NULL,
    horario_inicio TEXT NOT NULL
  );
  CREATE INDEX idx_agendas_loja_data ON agendas(loja_id, data_agenda);
  CREATE INDEX idx_agendamentos_agenda_horario ON agendamentos(agenda_id, horario_inicio);
`);
for (let index = 0; index < stores; index++)
  db.prepare("INSERT INTO lojas (id,codigo,nome) VALUES (?,?,?)")
    .run(`l${index}`, String(index + 1).padStart(2, "0"), `Loja ${index + 1}`);
db.prepare("INSERT INTO usuarios (id,nome) VALUES (?,?)").run("u1", "Admin sintético");

const insertAgenda = db.prepare(`INSERT INTO agendas
  (id,loja_id,data_agenda,arquivo_original,criado_por,status_dia,criado_em,atualizado_em)
  VALUES (?,?,?,?,?,?,?,?)`);
const insertAppointment = db.prepare(`INSERT INTO agendamentos
  (id,agenda_id,ativo,status,origem,horario_inicio) VALUES (?,?,?,?,?,?)`);
const fixedNow = "2026-10-19T12:00:00.000Z";
function dateAt(index) {
  return new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
}
function addFixture(from, to) {
  db.exec("BEGIN TRANSACTION");
  try {
    for (let i = from; i < to; i++) {
      const store = i % stores;
      const agenda = `a${i}`;
      const date = dateAt(Math.floor(i / stores));
      insertAgenda.run(agenda, `l${store}`, date, "agenda.csv", "u1", "aberto", fixedNow, fixedNow);
      for (let j = 0; j < appointmentsPerAgenda; j++) {
        const status = ["aguardando", "recebido", "nao_chegou", "recusado"][j % 4];
        insertAppointment.run(`p${i}-${j}`, agenda, 1, status,
          j % 7 === 0 ? "manual" : "importado", String(j).padStart(2, "0") + ":00");
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Adaptador restrito ao contrato .prepare().bind().all() do D1.
// Roda as próprias consultas do repositório, não cópias de SQL.
let lastQuery = null;
const adapter = {
  prepare(sql) {
    const statement = db.prepare(sql);
    let values = [];
    lastQuery = { sql, values };
    return {
      bind(...params) {
        values = params;
        lastQuery.values = params;
        return this;
      },
      async all() {
        return { results: statement.all(...values) };
      }
    };
  }
};
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function measure(label, fn, expected) {
  await fn(); // aquecimento sem contabilizar
  const ms = [];
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now();
    const rows = await fn();
    ms.push(performance.now() - start);
    assert.equal(rows.length, expected, `Quantidade inesperada em ${label}`);
  }
  const plan = db.prepare("EXPLAIN QUERY PLAN " + lastQuery.sql).all(...lastQuery.values);
  return {
    scenario: label,
    count: expected,
    median_ms: Number(median(ms).toFixed(2)),
    uses_temporary_sort: plan.some(row => /USE TEMP B-TREE/.test(row.detail)),
    plan: plan.map(row => row.detail)
  };
}

let previous = 0;
for (const total of sizes) {
  addFixture(previous, total);
  previous = total;
  const latestDate = dateAt(Math.floor((total - 1) / stores));
  const expectedDateRows = total - (Math.floor((total - 1) / stores) * stores);
  const cases = [
    await measure("ADM sem filtros", () => listAdminAgendas(adapter), total),
    await measure("ADM filtrado por data", () => listAdminAgendas(adapter, { date: latestDate }), expectedDateRows),
    await measure("Conferente/loja", () => listStoreAgendas(adapter, "l0"), Math.ceil(total / stores))
  ];
  console.log(JSON.stringify({
    agendas: total,
    appointments: total * appointmentsPerAgenda,
    stores,
    engine: "node:sqlite (local; NÃO Cloudflare D1)",
    cases
  }, null, 2));
}
db.close();
