import { normalizeObservation, validateStatusObservation } from "../../shared/observations.js";
import { Hono } from "hono";
import { z } from "zod";
import { ImportAgendaBatchInput, ImportAgendaInput } from "../../shared/agenda.js";
import { businessTime } from "../lib/time.js";
import { publishAgendaChanged } from "../services/realtime.js";
import {
  changeAgendaDayStatus,
  changeAppointmentExchanges,
  changeAppointmentStatus,
  createAgendaImport,
  createManualAppointment,
  importAgendaBatchAtomic,
  AgendaBatchQueryBudgetError,
  findAgendaById,
  findAgendaByStoreDate,
  findAppointmentById,
  findStoreByCode,
  listAdminAgendas,
  listAgendaHistory,
  listAppointmentHistory,
  listAppointmentsByAgenda,
  replaceAgendaImport,
  softDeleteManualAppointment,
  updateManualAppointmentSupplier
} from "../repositories/agendas.js";
const adminAgendaRoutes = new Hono();
const adminAppointmentRoutes = new Hono();
function parseStringArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function appointmentJson(appointment) {
  const manual = appointment.origem === "manual";
  return {
    id: appointment.id,
    protocol: manual ? "Sem agenda" : appointment.protocolo,
    startTime: appointment.horario_inicio,
    endTime: appointment.horario_fim,
    supplier: appointment.fornecedor,
    items: appointment.itens,
    volumes: appointment.volumes,
    pallets: appointment.paletes,
    cargaBatida: appointment.carga_batida,
    type: manual ? "Sem agenda" : appointment.tipo,
    nfe: parseStringArray(appointment.nfe),
    orders: parseStringArray(appointment.pedidos),
    status: appointment.status,
    hasExchanges: appointment.trocas === 1,
    observation: appointment.observacao ?? null,
    origin: manual ? "manual" : "imported",
    ativo: appointment.ativo === 1
  };
}
function agendaJson(agenda) {
  return {
    id: agenda.id,
    storeId: agenda.loja_id,
    storeCode: agenda.store_code,
    storeName: agenda.store_name,
    date: agenda.data_agenda,
    originalFileName: agenda.arquivo_original,
    dayStatus: agenda.status_dia,
    completedAt: agenda.concluido_em,
    completedBy: agenda.concluido_por ? { id: agenda.concluido_por, name: agenda.concluido_por_nome } : null,
    createdBy: agenda.criado_por,
    createdAt: agenda.criado_em,
    updatedAt: agenda.atualizado_em
  };
}
function agendaSummaryJson(agenda) {
  return {
    ...agendaJson(agenda),
    total: Number(agenda.total ?? 0),
    aguardando: Number(agenda.aguardando ?? 0),
    recebido: Number(agenda.recebido ?? 0),
    naoChegou: Number(agenda.nao_chegou ?? 0),
    recusado: Number(agenda.recusado ?? 0),
    semAgenda: Number(agenda.sem_agenda ?? 0)
  };
}
async function details(db, agendaId) {
  const agenda = await findAgendaById(db, agendaId);
  if (!agenda) return null;
  const appointments = await listAppointmentsByAgenda(db, agendaId);
  return {
    agenda: agendaJson(agenda),
    appointments: appointments.map(appointmentJson)
  };
}
function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(/* @__PURE__ */ new Date());
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}
function isAgendaConflict(error) {
  return error instanceof Error && error.message.includes(
    "UNIQUE constraint failed: agendas.loja_id, agendas.data_agenda"
  );
}
adminAgendaRoutes.post("/import", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ImportAgendaInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados da agenda inv\xE1lidos." },
      400
    );
  }
  const store = await findStoreByCode(c.env.DB, parsed.data.storeCode);
  if (!store) {
    return c.json(
      {
        error: "LOJA_NAO_ENCONTRADA",
        message: "A loja informada n\xE3o est\xE1 cadastrada ou est\xE1 inativa."
      },
      422
    );
  }
  const user = c.get("authUser");
  const existing = await findAgendaByStoreDate(
    c.env.DB,
    store.id,
    parsed.data.date
  );
  if (existing && !parsed.data.replace) {
    return c.json(
      {
        error: "AGENDA_JA_EXISTE",
        message: "J\xE1 existe uma agenda para esta loja e data.",
        agendaId: existing.id
      },
      409
    );
  }
  try {
    let agendaId;
    if (existing) {
      await replaceAgendaImport(c.env.DB, existing, user.id, parsed.data);
      agendaId = existing.id;
    } else {
      agendaId = await createAgendaImport(
        c.env.DB,
        store.id,
        user.id,
        parsed.data
      );
    }
    const result = await details(c.env.DB, agendaId);
    if (!result) {
      throw new Error("Agenda gravada n\xE3o p\xF4de ser relida.");
    }
    await publishAgendaChanged(c.env, {
      agendaId,
      storeId: store.id,
      date: parsed.data.date,
      reason: "import"
    });
    return c.json(result, existing ? 200 : 201);
  } catch (error) {
    if (isAgendaConflict(error)) {
      return c.json(
        {
          error: "AGENDA_JA_EXISTE",
          message: "J\xE1 existe uma agenda para esta loja e data."
        },
        409
      );
    }
    console.error("Agenda import failed", error);
    return c.json(
      {
        error: "IMPORTACAO_FALHOU",
        message: "A agenda n\xE3o foi importada. Nenhuma altera\xE7\xE3o parcial foi mantida."
      },
      500
    );
  }
});
adminAgendaRoutes.post("/import/bulk", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ImportAgendaBatchInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "REQUISICAO_INVALIDA",
        message: "Dados do lote de agendas inv\xE1lidos."
      },
      400
    );
  }
  const entries = [];
  const missingStores = [];
  for (const input of parsed.data.agendas) {
    const store = await findStoreByCode(c.env.DB, input.storeCode);
    if (!store) {
      if (!missingStores.includes(input.storeCode)) {
        missingStores.push(input.storeCode);
      }
      continue;
    }
    const existing = await findAgendaByStoreDate(
      c.env.DB,
      store.id,
      input.date
    );
    entries.push({
      storeId: store.id,
      existing,
      input
    });
  }
  if (missingStores.length > 0) {
    return c.json(
      {
        error: "LOJAS_NAO_ENCONTRADAS",
        message: "Uma ou mais lojas do arquivo n\xE3o est\xE3o cadastradas ou est\xE3o inativas.",
        stores: missingStores
      },
      422
    );
  }
  const conflicts = entries.filter((entry) => entry.existing && !entry.input.replace).map((entry) => ({
    storeCode: entry.input.storeCode,
    date: entry.input.date,
    agendaId: entry.existing?.id
  }));
  if (conflicts.length > 0) {
    return c.json(
      {
        error: "AGENDAS_JA_EXISTEM",
        message: "J\xE1 existem agendas para uma ou mais lojas e datas do arquivo.",
        conflicts
      },
      409
    );
  }
  try {
    const user = c.get("authUser");
    const results = await importAgendaBatchAtomic(c.env.DB, user.id, entries);
    for (const result of results) {
      const entry = entries.find(
        (item) => item.input.storeCode === result.storeCode && item.input.date === result.date
      );
      if (!entry) continue;
      await publishAgendaChanged(c.env, {
        agendaId: result.agendaId,
        storeId: entry.storeId,
        date: result.date,
        reason: "import"
      });
    }
    return c.json(
      {
        agendas: results,
        totalAgendas: results.length,
        totalAppointments: results.reduce(
          (total, item) => total + item.appointmentCount,
          0
        ),
        created: results.filter((item) => !item.replaced).length,
        replaced: results.filter((item) => item.replaced).length
      },
      results.some((item) => item.replaced) ? 200 : 201
    );
  } catch (error) {
    if (error instanceof AgendaBatchQueryBudgetError) {
      return c.json(
        {
          error: "LOTE_MUITO_GRANDE",
          message: "O lote exige opera\xE7\xF5es demais para uma importa\xE7\xE3o at\xF4mica segura. Reduza o arquivo antes de tentar novamente."
        },
        413
      );
    }
    if (isAgendaConflict(error)) {
      return c.json(
        {
          error: "AGENDAS_JA_EXISTEM",
          message: "J\xE1 existem agendas para uma ou mais lojas e datas do arquivo."
        },
        409
      );
    }
    console.error("Agenda batch import failed", error);
    return c.json(
      {
        error: "IMPORTACAO_FALHOU",
        message: "O lote n\xE3o foi importado. Nenhuma altera\xE7\xE3o parcial foi mantida."
      },
      500
    );
  }
});
adminAgendaRoutes.get("/today", async (c) => {
  const agendas = await listAdminAgendas(c.env.DB, {
    date: currentBusinessDate()
  });
  return c.json(agendas.map(agendaSummaryJson));
});
const AgendaFilters = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storeCode: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()).optional()
});
adminAgendaRoutes.get("/", async (c) => {
  const parsed = AgendaFilters.safeParse({
    date: c.req.query("date") || void 0,
    storeCode: c.req.query("storeCode") || void 0
  });
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Filtros inv\xE1lidos." },
      400
    );
  }
  const agendas = await listAdminAgendas(c.env.DB, parsed.data);
  return c.json(agendas.map(agendaSummaryJson));
});
const AgendaDayStatusInput = z.object({
  status: z.enum(["aberto", "concluido"])
});
adminAgendaRoutes.patch("/:id/status", async (c) => {
  const parsed = AgendaDayStatusInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status do dia inv\xE1lido." },
      400
    );
  }
  const agenda = await findAgendaById(c.env.DB, c.req.param("id"));
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  const user = c.get("authUser");
  try {
    const updated = await changeAgendaDayStatus(
      c.env.DB,
      agenda,
      user.id,
      parsed.data.status
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "day-status"
    });
    return c.json(agendaJson(updated));
  } catch (error) {
    console.error("Agenda day status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_DIA_FALHOU",
        message: "N\xE3o foi poss\xEDvel alterar o status do dia."
      },
      500
    );
  }
});
adminAgendaRoutes.get("/:id/history", async (c) => {
  const agenda = await findAgendaById(c.env.DB, c.req.param("id"));
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  const history = await listAgendaHistory(c.env.DB, agenda.id);
  return c.json(
    history.map((item) => ({
      id: item.id,
      action: item.acao,
      details: item.detalhes,
      changedAt: item.alterado_em,
      user: item.usuario_id ? { id: item.usuario_id, name: item.usuario_nome ?? "Usu\xE1rio" } : null
    }))
  );
});
adminAgendaRoutes.post("/:id/manual", async (c) => {
  const parsed = z.object({
    supplier: z.string().trim().min(1).max(160)
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Informe o nome do fornecedor." },
      400
    );
  }
  const agenda = await findAgendaById(c.env.DB, c.req.param("id"));
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  try {
    const user = c.get("authUser");
    const appointment = await createManualAppointment(
      c.env.DB,
      agenda,
      user.id,
      parsed.data.supplier,
      businessTime(/* @__PURE__ */ new Date()),
      agenda.status_dia === "concluido" ? `Fornecedor manual ${parsed.data.supplier} adicionado pelo administrador.` : void 0
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.json(appointmentJson(appointment), 201);
  } catch (error) {
    console.error("Admin manual supplier creation failed", error);
    return c.json(
      {
        error: "FORNECEDOR_MANUAL_NAO_CRIADO",
        message: "N\xE3o foi poss\xEDvel adicionar o fornecedor."
      },
      500
    );
  }
});
adminAgendaRoutes.get("/:id", async (c) => {
  const result = await details(c.env.DB, c.req.param("id"));
  if (!result) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  return c.json(result);
});
const AdminAppointmentStatusInput = z.object({
  status: z.enum(["aguardando", "recebido", "nao_chegou", "recusado"]),
  observation: z.string().max(250).nullable().optional()
});
const AdminObservationInput = z.object({ observation: z.string().max(250).nullable() });
const AdminAppointmentExchangesInput = z.object({
  hasExchanges: z.boolean()
});
adminAppointmentRoutes.patch("/:id/manual", async (c) => {
  const parsed = z.object({
    supplier: z.string().trim().min(1).max(160)
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Informe o nome do fornecedor." },
      400
    );
  }
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment || appointment.origem !== "manual" || appointment.ativo !== 1) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  try {
    const user = c.get("authUser");
    const updated = await updateManualAppointmentSupplier(
      c.env.DB,
      agenda,
      appointment,
      user.id,
      parsed.data.supplier,
      agenda.status_dia === "concluido" ? `Fornecedor manual alterado de ${appointment.fornecedor} para ${parsed.data.supplier}.` : void 0
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin manual supplier update failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ATUALIZADO", message: "N\xE3o foi poss\xEDvel editar o fornecedor." },
      500
    );
  }
});
adminAppointmentRoutes.delete("/:id/manual", async (c) => {
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment || appointment.origem !== "manual" || appointment.ativo !== 1) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  try {
    const user = c.get("authUser");
    await softDeleteManualAppointment(
      c.env.DB,
      agenda,
      appointment,
      user.id,
      agenda.status_dia === "concluido" ? `Fornecedor manual ${appointment.fornecedor} removido.` : void 0
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.body(null, 204);
  } catch (error) {
    console.error("Admin manual supplier delete failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_REMOVIDO", message: "N\xE3o foi poss\xEDvel remover o fornecedor." },
      500
    );
  }
});
adminAppointmentRoutes.patch("/:id/observation", async (c) => {
  const parsed = AdminObservationInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "REQUISICAO_INVALIDA", message: "Observação inválida." }, 400);
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment) return c.json({ error: "AGENDAMENTO_NAO_ENCONTRADO", message: "Agendamento não encontrado." }, 404);
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) return c.json({ error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." }, 404);
  let observation;
  try {
    observation = validateStatusObservation(appointment.status, parsed.data.observation);
  } catch (error) {
    return c.json({ error: "MOTIVO_INVALIDO", message: error.message }, 400);
  }
  try {
    const updated = await changeAppointmentStatus(c.env.DB, appointment, c.get("authUser").id, appointment.status, undefined, observation);
    await publishAgendaChanged(c.env, { agendaId: agenda.id, storeId: agenda.loja_id, date: agenda.data_agenda, reason: "observation" });
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin observation update failed", error);
    return c.json({ error: "ALTERACAO_OBSERVACAO_FALHOU", message: "A observação não foi atualizada." }, 500);
  }
});
adminAppointmentRoutes.patch("/:id/status", async (c) => {
  const parsed = AdminAppointmentStatusInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status inv\xE1lido." },
      400
    );
  }
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  let observation;
  try {
    observation = validateStatusObservation(parsed.data.status, parsed.data.observation);
  } catch (error) {
    return c.json({ error: "MOTIVO_INVALIDO", message: error.message }, 400);
  }
  try {
    const user = c.get("authUser");
    const changed = appointment.status !== parsed.data.status;
    const updated = await changeAppointmentStatus(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.status,
      changed ? `Status alterado de ${appointment.status} para ${parsed.data.status}.` : undefined,
      observation
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "status"
    });
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin appointment status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_STATUS_FALHOU",
        message: "O status n\xE3o foi alterado."
      },
      500
    );
  }
});
adminAppointmentRoutes.patch("/:id/exchanges", async (c) => {
  const parsed = AdminAppointmentExchangesInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Valor de trocas inv\xE1lido." },
      400
    );
  }
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  try {
    const user = c.get("authUser");
    const nextValue = parsed.data.hasExchanges ? 1 : 0;
    const changed = appointment.trocas !== nextValue;
    const updated = await changeAppointmentExchanges(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.hasExchanges,
      changed ? `Trocas alteradas para ${parsed.data.hasExchanges ? "sim" : "n\xE3o"}.` : void 0
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "exchanges"
    });
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin appointment exchanges change failed", error);
    return c.json(
      {
        error: "ALTERACAO_TROCAS_FALHOU",
        message: "A marca\xE7\xE3o de trocas n\xE3o foi alterada."
      },
      500
    );
  }
});
adminAppointmentRoutes.get("/:id/history", async (c) => {
  const appointmentId = c.req.param("id");
  const appointment = await findAppointmentById(c.env.DB, appointmentId);
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const history = await listAppointmentHistory(c.env.DB, appointmentId);
  return c.json(
    history.map((item) => ({
      id: item.id,
      appointmentId: item.agendamento_id,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      observation: item.observacao ?? null,
      alteradoEm: item.alterado_em,
      usuario: {
        id: item.usuario_id,
        nome: item.usuario_nome
      }
    }))
  );
});
export {
  adminAgendaRoutes,
  adminAppointmentRoutes
};