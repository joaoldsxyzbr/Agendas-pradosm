import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { summarySchema } from "@/features/receiving/model";
import {
  changeAppointmentExchanges, changeAppointmentStatus, getAgendaDetail, getStores,
  reopenAgenda, type AppointmentStatus,
} from "@/features/receiving/api";

// Reexporta o contrato já migrado do Recebimento: a tela de Histórico consome
// exatamente os mesmos endpoints administrativos, sem duplicar regra de negócio.
export { changeAppointmentExchanges, changeAppointmentStatus, getAgendaDetail, getStores, reopenAgenda };
export type { AppointmentStatus };

const dayEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  details: z.string().nullable().optional(),
  changedAt: z.string(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
});

const statusEventSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  statusAnterior: z.string(),
  statusNovo: z.string(),
  observation: z.string().nullable(),
  alteradoEm: z.string(),
  usuario: z.object({ id: z.string().nullable(), nome: z.string() }),
});

export type DayEvent = z.infer<typeof dayEventSchema>;
export type StatusEvent = z.infer<typeof statusEventSchema>;
export type HistorySummary = z.infer<typeof summarySchema>;

export const historyAgendasKey = ["admin", "history", "agendas"] as const;
export const historyDetailKey = ["admin", "history", "agenda"] as const;
export const historyDayEventsKey = ["admin", "history", "day-events"] as const;
export const historyStatusEventsKey = ["admin", "history", "status-events"] as const;

export async function listHistoryAgendas(storeCode: string, date: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (storeCode) params.set("storeCode", storeCode);
  const query = params.toString();
  return z.array(summarySchema).parse(await apiFetch<unknown>(
    query ? `/api/admin/agendas?${query}` : "/api/admin/agendas",
  ));
}

export async function listDayEvents(agendaId: string) {
  return z.array(dayEventSchema).parse(await apiFetch<unknown>(
    `/api/admin/agendas/${encodeURIComponent(agendaId)}/history`,
  ));
}

export async function listStatusEvents(appointmentId: string) {
  return z.array(statusEventSchema).parse(await apiFetch<unknown>(
    `/api/admin/appointments/${encodeURIComponent(appointmentId)}/history`,
  ));
}
