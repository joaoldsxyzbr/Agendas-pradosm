import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.ts";
import { createSessionToken } from "../../worker/lib/session.ts";
import {
  avisosResponseSchema,
  publicarAvisoSchema
} from "../../shared/avisos.ts";
import {
  avisoEventoStatement,
  inativarAvisoStatement,
  publishAvisoStatement
} from "../../worker/repositories/avisos.ts";
import { importAgendaBatchAtomic } from "../../worker/repositories/agendas.ts";

const SECRET = "somente-testes-sinteticos-de-avisos-sem-credencial-real";

// ---------------------------------------------------------------------------
// Contratos zod de avisos (shared/avisos.ts)
// ---------------------------------------------------------------------------

describe("Contratos de avisos (shared/avisos.ts)", () => {
  it("publicarAvisoSchema aceita aviso válido com e sem expiração", () => {
    const basico = publicarAvisoSchema.safeParse({
      titulo: " Mudança de doca ",
      mensagem: "A partir de amanhã a doca 3 fica fechada."
    });
    assert.equal(basico.success, true);
    assert.equal(basico.success && basico.data.titulo, "Mudança de doca");
    const comExpiracao = publicarAvisoSchema.safeParse({
      titulo: "Aviso rápido",
      mensagem: "Hoje o expediente termina às 16h.",
      expiraEm: "2026-11-12T23:59:59.000Z"
    });
    assert.equal(comExpiracao.success, true);
    const expiracaoExplicitaNula = publicarAvisoSchema.safeParse({
      titulo: "Aviso permanente",
      mensagem: "Novo fluxo de recebimento em vigor.",
      expiraEm: null
    });
    assert.equal(expiracaoExplicitaNula.success, true);
  });

  it("publicarAvisoSchema rejeita limites e formatos inválidos", () => {
    assert.equal(publicarAvisoSchema.safeParse({ titulo: "", mensagem: "ok" }).success, false);
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "x".repeat(201), mensagem: "ok" }).success,
      false
    );
    assert.equal(publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "" }).success, false);
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "x".repeat(2001) }).success,
      false
    );
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "ok", expiraEm: "amanha" }).success,
      false
    );
  });

  it("avisosResponseSchema valida o contrato da listagem", () => {
    const parsed = avisosResponseSchema.parse({
      avisos: [
        { id: "a1", tipo: "aviso", titulo: "T", mensagem: "M", criadoEm: "2026-11-11T10:00:00.000Z", expiraEm: null, lido: false }
      ],
      naoLidos: 1
    });
    assert.equal(parsed.naoLidos, 1);
    assert.equal(parsed.avisos[0].tipo, "aviso");
  });
});

// ---------------------------------------------------------------------------
// Arity bind x placeholders — o D1 rejeita binds divergentes e a substituição
// em lote já quebrou produção por isso (incidente #214). Todos os statements
// de avisos seguem o mesmo contrato.
// ---------------------------------------------------------------------------

function arityDb() {
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
    statements,
    prepare(sql) {
      const statement = {
        sql,
        async all() { return { results: [] }; },
        async first() { return null; },
        async run() { return { meta: { changes: 1 } }; }
      };
      statement.bind = (...values) => {
        assertArity(sql, values);
        statement.values = values;
        statements.push(statement);
        return statement;
      };
      return statement;
    },
    async batch(batchStatements) {
      // Os statements já entram no array via bind(); não duplicar aqui.
      return batchStatements.map(() => ({ meta: { changes: 1 } }));
    }
  };
}

