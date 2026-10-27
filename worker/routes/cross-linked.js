import { Hono } from "hono";
import { CrossInput, crossInputTotals } from "./cross.js";
import { auditStatement } from "../repositories/audit.js";

const DOCK_CODE = "CD DOCA 01";
const MAX_BODY = 512 * 1024;
const fail = (c, code, status) => c.json({ error: code }, status);
const uuidLike = v => typeof v === "string" && /^[\w-]{1,100}$/.test(v);
const admin = c => c.get("authUser")?.papel === "admin";
const dock = c => {
  const u = c.get("authUser");
  return u?.papel === "conferente" && u.lojaCodigo?.trim().toUpperCase() === DOCK_CODE;
};

async function findDockAgenda(db, agendaId) {
  if (!uuidLike(agendaId)) return null;
  return db.prepare(`SELECT a.id, a.data_agenda, a.loja_id, a.status_dia
    FROM agendas a JOIN lojas l ON l.id = a.loja_id
    WHERE a.id = ? AND l.codigo = ? COLLATE NOCASE
      AND l.ativo = 1 AND l.excluido_em IS NULL LIMIT 1`)
    .bind(agendaId, DOCK_CODE).first();
}

async function findAppointment(db, agendaId, appointmentId, allowInactive = false) {
  if (!uuidLike(appointmentId)) return null;
  const sql = `SELECT id, agenda_id, protocolo, fornecedor, horario_inicio, horario_fim
    FROM agendamentos WHERE id = ? AND agenda_id = ?` +
    (allowInactive ? " LIMIT 1" : " AND ativo = 1 LIMIT 1");
  return db.prepare(sql).bind(appointmentId, agendaId).first();
}

function authorized(c, agenda) {
  if (admin(c)) return true;
  return dock(c) && c.get("authUser").lojaId === agenda.loja_id;
}

function reportDTO(row) {
  return {
    id: row.id, agendaId: row.agenda_id, appointmentId: row.agendamento_id,
    version: row.versao, active: row.ativo === 1,
    date: row.data_operacional, reportDate: row.data_relatorio,
    reportCode: row.codigo_relatorio, fileName: row.arquivo_original,
    reference: row.referencia, stores: row.lojas, lines: row.linhas,
    dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar,
    createdAt: row.criado_em
  };
}

function appointmentDTO(row) {
  // A listagem faz JOIN com cross_relatorios: row.id é o relatório, não o agendamento.
  return { id: row.appointment_id ?? row.id, protocol: row.protocolo, supplier: row.fornecedor,
    startTime: row.horario_inicio, endTime: row.horario_fim };
}

function itemDTO(row) {
  return {
    storeNumber: row.loja_numero, storeName: row.loja_nome,
    department: row.departamento, orderCode: row.pedido,
    productCode: row.produto_codigo, description: row.descricao, gtin: row.gtin,
    dispatchCode: row.expedicao_codigo, packageSize: row.embalagem,
    dispatchQty: row.quantidade_expedicao, separateQty: row.quantidade_separar
  };
}

async function findLinkedReport(db, agendaId, appointmentId, reportId = null) {
  const statement = reportId
    ? db.prepare(`SELECT * FROM cross_relatorios WHERE id = ? AND agenda_id = ?
         AND agendamento_id = ? LIMIT 1`).bind(reportId, agendaId, appointmentId)
    : db.prepare(`SELECT * FROM cross_relatorios WHERE agenda_id = ? AND
         agendamento_id = ? AND ativo = 1 LIMIT 1`).bind(agendaId, appointmentId);
  return statement.first();
}

async function reportDetails(db, report) {
  const rows = await db.prepare(`SELECT * FROM cross_itens
    WHERE relatorio_id = ? ORDER BY ordem ASC`).bind(report.id).all();
  return { report: reportDTO(report), rows: rows.results.map(itemDTO) };
}

export const adminLinkedCrossRoutes = new Hono();
export const storeLinkedCrossRoutes = new Hono();

async function getAgenda(c) {
  const agenda = await findDockAgenda(c.env.DB, c.req.param("agendaId"));
  if (!agenda) return { error: fail(c, "AGENDA_DOCA_01_NAO_ENCONTRADA", 404) };
  if (!authorized(c, agenda)) return { error: fail(c, "ACESSO_NEGADO", 403) };
  return { agenda };
}

