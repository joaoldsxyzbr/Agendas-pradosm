import { Hono } from "hono";
import { z } from "zod";
import { ImportAgendaInput } from "../../shared/agenda";
import type { AppEnv } from "../env";
import {
  changeAgendaDayStatus,
  changeAppointmentExchanges,
  changeAppointmentStatus,
  createAgendaImport,
  findAgendaById,
  findAgendaByStoreDate,
  findAppointmentById,
  findStoreByCode,
  listAdminAgendas,
  listAgendaHistory,
  listAppointmentHistory,
  listAppointmentsByAgenda,
  recordAgendaAdminAdjustment,
  replaceAgendaImport,
  softDeleteManualAppointment,
  updateManualAppointmentSupplier,
  type AgendaSummaryRecord,
  type AgendaWithStoreRecord,
  type AppointmentRecord,
} from "../repositories/agendas";

export const adminAgendaRoutes = new Hono<AppEnv>();
export const adminAppointmentRoutes = new Hono<AppEnv>();

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function appointmentJson(appointment: AppointmentRecord) {
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
    origin: manual ? "manual" : "imported",
    ativo: appointment.ativo === 1,
  };
}

function agendaJson(agenda: AgendaWithStoreRecord) {
  return {
    id: agenda.id,
    storeId: agenda.loja_id,
    storeCode: agenda.store_code,
    storeName: agenda.store_name,
    date: agenda.data_agenda,
    originalFileName: agenda.arquivo_original,
    dayStatus: agenda.status_dia,
    completedAt: agenda.concluido_em,
    completedBy: agenda.concluido_por
      ? { id: agenda.concluido_por, name: agenda.concluido_por_nome }
      : null,
    createdBy: agenda.criado_por,
    createdAt: agenda.criado_em,
    updatedAt: agenda.atualizado_em,
  };
}

function agendaSummaryJson(agenda: AgendaSummaryRecord) {
  return {
    ...agendaJson(agenda),
    total: Number(agenda.total ?? 0),
    aguardando: Number(agenda.aguardando ?? 0),
    recebido: Number(agenda.recebido ?? 0),
    naoChegou: Number(agenda.nao_chegou ?? 0),
    recusado: Number(agenda.recusado ?? 0),
    semAgenda: Number(agenda.sem_agenda ?? 0),
  };
}

async function details(db: D1Database, agendaId: string) {
  const agenda = await findAgendaById(db, agendaId);
  if (!agenda) return null;

  const appointments = await listAppointmentsByAgenda(db, agendaId);
  return {
    agenda: agendaJson(agenda),
    appointments: appointments.map(appointmentJson),
  };
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isAgendaConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      "UNIQUE constraint failed: agendas.loja_id, agendas.data_agenda",
    )
  );
}

adminAgendaRoutes.post("/import", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ImportAgendaInput.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Dados da agenda inválidos." },
      400,
    );
  }

  const store = await findStoreByCode(c.env.DB, parsed.data.storeCode);
  if (!store) {
    return c.json(
      {
        error: "LOJA_NAO_ENCONTRADA",
        message: "A loja informada não está cadastrada ou está inativa.",
      },
      422,
    );
  }

  const user = c.get("authUser");
  const existing = await findAgendaByStoreDate(
    c.env.DB,
    store.id,
    parsed.data.date,
  );

  if (existing && !parsed.data.replace) {
    return c.json(
      {
        error: "AGENDA_JA_EXISTE",
        message: "Já existe uma agenda para esta loja e data.",
        agendaId: existing.id,
      },
      409,
    );
  }

  try {
    let agendaId: string;

    if (existing) {
      await replaceAgendaImport(c.env.DB, existing, user.id, parsed.data);
      agendaId = existing.id;
    } else {
      agendaId = await createAgendaImport(
        c.env.DB,
        store.id,
        user.id,
        parsed.data,
      );
    }

    const result = await details(c.env.DB, agendaId);
    if (!result) {
      throw new Error("Agenda gravada não pôde ser relida.");
    }

    return c.json(result, existing ? 200 : 201);
  } catch (error) {
    if (isAgendaConflict(error)) {
      return c.json(
        {
          error: "AGENDA_JA_EXISTE",
          message: "Já existe uma agenda para esta loja e data.",
        },
        409,
      );
    }

    console.error("Agenda import failed", error);
    return c.json(
      {
        error: "IMPORTACAO_FALHOU",
        message: "A agenda não foi importada. Nenhuma alteração parcial foi mantida.",
      },
      500,
    );
  }
});

adminAgendaRoutes.get("/today", async (c) => {
  const agendas = await listAdminAgendas(c.env.DB, {
    date: currentBusinessDate(),
  });
  return c.json(agendas.map(agendaSummaryJson));
});

const AgendaFilters = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storeCode: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase())
    .optional(),
});

adminAgendaRoutes.get("/", async (c) => {
  const parsed = AgendaFilters.safeParse({
    date: c.req.query("date") || undefined,
    storeCode: c.req.query("storeCode") || undefined,
  });

  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Filtros inválidos." },
      400,
    );
  }

  const agendas = await listAdminAgendas(c.env.DB, parsed.data);
  return c.json(agendas.map(agendaSummaryJson));
});