describe("Statements de avisos: bind igual aos placeholders", () => {
  it("publishAvisoStatement e inativarAvisoStatement têm arity exata", () => {
    const db = arityDb();
    publishAvisoStatement(db, { titulo: "T", mensagem: "M", criadoPor: "adm1", criadoEm: "t0", expiraEm: null });
    inativarAvisoStatement(db, { avisoId: "a1", now: "t0" });
    assert.equal(db.statements.length, 2);
  });

  it("avisoEventoStatement com e sem guard têm arity exata", () => {
    const db = arityDb();
    avisoEventoStatement(db, { titulo: "T", mensagem: "M", criadoEm: "t0" });
    avisoEventoStatement(db, { titulo: "T", mensagem: "M", criadoEm: "t0", guardAuditId: "aud1" });
    assert.equal(db.statements.length, 2);
    assert.match(db.statements[0].sql, /INSERT INTO avisos/);
    assert.match(db.statements[1].sql, /WHERE EXISTS/);
  });

  it("importação em lote gera exatamente um aviso por lote no mesmo batch", async () => {
    const db = arityDb();
    const appointment = {
      protocol: "P1",
      startTime: "08:00",
      endTime: "08:30",
      supplier: "Fornecedor sintético",
      items: 2,
      volumes: null,
      pallets: null,
      cargaBatida: null,
      type: "Carga seca",
      nfe: [],
      orders: ["P1"],
      csvFields: null
    };
    const input = {
      storeCode: "01",
      date: "2026-11-11",
      originalFileName: "lote.csv",
      appointments: [appointment, { ...appointment, protocol: "P2" }]
    };
    await importAgendaBatchAtomic(db, "adm1", [
      { storeId: "loja-1", existing: null, input },
      { storeId: "loja-2", existing: null, input: { ...input, storeCode: "02" } }
    ]);
    const avisos = db.statements.filter((statement) => statement.sql.includes("INSERT INTO avisos"));
    assert.equal(avisos.length, 1, "o lote inteiro deve gerar um único aviso");
    assert.match(avisos[0].values[2] ?? "", /2 agendas e 4 agendamentos/);
  });
});

