import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthUser } from "../../shared/auth";
import type { AppEnv } from "../env";
import { businessDate } from "../lib/time";
import {
  changeAppointmentStatus,
  findAppointmentForStore,
  findStoreAgendaByDate,
  listAppointmentHistory,
  listAppointmentsByAgenda,
  listStoreAgendas,
  type AgendaSummaryRecord,
  type AgendaWithStoreRecord,
  type AppointmentRecord,
} from "../repositories/agendas";

export const storeAgendaRoutes = new Hono<AppEnv>();
export const storeAppointmentRoutes = new Hono<AppEnv>();

const ChangeStatusInput = z.object({
  status: z.enum(["recebido", "nao_chegou", "recusado", "aguardando"]),
});

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type StoreAuthUser = AuthUser & {
  perfil: "loja";
  lojaId: string;
};

function storeUser(c: Context<AppEnv>): StoreAuthUser | null {
  const user = c.get("authUser");
  if (user.perfil !== "loja" || !user.lojaId) return null;

  return {
    ...user,
    perfil: "loja",
    lojaId: user.lojaId,
  };
}

function forbidden(c: Context<AppEnv>) {
  return c.json(
    { error: "ACESSO_NEGADO", message: "Acesso não permitido." },
    403,
  );
}

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
  return {
    id: appointment.id,
    protocol: appointment.protocolo,
    startTime: appointment.horario_inicio,
    endTime: appointment.horario_fim,
    supplier: appointment.fornecedor,
    items: appointment.itens,
    volumes: appointment.volumes,
    pallets: appointment.paletes,
    cargaBatida: appointment.carga_batida,
    type: appointment.tipo,
    nfe: parseStringArray(appointment.nfe),
    orders: parseStringArray(appointment.pedidos),
    status: appointment.status,
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
    createdAt: agenda.criado_em,
    updatedAt: agenda.atualizado_em,
  };
}

function summaryJson(agenda: AgendaSummaryRecord) {
  return {
    ...agendaJson(agenda),
    total: Number(agenda.total ?? 0),
    aguardando: Number(agenda.aguardando ?? 0),
    recebido: Number(agenda.recebido ?? 0),
    naoChegou: Number(agenda.nao_chegou ?? 0),
    recusado: Number(agenda.recusado ?? 0),
  };
}

async function agendaDetails(
  db: D1Database,
  storeId: string,
  date: string,
) {
  const agenda = await findStoreAgendaByDate(db, storeId, date);
  if (!agenda) return null;

  const appointments = await listAppointmentsByAgenda(db, agenda.id);
  return {
    agenda: agendaJson(agenda),
    appointments: appointments.map(appointmentJson),
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
      { error: "REQUISICAO_INVALIDA", message: "Data inválida." },
      400,
    );
  }

  const result = await agendaDetails(c.env.DB, user.lojaId, parsed.data);
  if (!result) {
    return c.json(
      { error: "AGENDA_NAO_ENCONTRADA", message: "Agenda não encontrada." },
      404,
    );
  }

  return c.json(result);
});

storeAppointmentRoutes.get("/:id", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);

  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId,
  );

  if (!appointment) {
    return c.json(
      {
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      },
      404,
    );
  }

  const history = await listAppointmentHistory(c.env.DB, appointment.id);
  return c.json({
    ...appointmentJson(appointment),
    history: history.map((item) => ({
      id: item.id,
      statusAnterior: item.status_anterior,
      statusNovo: item.status_novo,
      alteradoEm: item.alterado_em,
      usuario: {
        id: item.usuario_id,
        nome: item.usuario_nome,
      },
    })),
  });
});

storeAppointmentRoutes.patch("/:id/status", async (c) => {
  const user = storeUser(c);
  if (!user) return forbidden(c);

  const parsed = ChangeStatusInput.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: "REQUISICAO_INVALIDA", message: "Status inválido." },
      400,
    );
  }

  const appointment = await findAppointmentForStore(
    c.env.DB,
    c.req.param("id"),
    user.lojaId,
  );

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
    const updated = await changeAppointmentStatus(
      c.env.DB,
      appointment,
      user.id,
      parsed.data.status,
    );
    return c.json(appointmentJson(updated));
  } catch (error) {
    console.error("Appointment status change failed", error);
    return c.json(
      {
        error: "ALTERACAO_STATUS_FALHOU",
        message: "O status não foi alterado.",
      },
      500,
    );
  }
});