const AgendaDayStatusInput = z.object({
  status: z.enum(["aberto", "concluido"]),
});

adminAgendaRoutes.patch("/:id/status", async (c) => {
  const parsed = AgendaDayStatusInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status do dia inválido." },
      400,
    );
  }

  const agenda = await findAgendaById(c.env.DB, c.req.param("id"));
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
    );
  }

  const user = c.get("authUser");
  try {
    const updated = await changeAgendaDayStatus(
      c.env.DB,
      agenda,
      user.id,
      parsed.data.status,
    );
    return c.json(agendaJson(updated));
  } catch (error) {
    console.error("Agenda day status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_DIA_FALHOU",
        message: "Não foi possível alterar o status do dia.",
      },
      500,
    );
  }
});

adminAgendaRoutes.get("/:id/history", async (c) => {
  const agenda = await findAgendaById(c.env.DB, c.req.param("id"));
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
    );
  }

  const history = await listAgendaHistory(c.env.DB, agenda.id);
  return c.json(
    history.map((item) => ({
      id: item.id,
      action: item.acao,
      details: item.detalhes,
      changedAt: item.alterado_em,
      user: { id: item.usuario_id, name: item.usuario_nome },
    })),
  );
});

adminAgendaRoutes.get("/:id", async (c) => {
  const result = await details(c.env.DB, c.req.param("id"));

  if (!result) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
    );
  }

  return c.json(result);
});

const AdminAppointmentStatusInput = z.object({
  status: z.enum(["aguardando", "recebido", "nao_chegou", "recusado"]),
});

const AdminAppointmentExchangesInput = z.object({
  hasExchanges: z.boolean(),
});

async function recordClosedDayAdjustment(
  db: D1Database,
  appointment: AppointmentRecord,
  userId: string,
  details: string,
) {
  const agenda = await findAgendaById(db, appointment.agenda_id);
  if (agenda?.status_dia === "concluido") {
    await recordAgendaAdminAdjustment(db, agenda.id, userId, details);
  }
}


adminAppointmentRoutes.patch("/:id/manual", async (c) => {
  const parsed = z.object({
    supplier: z.string().trim().min(1).max(160),
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Informe o nome do fornecedor." },
      400,
    );
  }

  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment || appointment.origem !== "manual" || appointment.ativo !== 1) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda não encontrado." },
      404,
    );
  }

  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
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
    );
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin manual supplier update failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ATUALIZADO", message: "Não foi possível editar o fornecedor." },
      500,
    );
  }
});

adminAppointmentRoutes.delete("/:id/manual", async (c) => {
  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment || appointment.origem !== "manual" || appointment.ativo !== 1) {
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_ENCONTRADO", message: "Fornecedor sem agenda não encontrado." },
      404,
    );
  }

  const agenda = await findAgendaById(c.env.DB, appointment.agenda_id);
  if (!agenda) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
    );
  }

  try {
    const user = c.get("authUser");
    await softDeleteManualAppointment(c.env.DB, agenda, appointment, user.id);
    return c.body(null, 204);
  } catch (error) {
    console.error("Admin manual supplier delete failed", error);
    return c.json(
      { error: "FORNECEDOR_MANUAL_NAO_REMOVIDO", message: "Não foi possível remover o fornecedor." },
      500,
    );
  }
});

adminAppointmentRoutes.patch("/:id/status", async (c) => {
  const parsed = AdminAppointmentStatusInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status inválido." },
      400,
    );
  }

  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      },
      404,
    );
  }

  try {
    const user = c.get("authUser");
    const changed = appointment.status !== parsed.data.status;
    const updated = await changeAppointmentStatus(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.status,
    );

    if (changed) {
      await recordClosedDayAdjustment(
        c.env.DB,
        appointment,
        user.id,
        `Status alterado de ${appointment.status} para ${parsed.data.status}.`,
      );
    }

    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin appointment status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_STATUS_FALHOU",
        message: "O status não foi alterado.",
      },
      500,
    );
  }
});

adminAppointmentRoutes.patch("/:id/exchanges", async (c) => {
  const parsed = AdminAppointmentExchangesInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Valor de trocas inválido." },
      400,
    );
  }

  const appointment = await findAppointmentById(c.env.DB, c.req.param("id"));
  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      },
      404,
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
    );

    if (changed) {
      await recordClosedDayAdjustment(
        c.env.DB,
        appointment,
        user.id,
        `Trocas alteradas para ${parsed.data.hasExchanges ? "sim" : "não"}.`,
      );
    }

    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Admin appointment exchanges change failed", error);
    return c.json(
      {
        error: "ALTERACAO_TROCAS_FALHOU",
        message: "A marcação de trocas não foi alterada.",
      },
      500,
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
        message: "Agendamento não encontrado.",
      },
      404,
    );
  }

  const history = await listAppointmentHistory(c.env.DB, appointmentId);
  return c.json(
    history.map((item) => ({
      id: item.id,
      appointmentId: item.agendamento_id,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      alteradoEm: item.alterado_em,
      usuario: {
        id: item.usuario_id,
        nome: item.usuario_nome,
      },
    })),
  );
});