// ---------------------------------------------------------------------------
// Rotas integradas: Worker + SQLite sintético, sem mocks de endpoints
// (mesmo padrão do recebimento-api-integrated).
// ---------------------------------------------------------------------------

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec([
    "CREATE TABLE lojas (id TEXT PRIMARY KEY, codigo TEXT, nome TEXT, ativo INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE usuarios (id TEXT PRIMARY KEY, loja_id TEXT, nome TEXT, login TEXT, senha_hash TEXT, papel TEXT, ativo INTEGER, session_version INTEGER, excluido_em TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendas (id TEXT PRIMARY KEY, loja_id TEXT, data_agenda TEXT, arquivo_original TEXT, criado_por TEXT, status_dia TEXT, concluido_em TEXT, concluido_por TEXT, digitado_em TEXT, digitado_por TEXT, criado_em TEXT, atualizado_em TEXT)",
    "CREATE TABLE agendamentos (id TEXT PRIMARY KEY, agenda_id TEXT, protocolo TEXT, horario_inicio TEXT, horario_fim TEXT, fornecedor TEXT, itens INTEGER, volumes INTEGER, paletes INTEGER, carga_batida TEXT, tipo TEXT, nfe TEXT, pedidos TEXT, status TEXT, trocas INTEGER, observacao TEXT, origem TEXT, ativo INTEGER, criado_em TEXT, atualizado_em TEXT, csv_campos TEXT)",
    "CREATE TABLE historico_status (id TEXT PRIMARY KEY, agendamento_id TEXT, usuario_id TEXT, status_anterior TEXT, status_novo TEXT, observacao TEXT, alterado_em TEXT)",
    "CREATE TABLE historico_agenda (id TEXT PRIMARY KEY, agenda_id TEXT, usuario_id TEXT, acao TEXT, detalhes TEXT, alterado_em TEXT)",
    "CREATE TABLE auditoria (id TEXT PRIMARY KEY, usuario_id TEXT, acao TEXT, entidade TEXT, entidade_id TEXT, loja_id TEXT, agenda_id TEXT, agendamento_id TEXT, antes TEXT, depois TEXT, detalhes TEXT, criado_em TEXT)",
    "CREATE TABLE avisos (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('aviso','evento')), titulo TEXT NOT NULL, mensagem TEXT NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL, expira_em TEXT, inativo_em TEXT)",
    "CREATE TABLE avisos_lidos (aviso_id TEXT NOT NULL, usuario_id TEXT NOT NULL, lido_em TEXT NOT NULL, PRIMARY KEY (aviso_id, usuario_id))"
  ].join(";\n") + ";");
  const now = "2026-11-11T12:00:00.000Z";
  sqlite.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES (?,?,?,1)").run("loja1", "01", "Loja sintética 1");
  const addUser = sqlite.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,ativo,session_version) VALUES (?,?,?,?,?,?,1,1)");
  addUser.run("conf1", "loja1", "Conferente 1", "conf1", "sintetico", "conferente");
  addUser.run("adm1", null, "Administrador", "adm1", "sintetico", "admin");
  addUser.run("view1", null, "Visualizador", "view1", "sintetico", "visualizador");
  sqlite.prepare("INSERT INTO agendas (id,loja_id,data_agenda,arquivo_original,criado_por,status_dia,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?)")
    .run("agenda1", "loja1", "2026-11-11", "sintetico.csv", "adm1", "aberto", now, now);

  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let bindings = [];
      const request = {
        sql,
        bind(...values) { bindings = values; return request; },
        async first() { return statement.get(...bindings) ?? null; },
        async all() { return { results: statement.all(...bindings) }; },
        async run() {
          const result = statement.run(...bindings);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return request;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
  const env = { DB: db, SESSION_SECRET: SECRET, REALTIME_MODE: "off" };
  const headers = (userId, extra = {}) => ({
    "Content-Type": "application/json",
    Origin: "http://localhost",
    Cookie: "agenda_session=" + (async () => await createSessionToken(userId, 1, SECRET))(),
    ...extra
  });
  async function call(userId, path, { method = "GET", body } = {}) {
    const token = await createSessionToken(userId, 1, SECRET);
    return app.request("http://localhost" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        Cookie: "agenda_session=" + token,
        ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) })
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) })
    }, env);
  }
  const avisosCount = () => sqlite.prepare("SELECT count(*) AS n FROM avisos WHERE inativo_em IS NULL").get().n;
  const auditCount = (acao) => sqlite.prepare("SELECT count(*) AS n FROM auditoria WHERE acao = ?").get(acao).n;
  return { sqlite, call, avisosCount, auditCount };
}

