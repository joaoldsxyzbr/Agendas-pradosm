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
