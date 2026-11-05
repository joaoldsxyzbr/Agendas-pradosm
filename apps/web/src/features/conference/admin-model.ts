import { apiFetch } from "@/lib/api";
import {
  storeAgenda, storeAppointment, storeAppointmentDetail,
  type StoreAppointment,
} from "./model";

// Mesmo contrato da tela de Conferência, servido pelos endpoints administrativos
// (auditoria e validação no Worker). O popup "Ver detalhes" do admin reutiliza a
// tela de conferência apontando para a agenda da loja selecionada.
const patchJson = (body: Record<string, unknown>) => ({
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const postJson = (body: Record<string, unknown>) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function loadAdminAgenda(agendaId: string) {
  return storeAgenda.parse(await apiFetch<unknown>(`/api/admin/agendas/${encodeURIComponent(agendaId)}`));
}
export async function patchAdminStatus(id: string, status: StoreAppointment["status"], observation: string | null = null) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/status`, patchJson({ status, observation })));
}
export async function patchAdminExchanges(id: string, hasExchanges: boolean) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/exchanges`, patchJson({ hasExchanges })));
}
export async function patchAdminObservation(id: string, observation: string | null) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/observation`, patchJson({ observation })));
}
export async function patchAdminManual(id: string, supplier: string) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/manual`, patchJson({ supplier })));
}
export async function deleteAdminManual(id: string) {
  await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}/manual`, { method: "DELETE" });
}
export async function createAdminManual(agendaId: string, supplier: string) {
  return storeAppointment.parse(await apiFetch<unknown>(`/api/admin/agendas/${encodeURIComponent(agendaId)}/manual`, postJson({ supplier })));
}
export async function getAdminAppointmentDetail(id: string) {
  return storeAppointmentDetail.parse(await apiFetch<unknown>(`/api/admin/appointments/${encodeURIComponent(id)}`));
}
export async function reopenAdminAgenda(agendaId: string) {
  return apiFetch<unknown>(`/api/admin/agendas/${encodeURIComponent(agendaId)}/status`, patchJson({ status: "aberto" }));
}
