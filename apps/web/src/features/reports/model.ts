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

export const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export type WeekdayGroup = { weekday: number; total: number; recebido: number; naoChegou: number; days: number };
export function groupWeekday(daily: Grouped[]): WeekdayGroup[] {
  const map = new Map<number, WeekdayGroup>();
  for (const row of daily) {
    const weekday = new Date(row.key + "T00:00:00Z").getUTCDay();
    const current = map.get(weekday) ?? { weekday, total: 0, recebido: 0, naoChegou: 0, days: 0 };
    current.total += row.total;
    current.recebido += row.recebido;
    current.naoChegou += row.naoChegou;
    current.days += 1;
    map.set(weekday, current);
  }
  return [...map.values()].sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday));
}

export type CalendarDay = { date: string; total: number; recebido: number; naoChegou: number; naoCompareceu: number; aguardando: number; recusado: number };
// Datas consecutivas dos últimos 7 dias corridos do período, inclusive dias sem agendas.
export function lastSevenCalendarDays(daily: Grouped[], { start, end }: { start: string; end: string }): CalendarDay[] {
  const first = start || daily[0]?.key;
  const last = end || daily[daily.length - 1]?.key;
  if (!first || !last) return [];
  const begin = Date.parse(first + "T00:00:00Z");
  const finish = Date.parse(last + "T00:00:00Z");
  if (!Number.isFinite(begin) || !Number.isFinite(finish) || begin > finish) return [];
  const lookup = new Map(daily.map(row => [row.key, row]));
  const days: CalendarDay[] = [];
  for (let time = Math.max(begin, finish - 6 * 86400000); time <= finish; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const row = lookup.get(date);
    days.push({
      date, total: row?.total ?? 0, recebido: row?.recebido ?? 0, naoChegou: row?.naoChegou ?? 0,
      naoCompareceu: row?.naoCompareceu ?? 0, aguardando: row?.aguardando ?? 0, recusado: row?.recusado ?? 0,
    });
  }
  return days;
}

export type DeltaKind = "neutral" | "good" | "invert";
export type Delta = { value: number; up: boolean; down: boolean; kind: DeltaKind } | null;
export function delta(current: number, previous: number | null | undefined, kind: DeltaKind = "neutral"): Delta {
  if (previous == null) return null;
  const value = current - previous;
  return { value, up: value > 0, down: value < 0, kind };
}
