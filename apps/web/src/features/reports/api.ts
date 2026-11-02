import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { getStores } from "@/features/receiving/api";
import { latestSchema, occurrencesSchema, reportParams, reportSchema, type ReportFilters } from "./model";

export { getStores };
export async function getReport(filters: Pick<ReportFilters, "start" | "end" | "stores">) {
  return reportSchema.parse(await apiFetch<unknown>("/api/admin/reports?" + reportParams(filters)));
}
export async function getLatest(filters: ReportFilters, offset: number) {
  const params = reportParams(filters);
  params.set("limit", "50");
  params.set("offset", String(offset));
  return latestSchema.parse(await apiFetch<unknown>("/api/admin/reports/latest?" + params));
}
export async function getOccurrences(filters: ReportFilters, offset: number, query: string) {
  const params = reportParams(filters);
  params.set("limit", "50");
  params.set("offset", String(offset));
  if (query) params.set("q", query);
  return occurrencesSchema.parse(await apiFetch<unknown>("/api/admin/reports/occurrences?" + params));
}
export const storeFilterSchema = z.array(z.object({ codigo: z.string(), nome: z.string(), ativo: z.boolean() }));
