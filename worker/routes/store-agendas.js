import { normalizeObservation, validateStatusObservation } from "../../shared/observations.js";
import { Hono } from "hono";
import { z } from "zod";
import { businessDate, businessTime } from "../lib/time.js";
import { publishAgendaChanged } from "../services/realtime.js";
import {
  changeAgendaDayStatus,
  changeAppointmentExchanges,
  changeAppointmentStatus,
  createManualAppointment,
  findAgendaById,
  findAppointmentForStore,
  findStoreAgendaByDate,
  listAppointmentHistory,
  listAppointmentsByAgenda,
  listStoreAgendas,
  softDeleteManualAppointment,
  updateManualAppointmentSupplier
} from "../repositories/agendas.js";
const storeAgendaRoutes = new Hono();
const storeAppointmentRoutes = new Hono();
const ChangeStatusInput = z.object({
  status: z.enum(["aguardando", "recebido", "nao_chegou", "recusado"]),
  observation: z.string().max(250).nullable().optional()
});
const ChangeObservationInput = z.object({ observation: z.string().max(250).nullable() });
const ChangeExchangesInput = z.object({
  hasExchanges: z.boolean()
});
const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ManualAppointmentInput = z.object({
  supplier: z.string().trim().min(1).max(160)
});
function storeUser(c) {
  const user = c.get("authUser");
  if (user.papel !== "conferente" || !user.lojaId) return null;
  return {
    ...user,
    papel: "conferente",
    lojaId: user.lojaId
  };
}
function forbidden(c) {
  return c.json(
    { error: "ACESSO_NEGADO", message: "Acesso n\xE3o permitido." },
    403
  );
}
function conflictResponse(c, error) {
  return error?.code === "CONFLITO_ESTADO"
    ? c.json({ error: "CONFLITO_ESTADO", message: "Este registro mudou. Atualize a tela e tente novamente." }, 409)
    : null;
}
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
    createdAt: agenda.criado_em,
    updatedAt: agenda.atualizado_em
  };
}
function summaryJson(agenda) {
  return {
    ...agendaJson(agenda),
    total: Number(agenda.total ?? 0),
    aguardando: Number(agenda.aguardando ?? 0),
    recebido: Number(agenda.recebido ?? 0),
    naoChegou: Number(agenda.nao_chegou ?? 0),
    recusado: Number(agenda.recusado ?? 0)
  };
}
async function agendaDetails(db, storeId, date) {
  const agenda = await findStoreAgendaByDate(db, storeId, date);
  if (!agenda) return null;
  const appointments = await listAppointmentsByAgenda(db, agenda.id);
  return {
    agenda: agendaJson(agenda),
    appointments: appointments.map(appointmentJson)
  };
}
storeAgendaRoutes.get("/today", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const result = await agendaDetails(c.env.DB, user.lojaId, businessDate());
  if (!result) {
    return c.json({ agenda: null, appointments: [] });
  }
  return c.json(result);
});
async function createManualForDate(c, user, date) {
  const parsed = ManualAppointmentInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      {
        error: "REQUISICAO_INVALIDA",
        message: "Informe o nome do fornecedor."
      },
      400
    );
  }
  const agenda = await findStoreAgendaByDate(c.env.DB, user.lojaId, date);
  if (!agenda) {
    return c.json(
      {
        error: "AGENDA_NAO_DISPONIVEL",
        message: "N\xE3o existe agenda importada para esta data."
      },
      409
    );
  }
  if (agenda.status_dia === "concluido") {
    return c.json(
      {
        error: "DIA_CONCLUIDO",
        message: "Este dia est\xE1 conclu\xEDdo e n\xE3o pode mais ser alterado."
      },
      409
    );
  }
  try {
    const appointment = await createManualAppointment(
      c.env.DB,
      agenda,
      user.id,
      parsed.data.supplier,
      businessTime(/* @__PURE__ */ new Date())
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.json(appointmentJson(appointment), 201);
  } catch (error) {
    console.error("Manual supplier creation failed", error);
    return c.json(
      {
        error: "FORNECEDOR_MANUAL_NAO_CRIADO",
        message: "N\xE3o foi poss\xEDvel adicionar o fornecedor."
      },
      500
    );
  }
}
storeAgendaRoutes.post("/today/manual", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  return createManualForDate(c, user, businessDate());
});
storeAgendaRoutes.post("/agenda/:date/manual", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsedDate = DateParam.safeParse(c.req.param("date"));
  if (!parsedDate.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Data inv\xE1lida." },
      400
    );
  }
  return createManualForDate(c, user, parsedDate.data);
});
storeAgendaRoutes.post("/agenda/:date/complete", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = DateParam.safeParse(c.req.param("date"));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Data inv\xE1lida." },
      400
    );
  }
  const agenda = await findStoreAgendaByDate(c.env.DB, user.lojaId, parsed.data);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  try {
    const updated = await changeAgendaDayStatus(
      c.env.DB,
      agenda,
      user.id,
      "concluido"
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "day-status"
    });
    return c.json(agendaJson(updated));
  } catch (error) {
    const conflict = conflictResponse(c, error);
    if (conflict) return conflict;
    console.error("Agenda completion failed", error);
    return c.json(
      {
        error: "CONCLUSAO_DIA_FALHOU",
        message: "N\xE3o foi poss\xEDvel concluir o dia."
      },
      500
    );
  }
});
storeAgendaRoutes.get("/history", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const agendas = await listStoreAgendas(c.env.DB, user.lojaId);
  return c.json(agendas.map(summaryJson));
});
storeAgendaRoutes.get("/history/:date", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = DateParam.safeParse(c.req.param("date"));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Data inv\xE1lida." },
      400
    );
  }
  const result = await agendaDetails(c.env.DB, user.lojaId, parsed.data);
  if (!result) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda n\xE3o encontrada." },
      404
    );
  }
  return c.json(result);
});
async function editableAgendaForAppointment(db, appointment) {
  const agenda = await findAgendaById(db, appointment.agenda_id);
  return agenda?.status_dia === "aberto" ? agenda : null;
}
function concludedDay(c) {
  return c.json(
    {
      error: "DIA_CONCLUIDO",
      message: "Este dia est\xE1 conclu\xEDdo e n\xE3o pode mais ser alterado."
    },
    409
  );
}
storeAppointmentRoutes.get("/:id", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId
  );
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const history = await listAppointmentHistory(c.env.DB, appointment.id);
  return c.json({
    ...appointmentJson(appointment),
    history: history.map((item) => ({
      id: item.id,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      observation: item.observacao ?? null,
      alteradoEm: item.alterado_em,
      usuario: {
        id: item.usuario_id,
        nome: item.usuario_nome ?? (item.usuario_id ? "Usuário" : "Sistema")
      }
    }))
  });
});
storeAppointmentRoutes.patch("/:id/manual", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = ManualAppointmentInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Informe o nome do fornecedor." },
      400
    );
  }
  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId
  );
  if (!appointment || appointment.origem !== "manual") {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda || agenda.loja_id !== user.lojaId) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  if (agenda.status_dia === "concluido") return concludedDay(c);
  try {
    const updated = await updateManualAppointmentSupplier(
      c.env.DB,
      agenda,
      appointment,
      user.id,
      parsed.data.supplier
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Manual supplier update failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ATUALIZADO", message: "N\xE3o foi poss\xEDvel editar o fornecedor." },
      500
    );
  }
});
storeAppointmentRoutes.delete("/:id/manual", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId
  );
  if (!appointment || appointment.origem !== "manual") {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda || agenda.loja_id !== user.lojaId) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda n\xE3o encontrado." },
      404
    );
  }
  if (agenda.status_dia === "concluido") return concludedDay(c);
  try {
    await softDeleteManualAppointment(c.env.DB, agenda, appointment, user.id);
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "manual"
    });
    return c.body(null, 204);
  } catch (error) {
    console.error("Manual supplier delete failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_REMOVIDO", message: "N\xE3o foi poss\xEDvel remover o fornecedor." },
      500
    );
  }
});
storeAppointmentRoutes.patch("/:id/exchanges", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = ChangeExchangesInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Valor de trocas inv\xE1lido." },
      400
    );
  }
  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId
  );
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const agenda = await editableAgendaForAppointment(c.env.DB, appointment);
  if (!agenda) {
    return concludedDay(c);
  }
  try {
    const updated = await changeAppointmentExchanges(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.hasExchanges
    );
    await publishAgendaChanged(c.env, {
      agendaId: agenda.id,
      storeId: agenda.loja_id,
      date: agenda.data_agenda,
      reason: "exchanges"
    });
    return c.json(appointmentJson(updated));
  } catch (error) {
    const conflict = conflictResponse(c, error);
    if (conflict) return conflict;
    console.error("Appointment exchanges change failed", error);
    return c.json(
      {
        error: "ALTERACAO_TROCAS_FALHOU",
        message: "A marca\xE7\xE3o de trocas n\xE3o foi alterada."
      },
      500
    );
  }
});
storeAppointmentRoutes.patch("/:id/observation", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = ChangeObservationInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "REQUISICAO_INVALIDA", message: "Observação inválida." }, 400);
  const appointment = await findAppointmentForStore(c.env.DB, c.req.param("id"), user.lojaId);
  if (!appointment) return c.json({ error: "AGENDAMENTO_NAO_ENCONTRADO", message: "Agendamento não encontrado." }, 404);
  const agenda = await editableAgendaForAppointment(c.env.DB, appointment);
  if (!agenda) return concludedDay(c);
  let observation;
  try {
    observation = validateStatusObservation(appointment.status, parsed.data.observation);
  } catch (error) {
    return c.json({ error: "MOTIVO_INVALIDO", message: error.message }, 400);
  }
  try {
    const updated = await changeAppointmentStatus(c.env.DB, appointment, user.id, appointment.status, undefined, observation);
    await publishAgendaChanged(c.env, { agendaId: agenda.id, storeId: agenda.loja_id, date: agenda.data_agenda, reason: "observation" });
    return c.json(appointmentJson(updated));
  } catch (error) {
    const conflict = conflictResponse(c, error);
    if (conflict) return conflict;
    console.error("Appointment observation change failed", error);
    return c.json({ error: "ALTERACAO_OBSERVACAO_FALHOU", message: "A observação não foi atualizada." }, 500);
  }
});
storeAppointmentRoutes.patch("/:id/status", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);
  const parsed = ChangeStatusInput.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status inv\xE1lido." },
      400
    );
  }
  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId
  );
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento n\xE3o encontrado."
      },
      404
    );
  }
  const agenda = await editableAgendaForAppointment(c.env.DB, appointment);
  if (!agenda) {
    return concludedDay(c);
  }
  let observation;
  try {
    observation = parsed.data.status === "nao_chegou"
      ? validateStatusObservation(parsed.data.status, parsed.data.observation)
      : normalizeObservation(parsed.data.observation);
  } catch (error) {
    return c.json({ error: "MOTIVO_INVALIDO", message: error.message }, 400);
  }
  try {
    const updated = await changeAppointmentStatus(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.status,
      undefined,
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
    const conflict = conflictResponse(c, error);
    if (conflict) return conflict;
    console.error("Appointment status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_STATUS_FALHOU",
        message: "O status n\xE3o foi alterado."
      },
      500
    );
  }
});
export {
  storeAgendaRoutes,
  storeAppointmentRoutes
};