async function getAppointment(c, { allowInactive = false } = {}) {
  const context = await getAgenda(c);
  if (context.error) return context;
  const appointment = await findAppointment(c.env.DB, context.agenda.id, c.req.param("appointmentId"), allowInactive);
  if (!appointment) return { error: fail(c, "AGENDAMENTO_NAO_ENCONTRADO", 404) };
  return { ...context, appointment };
}

async function listByAgenda(c) {
  const { agenda, error } = await getAgenda(c);
  if (error) return error;
  const rows = await c.env.DB.prepare(`SELECT r.*,
      ag.id AS appointment_id, ag.protocolo, ag.fornecedor,
      ag.horario_inicio, ag.horario_fim
    FROM cross_relatorios r
    JOIN agendamentos ag ON ag.id = r.agendamento_id AND ag.agenda_id = r.agenda_id
    WHERE r.agenda_id = ? AND r.ativo = 1 AND r.agendamento_id IS NOT NULL AND ag.ativo = 1
    ORDER BY ag.horario_inicio ASC, ag.protocolo ASC`).bind(agenda.id).all();
  return c.json({
    agendaId: agenda.id,
    date: agenda.data_agenda,
    suppliers: rows.results.map(row => ({
      appointment: appointmentDTO(row), cross: reportDTO(row)
    }))
  });
}

async function activeByAppointment(c) {
  const { agenda, appointment, error } = await getAppointment(c);
  if (error) return error;
  const report = await findLinkedReport(c.env.DB, agenda.id, appointment.id);
  if (!report) return fail(c, "CROSS_NAO_ENCONTRADO", 404);
  return c.json({ appointment: appointmentDTO(appointment), ...await reportDetails(c.env.DB, report) });
}

async function historyByAppointment(c) {
  const { agenda, appointment, error } = await getAppointment(c, { allowInactive: true });
  if (error) return error;
  const versions = await c.env.DB.prepare(`SELECT * FROM cross_relatorios
    WHERE agenda_id = ? AND agendamento_id = ? ORDER BY versao DESC`)
    .bind(agenda.id, appointment.id).all();
  return c.json({ appointment: appointmentDTO(appointment), versions: versions.results.map(reportDTO) });
}

async function historyDetails(c) {
  const { agenda, appointment, error } = await getAppointment(c, { allowInactive: true });
  if (error) return error;
  const report = await findLinkedReport(c.env.DB, agenda.id, appointment.id, c.req.param("reportId"));
  if (!report) return fail(c, "CROSS_NAO_ENCONTRADO", 404);
  return c.json({ appointment: appointmentDTO(appointment), ...await reportDetails(c.env.DB, report) });
}

adminLinkedCrossRoutes.get("/agendas/:agendaId", listByAgenda);
adminLinkedCrossRoutes.get("/agendas/:agendaId/appointments/:appointmentId", activeByAppointment);
adminLinkedCrossRoutes.get("/agendas/:agendaId/appointments/:appointmentId/history", historyByAppointment);
adminLinkedCrossRoutes.get("/agendas/:agendaId/appointments/:appointmentId/history/:reportId", historyDetails);

storeLinkedCrossRoutes.get("/agendas/:agendaId", c => dock(c) ? listByAgenda(c) : fail(c, "ACESSO_NEGADO", 403));
storeLinkedCrossRoutes.get("/agendas/:agendaId/appointments/:appointmentId",
  c => dock(c) ? activeByAppointment(c) : fail(c, "ACESSO_NEGADO", 403));

