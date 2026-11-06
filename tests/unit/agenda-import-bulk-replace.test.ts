import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  importAgendaBatchAtomic,
  replaceAgendaImport
} from "../../worker/repositories/agendas.ts";

// O D1 rejeita prepared statements cuja quantidade de binds difere da
// quantidade de "?" do SQL. Este contrato é invisível para os mocks
// comuns e a substituição em lote quebrou a produção com 500
// (IMPORTACAO_FALHOU) porque o bind incluía csv_campos sem o
// placeholder correspondente. A validação aqui reproduz a checagem
// do D1 para todos os statements gerados.
function arityDb(existingAppointments = []) {
  const calls = [];
  const statements = [];
  const placeholderCount = (sql) => (sql.match(/\?/g) ?? []).length;
  const assertArity = (sql, values) => {
    assert.equal(
      values.length,
      placeholderCount(sql),
      `bind com ${values.length} valores para ${placeholderCount(sql)} placeholders: ${sql}`
    );
  };
  return {
    calls,
    statements,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      const statement = {
        sql,
        async all() {
          return {
            results: sql.includes("FROM agendamentos WHERE agenda_id")
              ? existingAppointments
              : []
          };
        },
        async first() { return null; },
        async run() { return { meta: { changes: 1 } }; }
      };
      statement.bind = (...values) => {
        assertArity(sql, values);
        call.values = values;
        statement.values = values;
        statements.push(statement);
        return statement;
      };
      return statement;
    },
    async batch(batchStatements) {
      for (const statement of batchStatements) {
        assert.match(statement.sql, /INSERT|UPDATE/);
      }
      return batchStatements.map(() => ({ meta: { changes: 1 } }));
    }
  };
}

const existingAgenda = {
  id: "agenda-1",
  loja_id: "loja-1",
  data_agenda: "2026-11-06",
  arquivo_original: "antigo.csv",
  criado_por: "admin",
  status_dia: "aberto",
  concluido_em: null,
  concluido_por: null,
  digitado_em: null,
  digitado_por: null,
  criado_em: "2026-11-06T10:00:00.000Z",
  atualizado_em: "2026-11-06T10:00:00.000Z"
};

const existingAppointments = [
  {
    id: "apt-1",
    agenda_id: "agenda-1",
    protocolo: "12760355",
    horario_inicio: "14:50",
    horario_fim: "15:00",
    fornecedor: "MF EMPORIO DA CARNE EIRELI",
    itens: 5,
    volumes: null,
    paletes: null,
    carga_batida: null,
    tipo: "Carga seca",
    nfe: "[]",
    pedidos: "[]",
    status: "aguardando",
    trocas: 0,
    observacao: null,
    origem: "importado",
    ativo: 1,
    criado_em: "2026-11-06T10:00:00.000Z",
    atualizado_em: "2026-11-06T10:00:00.000Z",
    csv_campos: null
  },
  {
    id: "apt-manual",
    agenda_id: "agenda-1",
    protocolo: "manual:apt-manual",
    horario_inicio: "15:00",
    horario_fim: "15:00",
    fornecedor: "FORNECEDOR DIGITADO",
    itens: null,
    volumes: null,
    paletes: null,
    carga_batida: null,
    tipo: "Sem agenda",
    nfe: "[]",
    pedidos: "[]",
    status: "recebido",
    trocas: 1,
    observacao: null,
    origem: "manual",
    ativo: 1,
    criado_em: "2026-11-06T10:00:00.000Z",
    atualizado_em: "2026-11-06T10:00:00.000Z",
    csv_campos: null
  }
];

const input = {
  storeCode: "CD DOCA 07",
  date: "2026-11-06",
  originalFileName: "agendas-de-recebimento0005305.csv",
  replace: true,
  appointments: [
    {
      protocol: "12760355",
      startTime: "14:50",
      endTime: "15:00",
      supplier: "MF EMPORIO DA CARNE EIRELI",
      items: 6,
      volumes: null,
      pallets: null,
      cargaBatida: null,
      type: "Carga seca",
      nfe: ["123"],
      orders: [],
      csvFields: { FILIAL: "07", DOCA: "3" }
    },
    {
      protocol: "12763147",
      startTime: "15:40",
      endTime: "15:50",
      supplier: "BELARAN INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
      items: 2,
      volumes: null,
      pallets: null,
      cargaBatida: null,
      type: "Carga seca",
      nfe: [],
      orders: ["P1"],
      csvFields: null
    }
  ]
};

describe("Importação em lote substitui agendas existentes sem mismatch de bind", () => {
  it("todos os statements de substituição têm bind igual aos placeholders", async () => {
    const db = arityDb(existingAppointments);
    const results = await importAgendaBatchAtomic(db, "user-1", [
      { storeId: "loja-1", existing: existingAgenda, input }
    ]);
    assert.equal(results.length, 1);
    assert.equal(results[0].replaced, true);
    assert.equal(results[0].appointmentCount, 2);
    assert.ok(db.statements.length >= 5);
    const update = db.statements.find(
      (statement) => statement.sql.startsWith("UPDATE agendamentos SET horario_inicio")
    );
    assert.ok(update, "UPDATE de agendamento ausente");
    assert.match(update.sql, /csv_campos = \?/);
    assert.equal(update.values[10], JSON.stringify({ FILIAL: "07", DOCA: "3" }));
  });

  it("substituição de agenda única mantém o mesmo contrato de bind", async () => {
    const db = arityDb(existingAppointments);
    await replaceAgendaImport(db, existingAgenda, "user-1", input);
    const update = db.statements.find(
      (statement) => statement.sql.startsWith("UPDATE agendamentos SET horario_inicio")
    );
    assert.ok(update);
    assert.match(update.sql, /csv_campos = \?/);
    assert.equal(update.values[10], JSON.stringify({ FILIAL: "07", DOCA: "3" }));
  });

  it("lote com agenda nova também gera statements válidos", async () => {
    const db = arityDb([]);
    const results = await importAgendaBatchAtomic(db, "user-1", [
      { storeId: "loja-1", existing: null, input }
    ]);
    assert.equal(results[0].replaced, false);
    assert.ok(db.statements.length >= 4);
  });
});
