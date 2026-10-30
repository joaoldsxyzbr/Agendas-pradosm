import { apiFetch } from "@/lib/api";
import { z } from "zod";
import {
  storeSchema, summarySchema, presenceSchema, detailSchema,
} from "./model";

export async function getStores() {
  return z.array(storeSchema).parse(await apiFetch<unknown>("/api/admin/stores"));
}
export async function getAgendas(date: string) {
  return z.array(summarySchema).parse(await apiFetch<unknown>(
    `/api/admin/agendas?date=${encodeURIComponent(date)}`,
  ));
}
export async function getPresence() {
  return z.array(presenceSchema).parse(await apiFetch<unknown>("/api/admin/presence"));
}
export async function getAgendaDetail(id: string) {
  return detailSchema.parse(await apiFetch<unknown>(
    `/api/admin/agendas/${encodeURIComponent(id)}`,
  ));
}

/** Mutations administrativas existentes no Worker; validação e auditoria continuam no servidor. */
export async function reopenAgenda(id: string) {
  return apiFetch<unknown>(`/api/admin/agendas/${encodeURIComponent(id)}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "aberto" }),
  });
}
export async function addManualSupplier(agendaId: string, supplier: string) {
  return apiFetch<unknown>(`/api/admin/agendas/${encodeURIComponent(agendaId)}/manual`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplier }),
  });
}
export async function renameManualSupplier(appointmentId: string, supplier: string) {
  return apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(appointmentId)}/manual`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplier }),
  });
}
export async function deleteManualSupplier(appointmentId: string) {
  return apiFetch<void>(`/api/admin/appointments/${encodeURIComponent(appointmentId)}/manual`, {
    method: "DELETE",
  });
}