describe("Rotas de avisos integradas", () => {
  it("admin publica; conferente lê, marca como lido e o badge zera", async () => {
    const f = fixture();
    try {
      const publicacao = await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Doca 3 fechada", mensagem: "A doca 3 fica fechada hoje." }
      });
      assert.equal(publicacao.status, 201);
      const publicado = await publicacao.json();

      const resposta = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(resposta.naoLidos, 1);
      assert.equal(resposta.avisos.length, 1);
      assert.equal(resposta.avisos[0].titulo, "Doca 3 fechada");
      assert.equal(resposta.avisos[0].tipo, "aviso");
      assert.equal(resposta.avisos[0].lido, false);
      assert.equal(f.auditCount("aviso_publicado"), 1);

      const lido = await f.call("conf1", `/api/avisos/${publicado.id}/lido`, { method: "POST" });
      assert.equal(lido.status, 200);
      const aposLer = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(aposLer.naoLidos, 0);
      assert.equal(aposLer.avisos[0].lido, true);
      // Marcar de novo é idempotente.
      const reMarcar = await f.call("conf1", `/api/avisos/${publicado.id}/lido`, { method: "POST" });
      assert.equal(reMarcar.status, 200);
      assert.equal((await reMarcar.json()).jaLido, true);
      // O estado "lido" é por usuário: o admin continua com badge.
      const visaoAdmin = await (await f.call("adm1", "/api/avisos")).json();
      assert.equal(visaoAdmin.naoLidos, 1);
    } finally {
      f.sqlite.close();
    }
  });

  it("sem sessão é 401; conferente e visualizador não publicam nem inativam", async () => {
    const f = fixture();
    try {
      assert.equal((await app.request("http://localhost/api/avisos")).status, 401);
      assert.equal(
        (await f.call("conf1", "/api/admin/avisos", { method: "POST", body: { titulo: "T", mensagem: "M" } })).status,
        403
      );
      assert.equal(
        (await f.call("view1", "/api/admin/avisos", { method: "POST", body: { titulo: "T", mensagem: "M" } })).status,
        403
      );
      // Visualizador lê os avisos normalmente.
      assert.equal((await f.call("view1", "/api/avisos")).status, 200);
      // Corpo inválido rejeitado com mensagem em PT-BR.
      const invalido = await f.call("adm1", "/api/admin/avisos", { method: "POST", body: { titulo: "", mensagem: "" } });
      assert.equal(invalido.status, 400);
      assert.match((await invalido.json()).message, /título do aviso/i);
      assert.equal(f.avisosCount(), 0);
    } finally {
      f.sqlite.close();
    }
  });

  it("inativar remove da lista e grava auditoria; id inexistente é 404", async () => {
    const f = fixture();
    try {
      const { id } = await (await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso velho", mensagem: "Será inativado." }
      })).json();
      const inativacao = await f.call("adm1", `/api/admin/avisos/${id}/inativar`, { method: "POST" });
      assert.equal(inativacao.status, 200);
      assert.equal(f.auditCount("aviso_inativado"), 1);
      assert.equal(f.avisosCount(), 0);
      // Inativar de novo não regrava auditoria e responde 404.
      const deNovo = await f.call("adm1", `/api/admin/avisos/${id}/inativar`, { method: "POST" });
      assert.equal(deNovo.status, 404);
      assert.equal(f.auditCount("aviso_inativado"), 1);
      const inexistente = await f.call("adm1", "/api/admin/avisos/nao-existe/inativar", { method: "POST" });
      assert.equal(inexistente.status, 404);
    } finally {
      f.sqlite.close();
    }
  });

  it("aviso expirado some da lista sem precisar de inativação", async () => {
    const f = fixture();
    try {
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso antigo", mensagem: "Já venceu.", expiraEm: "2026-11-10T00:00:00.000Z" }
      });
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso vigente", mensagem: "Ainda vale." }
      });
      const resposta = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(resposta.avisos.length, 1);
      assert.equal(resposta.avisos[0].titulo, "Aviso vigente");
      assert.equal(resposta.naoLidos, 1);
    } finally {
      f.sqlite.close();
    }
  });

  it("concluir o dia e reabrir geram eventos de aviso na mesma transação", async () => {
    const f = fixture();
    try {
      const conclusao = await f.call("conf1", "/api/store/agenda/2026-11-11/complete", { method: "POST" });
      assert.equal(conclusao.status, 200);
      let resposta = await (await f.call("adm1", "/api/avisos")).json();
      assert.equal(resposta.naoLidos, 1);
      assert.equal(resposta.avisos[0].tipo, "evento");
      assert.match(resposta.avisos[0].titulo, /Dia conclu\u00eddo/);
      assert.match(resposta.avisos[0].mensagem, /Loja sint\u00e9tica 1 em 11\/11\/2026/);

      const reabertura = await f.call("adm1", "/api/admin/agendas/agenda1/status", {
        method: "PATCH",
        body: { status: "aberto" }
      });
      assert.equal(reabertura.status, 200);
      resposta = await (await f.call("adm1", "/api/avisos")).json();
      assert.equal(resposta.naoLidos, 2);
      assert.match(resposta.avisos[0].titulo, /Agenda reaberta/);
      assert.equal(resposta.avisos.filter((aviso) => aviso.tipo === "evento").length, 2);
    } finally {
      f.sqlite.close();
    }
  });
});
