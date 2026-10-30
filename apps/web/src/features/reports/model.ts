import { z } from "zod";
import { businessToday, shiftDay } from "@/features/receiving/model";

const integer = z.number().finite();
export const reportRowSchema = z.object({
  date: z.string(), storeCode: z.string(), storeName: z.string(),
  dayStatus: z.string(), total: integer, recebido: integer, naoChegou: integer,
  naoCompareceu: integer, aguardando: integer, recusado: integer, semAgenda: integer,
});
const supplierSchema = z.object({
  supplier: z.string(), total: integer, recebido: integer, naoChegou: integer,
});
export const reportSchema = z.object({
  start: z.string(), end: z.string(), storeCodes: z.array(z.string()),
  rows: z.array(reportRowSchema), suppliers: z.array(supplierSchema),
});
const occurrenceSchema = z.object({
  date: z.string(), storeCode: z.string(), storeName: z.string(),
  supplier: z.string(), protocol: z.string(), observation: z.string().nullable(),
  origin: z.string(), occurrenceType: z.enum(["nao_compareceu", "nao_recebido"]),
  classificationOrigin: z.string(),
});
export const occurrencesSchema = z.object({
  total: integer, offset: integer, limit: integer, rows: z.array(occurrenceSchema),
});
const latestRowSchema = z.object({
  date: z.string(), storeCode: z.string(), time: z.string().nullable(),
  supplier: z.string(), status: z.string(),
});
export const latestSchema = z.object({
  total: integer, offset: integer, limit: integer, rows: z.array(latestRowSchema),
});
export type Report = z.infer<typeof reportSchema>;
export type ReportRow = z.infer<typeof reportRowSchema>;
export type Occurrences = z.infer<typeof occurrencesSchema>;
export type Latest = z.infer<typeof latestSchema>;
export type ReportFilters = { start: string; end: string; stores: string[]; compare: boolean };

export const numberBR = (value: number) => value.toLocaleString("pt-BR");
export const percentBR = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
export const rate = (row: { recebido: number; total: number }) => row.total ? row.recebido / row.total * 100 : 0;
export const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const METRICS = ["total", "recebido", "naoChegou", "naoCompareceu", "aguardando", "recusado", "semAgenda"] as const;
type Metric = typeof METRICS[number];
export type Totals = Record<Metric, number> & { agendas: number; abertas: number };
export function totals(rows: ReportRow[]): Totals {
  const result: Totals = { total: 0, recebido: 0, naoChegou: 0, naoCompareceu: 0, aguardando: 0, recusado: 0, semAgenda: 0, agendas: 0, abertas: 0 };
  for (const row of rows) {
    for (const key of METRICS) result[key] += row[key];
    result.agendas++;
    if (row.dayStatus === "aberto") result.abertas++;
  }
  return result;
}
export type Grouped = { key: string; label: string } & Record<Metric, number>;
export function group(rows: ReportRow[], kind: "date" | "store"): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const row of rows) {
    const key = kind === "date" ? row.date : row.storeCode;
    const current = map.get(key) ?? {
      key, label: kind === "date" ? row.date : row.storeCode + " · " + row.storeName,
      total: 0, recebido: 0, naoChegou: 0, naoCompareceu: 0, aguardando: 0, recusado: 0, semAgenda: 0,
    };
    for (const metric of METRICS) current[metric] += row[metric];
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => kind === "date"
    ? a.key.localeCompare(b.key)
    : b.total - a.total || a.key.localeCompare(b.key, "pt-BR", { numeric: true }));
}
export function validRange(start: string, end: string): boolean {
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day + "T00:00:00Z")) &&
    new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day;
  if (!valid(start) || !valid(end)) return false;
  const days = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000;
  return days >= 0 && days < 93;
}
export function initialFilters(now = new Date()): ReportFilters {
  const end = businessToday(now);
  return { start: shiftDay(end, -29), end, stores: [], compare: true };
}
export function presetRange(period: "7" | "30" | "90" | "month", today = businessToday()) {
  return { start: period === "month" ? today.slice(0, 8) + "01" : shiftDay(today, 1 - Number(period)), end: today };
}
export function previousRange({ start, end }: Pick<ReportFilters, "start" | "end">) {
  const days = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000 + 1;
  return { start: shiftDay(start, -days), end: shiftDay(start, -1) };
}
export function reportParams({ start, end, stores }: Pick<ReportFilters, "start" | "end" | "stores">) {
  const params = new URLSearchParams({ start, end });
  for (const store of stores) params.append("storeCode", store);
  return params;
}