adminLinkedCrossRoutes.post("/agendas/:agendaId/appointments/:appointmentId", async c => {
  if (!admin(c)) return fail(c, "ACESSO_NEGADO", 403);
  const { agenda, appointment, error } = await getAppointment(c);
  if (error) return error;
  if (agenda.status_dia === "concluido") return fail(c, "AGENDA_CONCLUIDA", 409);

  if (Number(c.req.header("content-length") || 0) > MAX_BODY) return fail(c, "ARQUIVO_MUITO_GRANDE", 413);
  const body = await c.req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY) return fail(c, "ARQUIVO_MUITO_GRANDE", 413);
  let raw;
  try { raw = JSON.parse(body); } catch { return fail(c, "JSON_INVALIDO", 400); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(c, "CROSS_INVALIDO", 422);
  const { replaceActiveReportId, ...payload } = raw;
  if (replaceActiveReportId !== undefined && !uuidLike(replaceActiveReportId)) {
    return fail(c, "RELATORIO_SUBSTITUIDO_INVALIDO", 422);
  }
  const parsed = CrossInput.safeParse(payload);
  if (!parsed.success) return fail(c, "CROSS_INVALIDO", 422);
  const data = parsed.data;
  const totals = crossInputTotals(data);
  if (!totals) return fail(c, "TOTAIS_DIVERGENTES", 422);
  if (data.operationalDate !== agenda.data_agenda) return fail(c, "DATA_AGENDA_DIVERGENTE", 422);

  const active = await findLinkedReport(c.env.DB, agenda.id, appointment.id);
  if (active && active.id !== replaceActiveReportId) {
    return c.json({ error: "CROSS_JA_VINCULADO", activeReportId: active.id }, 409);
  }
  if (!active && replaceActiveReportId !== undefined) return fail(c, "CROSS_VERSAO_DESATUALIZADA", 409);

  // Identidade do PDF no contexto do agendamento. Permite um mesmo documento
  // legítimo em agendamentos distintos sem remover a unicidade já existente no D1.
  const canonical = JSON.stringify({
    appointmentId: appointment.id, reportCode: data.reportCode,
    reportDate: data.reportDate, rows: data.rows
  });
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));
  const fingerprint = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  const duplicate = await c.env.DB.prepare("SELECT id FROM cross_relatorios WHERE hash_conteudo = ? LIMIT 1")
    .bind(fingerprint).first();
  if (duplicate) return c.json({ error: "CROSS_DUPLICADO", reportId: duplicate.id }, 409);

  const lastVersion = await c.env.DB.prepare(`SELECT COALESCE(MAX(versao),0) AS valor
    FROM cross_relatorios WHERE agenda_id = ? AND agendamento_id = ?`)
    .bind(agenda.id, appointment.id).first();
  const version = Number(lastVersion?.valor || 0) + 1;
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const actor = c.get("authUser");
  const statements = [];
  if (active) {
    statements.push(c.env.DB.prepare(`UPDATE cross_relatorios SET ativo = 0
      WHERE id = ? AND agenda_id = ? AND agendamento_id = ? AND ativo = 1`)
      .bind(active.id, agenda.id, appointment.id));
  }
  statements.push(c.env.DB.prepare(`INSERT INTO cross_relatorios
    (id, data_operacional, data_relatorio, codigo_relatorio, referencia,
    arquivo_original, hash_conteudo, lojas, linhas, quantidade_expedicao,
    quantidade_separar, criado_por, criado_em, agenda_id, agendamento_id, versao, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .bind(id, agenda.data_agenda, data.reportDate, data.reportCode, data.reference || null,
      data.fileName, fingerprint, totals.stores, totals.lines, totals.dispatchQty, totals.separateQty,
      actor.id, now, agenda.id, appointment.id, version));
  for (const [index, row] of data.rows.entries()) {
    statements.push(c.env.DB.prepare(`INSERT INTO cross_itens
      (id, relatorio_id, ordem, loja_numero, loja_nome, departamento, pedido,
      produto_codigo, descricao, gtin, expedicao_codigo, embalagem,
      quantidade_expedicao, quantidade_separar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, index, row.storeNumber, row.storeName,
        row.department, row.orderCode, row.productCode, row.description, row.gtin,
        row.dispatchCode, row.packageSize, row.dispatchQty, row.separateQty));
  }
  statements.push(auditStatement(c.env.DB, {
    userId: actor.id, action: active ? "cross_substituido" : "cross_vinculado",
    entity: "cross_relatorio", entityId: id,
    agendaId: agenda.id, appointmentId: appointment.id, storeId: agenda.loja_id,
    after: { version, rows: totals.lines, stores: totals.stores, replacedReportId: active?.id ?? null },
    details: active ? "Cross substituído em homologação." : "Cross vinculado ao agendamento.",
    createdAt: now
  }));
  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    const message = String(err?.message || "");
    if (/UNIQUE constraint|CROSS_AGENDAMENTO_INVALIDO/.test(message)) {
      return fail(c, "CROSS_CONFLITO_CONCORRENTE", 409);
    }
    throw err;
  }
  return c.json({ id, agendaId: agenda.id, appointmentId: appointment.id,
    version, replacedReportId: active?.id ?? null, stores: totals.stores,
    lines: totals.lines, dispatchQty: totals.dispatchQty, separateQty: totals.separateQty }, 201);
});
