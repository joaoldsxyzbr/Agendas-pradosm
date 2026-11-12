import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { app } from "../../worker/app.ts";
import { createSessionToken } from "../../worker/lib/session.ts";
import {
  avisoSchema,
  avisosResponseSchema,
  publicarAvisoSchema
} from "../../shared/avisos.ts";
import {
  avisoEventoStatement,
  markTodosAvisosLidos,
  publishAvisoStatements
} from "../../worker/repositories/avisos.ts";
import { importAgendaBatchAtomic } from "../../worker/repositories/agendas.ts";

const SECRET = "somente-testes-sinteticos-de-avisos-sem-credencial-real";

// ---------------------------------------------------------------------------
// Contratos zod de avisos (shared/avisos.ts)
// ---------------------------------------------------------------------------

describe("Contratos de avisos (shared/avisos.ts)", () => {
  it("publicarAvisoSchema aceita aviso válido com urgência e lojas opcionais", () => {
    const basico = publicarAvisoSchema.safeParse({
      titulo: " Mudança de doca ",
      mensagem: "A partir de amanhã a doca 3 fica fechada."
    });
    assert.equal(basico.success, true);
    assert.equal(basico.success && basico.data.titulo, "Mudança de doca");
    assert.equal(basico.success && basico.data.urgente, false, "urgência padrão é false");
    assert.equal(basico.success && basico.data.lojas, null, "sem lojas = todas as lojas");
    const direcionado = publicarAvisoSchema.safeParse({
      titulo: "Inventário",
      mensagem: "Amanhã às 7h.",
      urgente: true,
      lojas: ["01", "02"]
    });
    assert.equal(direcionado.success, true);
    assert.equal(direcionado.success && direcionado.data.urgente, true);
    assert.deepEqual(direcionado.success && direcionado.data.lojas, ["01", "02"]);
    const lojasExplicitaNulas = publicarAvisoSchema.safeParse({
      titulo: "Aviso geral",
      mensagem: "Novo fluxo de recebimento em vigor.",
      lojas: null
    });
    assert.equal(lojasExplicitaNulas.success, true);
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
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "ok", urgente: "sim" }).success,
      false
    );
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "ok", lojas: "01" }).success,
      false
    );
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "ok", lojas: [""] }).success,
      false
    );
    assert.equal(
      publicarAvisoSchema.safeParse({ titulo: "ok", mensagem: "ok", lojas: ["01", ""] }).success,
      false
    );
  });

  it("avisosResponseSchema valida o contrato da listagem", () => {
    const parsed = avisosResponseSchema.parse({
      avisos: [
        { id: "a1", tipo: "aviso", titulo: "T", mensagem: "M", criadoEm: "2026-11-11T10:00:00.000Z",
          lido: false, urgente: true, autor: "Administrador", lojas: ["01", "07"] },
        { id: "a2", tipo: "evento", titulo: "T2", mensagem: "M2", criadoEm: "2026-11-11T11:00:00.000Z",
          lido: true, urgente: false, autor: "Sistema", lojas: null }
      ],
      naoLidos: 1
    });
    assert.equal(parsed.naoLidos, 1);
    assert.equal(parsed.avisos[0].tipo, "aviso");
    assert.equal(parsed.avisos[0].urgente, true);
    assert.equal(parsed.avisos[0].autor, "Administrador");
    assert.deepEqual(parsed.avisos[0].lojas, ["01", "07"]);
    assert.equal(parsed.avisos[1].lojas, null);
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
  it("publishAvisoStatements têm arity exata com e sem lojas", () => {
    const db = arityDb();
    publishAvisoStatements(db, { titulo: "T", mensagem: "M", criadoPor: "adm1", autor: "Administrador", criadoEm: "t0", urgente: true, lojas: null });
    publishAvisoStatements(db, { titulo: "T", mensagem: "M", criadoPor: "adm1", autor: "Administrador", criadoEm: "t0", urgente: false, lojas: ["01", "02"] });
    // 1 INSERT do aviso + 2 INSERTs de direcionamento + 1 INSERT + 0.
    assert.equal(db.statements.length, 4);
    assert.match(db.statements[0].sql, /INSERT INTO avisos/);
    assert.match(db.statements[2].sql, /INSERT INTO avisos_lojas/);
    assert.equal(db.statements[2].values[1], "01");
    assert.equal(db.statements[3].values[1], "02");
    const semLojas = arityDb();
    publishAvisoStatements(semLojas, { titulo: "T", mensagem: "M", criadoPor: "adm1", autor: "Administrador", criadoEm: "t0", urgente: false, lojas: null });
    assert.equal(semLojas.statements.length, 1);
  });

  it("markTodosAvisosLidos tem arity exata com e sem filtro de loja/tipo", async () => {
    const db = arityDb();
    await markTodosAvisosLidos(db, "conf1", "t0", "01");
    await markTodosAvisosLidos(db, "adm1", "t0", null);
    await markTodosAvisosLidos(db, "conf1", "t0", "01", false);
    await markTodosAvisosLidos(db, "view1", "t0", null, true);
    assert.equal(db.statements.length, 4);
    assert.match(db.statements[0].sql, /INSERT OR IGNORE INTO avisos_lidos/);
    assert.match(db.statements[0].sql, /avisos_lojas/);
    assert.doesNotMatch(db.statements[1].sql, /avisos_lojas x WHERE x.aviso_id = a.id AND x.loja/);
    // Sem eventos: o filtro por tipo entra na cláusula WHERE.
    assert.match(db.statements[2].sql, /a\.tipo = 'aviso'/);
    assert.doesNotMatch(db.statements[3].sql, /a\.tipo = 'aviso'/);
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
    "CREATE TABLE avisos (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('aviso','evento')), titulo TEXT NOT NULL, mensagem TEXT NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL, expira_em TEXT, inativo_em TEXT, urgente INTEGER NOT NULL DEFAULT 0 CHECK (urgente IN (0,1)), autor TEXT NOT NULL DEFAULT 'Sistema')",
    "CREATE TABLE avisos_lidos (aviso_id TEXT NOT NULL, usuario_id TEXT NOT NULL, lido_em TEXT NOT NULL, PRIMARY KEY (aviso_id, usuario_id))",
    "CREATE TABLE avisos_lojas (aviso_id TEXT NOT NULL, loja TEXT NOT NULL, PRIMARY KEY (aviso_id, loja))"
  ].join(";\n") + ";");
  const now = "2026-11-11T12:00:00.000Z";
  const addLoja = sqlite.prepare("INSERT INTO lojas (id,codigo,nome,ativo) VALUES (?,?,?,1)");
  addLoja.run("loja1", "01", "Loja sintética 1");
  addLoja.run("loja2", "02", "Loja sintética 2");
  const addUser = sqlite.prepare("INSERT INTO usuarios (id,loja_id,nome,login,senha_hash,papel,ativo,session_version) VALUES (?,?,?,?,?,?,1,1)");
  addUser.run("conf1", "loja1", "Conferente 1", "conf1", "sintetico", "conferente");
  addUser.run("conf2", "loja2", "Conferente 2", "conf2", "sintetico", "conferente");
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
  const avisosCount = () => sqlite.prepare("SELECT count(*) AS n FROM avisos").get().n;
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
      // Contrato: a resposta da publicação é um aviso completo (o frontend
      // faz avisoSchema.parse nela — mock de E2E fiel ao schema não pega
      // divergência entre rota real e schema).
      const contrato = avisoSchema.safeParse(publicado);
      assert.equal(contrato.success, true);
      assert.equal(contrato.success && contrato.data.autor, "Administrador");
      assert.equal(contrato.success && contrato.data.urgente, false);
      assert.equal(contrato.success && contrato.data.lojas, null);
      const resposta = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(resposta.naoLidos, 1);
      assert.equal(resposta.avisos.length, 1);
      assert.equal(resposta.avisos[0].titulo, "Doca 3 fechada");
      assert.equal(resposta.avisos[0].tipo, "aviso");
      assert.equal(resposta.avisos[0].lido, false);
      assert.equal(resposta.avisos[0].autor, "Administrador");
      assert.equal(resposta.avisos[0].urgente, false);
      assert.equal(resposta.avisos[0].lojas, null);
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

  it("aviso urgente e direcionado: só as lojas destinatárias veem", async () => {
    const f = fixture();
    try {
      const publicacao = await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Inventário loja 01", mensagem: "Amanhã às 7h.", urgente: true, lojas: ["01"] }
      });
      assert.equal(publicacao.status, 201);
      const publicado = await publicacao.json();
      assert.equal(publicado.urgente, true);
      assert.deepEqual(publicado.lojas, ["01"]);

      const visaoConf1 = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(visaoConf1.naoLidos, 1);
      assert.equal(visaoConf1.avisos[0].urgente, true);
      assert.deepEqual(visaoConf1.avisos[0].lojas, ["01"]);
      // Conferente de outra loja não vê o aviso direcionado.
      const visaoConf2 = await (await f.call("conf2", "/api/avisos")).json();
      assert.equal(visaoConf2.naoLidos, 0);
      assert.equal(visaoConf2.avisos.length, 0);
      // Admin vê tudo (inclusive direcionado).
      const visaoAdmin = await (await f.call("adm1", "/api/avisos")).json();
      assert.equal(visaoAdmin.avisos.length, 1);
      // Visualizador também vê tudo.
      const visaoView = await (await f.call("view1", "/api/avisos")).json();
      assert.equal(visaoView.avisos.length, 1);
    } finally {
      f.sqlite.close();
    }
  });

  it("eventos do sistema não chegam ao conferente; ficam com admin e visualizador", async () => {
    const f = fixture();
    try {
      // Evento automático no mesmo formato dos statements de agendas.ts:
      // sem direcionamento, criado pelo sistema, autor "Sistema".
      f.sqlite.prepare(
        "INSERT INTO avisos (id, tipo, titulo, mensagem, criado_em) " +
        "VALUES ('ev1', 'evento', 'Agenda importada', '10 agendas e 216 agendamentos importados.', '2026-11-12T12:00:00.000Z')"
      ).run();
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso do admin", mensagem: "Somente recados do admin chegam ao conferente." }
      });
      // Conferente: só o aviso — o evento não entra na lista nem no badge
      // (decisão de 12/11/2026: o conferente recebe apenas avisos do admin).
      const visaoConf = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(visaoConf.avisos.length, 1);
      assert.equal(visaoConf.avisos.every((aviso) => aviso.tipo === "aviso"), true, "nenhum evento na lista do conferente");
      assert.equal(visaoConf.naoLidos, 1, "o evento não conta no badge do conferente");
      // Marcar-todos do conferente só grava o que ele enxerga.
      const marcar = await f.call("conf1", "/api/avisos/marcar-todos", { method: "POST" });
      assert.equal((await marcar.json()).marcados, 1);
      // Admin vê evento E aviso; nada foi lido por ele.
      const visaoAdmin = await (await f.call("adm1", "/api/avisos")).json();
      assert.equal(visaoAdmin.avisos.length, 2);
      assert.equal(visaoAdmin.naoLidos, 2);
      assert.equal(visaoAdmin.avisos.some((aviso) => aviso.tipo === "evento"), true);
      // Visualizador (gerente) também vê o evento.
      const visaoView = await (await f.call("view1", "/api/avisos")).json();
      assert.equal(visaoView.avisos.length, 2);
      assert.equal(visaoView.avisos.some((aviso) => aviso.tipo === "evento"), true);
    } finally {
      f.sqlite.close();
    }
  });

  it("marcar-todos grava a leitura dos avisos visíveis e zera o badge", async () => {
    const f = fixture();
    try {
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso 1", mensagem: "Um." }
      });
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso 2", mensagem: "Dois.", urgente: true }
      });
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Só loja 02", mensagem: "Três.", lojas: ["02"] }
      });
      const antes = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(antes.naoLidos, 2, "o direcionado à loja 02 não conta para o conferente da 01");
      const marcar = await f.call("conf1", "/api/avisos/marcar-todos", { method: "POST" });
      assert.equal(marcar.status, 200);
      const corpo = await marcar.json();
      assert.equal(corpo.ok, true);
      assert.equal(corpo.marcados, 2);
      const depois = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(depois.naoLidos, 0);
      assert.equal(depois.avisos.filter((aviso) => aviso.lido).length, 2);
      // Idempotente: de novo não regrava nada.
      const deNovo = await f.call("conf1", "/api/avisos/marcar-todos", { method: "POST" });
      assert.equal((await deNovo.json()).marcados, 0);
      // A leitura é por usuário: marcar-todos do conferente da 01 não toca
      // o estado do conferente da 02 (que ainda vê 3 não lidos).
      const visaoConf2 = await (await f.call("conf2", "/api/avisos")).json();
      assert.equal(visaoConf2.naoLidos, 3, "marcar-todos de um usuário não marca por outro");
    } finally {
      f.sqlite.close();
    }
  });

  it("sem sessão é 401; conferente e visualizador não publicam", async () => {
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
      // Loja inexistente no direcionamento é 400, sem gravar nada.
      const lojaInvalida = await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "T", mensagem: "M", lojas: ["99"] }
      });
      assert.equal(lojaInvalida.status, 400);
      assert.equal((await lojaInvalida.json()).error, "LOJAS_INVALIDAS");
      assert.equal(f.avisosCount(), 0);
    } finally {
      f.sqlite.close();
    }
  });

  it("avisos publicados permanecem para sempre: nada de expiração ou inativação", async () => {
    const f = fixture();
    try {
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso antigo", mensagem: "Ainda está na lista." }
      });
      await f.call("adm1", "/api/admin/avisos", {
        method: "POST",
        body: { titulo: "Aviso vigente", mensagem: "Também está." }
      });
      const resposta = await (await f.call("conf1", "/api/avisos")).json();
      assert.equal(resposta.avisos.length, 2, "nenhum aviso sai da lista");
      assert.equal(resposta.naoLidos, 2);
      // Rota de inativação não existe mais.
      const inativar = await f.call("adm1", "/api/admin/avisos/nao-existe/inativar", { method: "POST" });
      assert.equal(inativar.status, 404);
      assert.equal(f.auditCount("aviso_inativado"), 0);
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
      assert.equal(resposta.avisos[0].autor, "Sistema", "eventos automáticos têm autor Sistema");
      assert.equal(resposta.avisos[0].urgente, false);
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
