import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api";
import { businessToday, shiftDay } from "@/features/receiving/model";

export const storeAppointment = z.object({
  id: z.string(), supplier: z.string(), protocol: z.string(),
  startTime: z.string(), endTime: z.string(), type: z.string(),
  status: z.enum(["aguardando", "recebido", "nao_chegou", "recusado"]),
  hasExchanges: z.boolean().default(false),
  observation: z.string().nullable().optional(),
  origin: z.enum(["manual", "imported"]).optional(),
  items: z.string().nullable().optional(),
  volumes: z.string().nullable().optional(),
  pallets: z.string().nullable().optional(),
  cargaBatida: z.string().nullable().optional(),
  nfe: z.array(z.string()).default([]),
  orders: z.array(z.string()).default([]),
});
export const storeAgendaMeta = z.object({
  id: z.string(), storeCode: z.string(), storeName: z.string(),
  date: z.string(), dayStatus: z.enum(["aberto", "concluido"]),
  completedAt: z.string().nullable().optional(),
  completedBy: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
});
export const storeAgenda = z.object({
  agenda: storeAgendaMeta.nullable(),
  appointments: z.array(storeAppointment),
});
export const historyEntry = z.object({
  id: z.string(),
  statusAnterior: z.string(),
  statusNovo: z.string(),
  observation: z.string().nullable().optional(),
  alteradoEm: z.string(),
  usuario: z.object({ id: z.string().nullable().optional(), nome: z.string() }),
});
export const storeAppointmentDetail = storeAppointment.extend({
  history: z.array(historyEntry).default([]),
});
export type StoreAppointment = z.infer<typeof storeAppointment>;
export type StoreAgenda = z.infer<typeof storeAgenda>;
export type StoreAgendaMeta = z.infer<typeof storeAgendaMeta>;
export type StoreAppointmentDetail = z.infer<typeof storeAppointmentDetail>;
export type HistoryEntry = z.infer<typeof historyEntry>;
export const metricValues = (items: StoreAppointment[]) => ({
  total: items.length,
  aguardando: items.filter(i => i.status === "aguardando").length,
  recebido: items.filter(i => i.status === "recebido").length,
  naoChegou: items.filter(i => i.status === "nao_chegou").length,
  trocas: items.filter(i => i.hasExchanges).length,
});
export function filterAppointments(items: StoreAppointment[], text: string) {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalize(text);
  return [...items].sort((a,b) => a.startTime.localeCompare(b.startTime) || a.protocol.localeCompare(b.protocol))
    .filter(item => !query || normalize(item.supplier+" "+item.protocol).includes(query));
}
export function endpointForDate(selected: string, today: string) {
  return selected === today ? "/api/store/today" : `/api/store/history/${encodeURIComponent(selected)}`;
}
export async function loadStoreAgenda(date: string, today: string) {
  try {
    return storeAgenda.parse(await apiFetch<unknown>(endpointForDate(date,today)));
  } catch (error) {
    // A API historica responde 404 para dias sem agenda; /today responde agenda:null.
    if (error instanceof ApiError && error.status === 404) return { agenda:null, appointments:[] } as StoreAgenda;
    throw error;
  }
}
export async function patchStoreStatus(id: string, status: StoreAppointment["status"], observation: string | null = null) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}/status`, {
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ status, observation }),
  }));
}
export async function patchStoreExchanges(id: string, hasExchanges: boolean) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}/exchanges`, {
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({hasExchanges}),
  }));
}
export async function patchStoreObservation(id: string, observation: string | null) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}/observation`, {
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ observation }),
  }));
}
export async function createManualAppointment(date: string, supplier: string) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/store/agenda/${encodeURIComponent(date)}/manual`, {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ supplier }),
  }));
}
export async function patchManualSupplier(id: string, supplier: string) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}/manual`, {
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ supplier }),
  }));
}
export async function deleteManualSupplier(id: string) {
  await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}/manual`, { method:"DELETE" });
}
export async function getStoreAppointmentDetail(id: string) {
  return storeAppointmentDetail.parse(await apiFetch<unknown>(`/api/store/appointments/${encodeURIComponent(id)}`));
}
export async function completeStoreDay(date: string) {
  return apiFetch<unknown>(`/api/store/agenda/${encodeURIComponent(date)}/complete`, {method:"POST"});
}
export { businessToday, shiftDay };
