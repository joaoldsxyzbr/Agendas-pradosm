import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Somente SQLite em memória: nunca consulta ou escreve no D1 de produção.
describe("Release candidata: migrations sobre schema de produção", () => {
  it("aplica a sequência 0001–0023 sem remover campos operacionais", () => {
    const files = readdirSync("migrations")
      .filter(name => /^\d{4}_[\w-]+\.sql$/.test(name))
      .sort();
    assert.deepEqual(files.map(name => name.slice(0, 4)),
      Array.from({ length: 23 }, (_, i) => String(i + 1).padStart(4, "0")),
      "A candidata deve conter exatamente migrations 0001–0023");

    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys=ON");
      for (const file of files) {
        const sql = readFileSync(join("migrations", file), "utf8");
        assert.doesNotThrow(() => db.exec(sql), "Migration inválida: " + file);
      }
      const names = table => db.prepare("PRAGMA table_info(" + table + ")").all().map(r => r.name);
      const agenda = names("agendas");
      const appointments = names("agendamentos");
      const checks = names("agenda_digitacao_fornecedor");
      assert.ok(agenda.includes("status_dia"), "Status operacional da agenda ausente");
      assert.ok(appointments.includes("status"), "Status do agendamento ausente");
      assert.ok(appointments.includes("pedidos") && appointments.includes("nfe"));
      assert.ok(agenda.includes("digitado_em") && agenda.includes("digitado_por"));
      assert.ok(appointments.includes("csv_campos"));
      for (const field of ["agenda_id", "fornecedor_chave", "fornecedor_nome", "dados_hash", "digitado_em", "digitado_por"])
        assert.ok(checks.includes(field), "Coluna de digitação ausente: " + field);
      const fks = db.prepare("PRAGMA foreign_key_list(agenda_digitacao_fornecedor)").all().map(row => row.table);
      assert.ok(fks.includes("agendas") && fks.includes("usuarios"));
      // Migration 0022: avisos in-app com leitura por usuário.
      const avisos = names("avisos");
      const avisosLidos = names("avisos_lidos");
      for (const field of ["id", "tipo", "titulo", "mensagem", "criado_por", "criado_em", "expira_em", "inativo_em", "urgente", "autor"])
        assert.ok(avisos.includes(field), "Coluna de aviso ausente: " + field);
      for (const field of ["aviso_id", "usuario_id", "lido_em"])
        assert.ok(avisosLidos.includes(field), "Coluna de leitura ausente: " + field);
      const lidoPk = db.prepare("PRAGMA table_info(avisos_lidos)").all().filter(row => row.pk > 0);
      assert.deepEqual(lidoPk.map(row => row.name).sort(), ["aviso_id", "usuario_id"],
        "A leitura de aviso deve ter PK composta por aviso e usuário");
      // Migration 0023: urgência, autor e direcionamento por loja.
      const urgente = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'avisos'").get();
      assert.match(urgente.sql, /urgente INTEGER NOT NULL DEFAULT 0 CHECK \(urgente IN \(0, 1\)\)/);
      assert.match(urgente.sql, /autor TEXT NOT NULL DEFAULT 'Sistema'/);
      const avisosLojas = names("avisos_lojas");
      for (const field of ["aviso_id", "loja"])
        assert.ok(avisosLojas.includes(field), "Coluna de direcionamento ausente: " + field);
      const lojaPk = db.prepare("PRAGMA table_info(avisos_lojas)").all().filter(row => row.pk > 0);
      assert.deepEqual(lojaPk.map(row => row.name).sort(), ["aviso_id", "loja"],
        "O direcionamento deve ter PK composta por aviso e loja");
    } finally {
      db.close();
    }
  });
});
