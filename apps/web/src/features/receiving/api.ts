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

/** A regra do motivo obrigatório permanece no Worker; o formulário segue o contrato legado. */
export type AppointmentStatus = "aguardando" | "recebido" | "nao_chegou" | "recusado";
export async function changeAppointmentStatus(id: string, status: AppointmentStatus, observation: string | null = null) {
  return apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, observation }),
  });
}
export async function changeAppointmentExchanges(id: string, hasExchanges: boolean) {
  return apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/exchanges`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hasExchanges }),
  });
}
