import { z } from "zod";

export const storeSchema = z.object({
  id: z.string(), codigo: z.string(), nome: z.string(),
  ativo: z.boolean(), temConferenteAtivo: z.boolean().optional(),
});
export const summarySchema = z.object({
  id: z.string(), storeCode: z.string(), storeName: z.string().optional(),
  date: z.string().optional(), dayStatus: z.string(),
  total: z.number(), recebido: z.number(), aguardando: z.number(),
  naoChegou: z.number(), recusado: z.number(), semAgenda: z.number(),
});
export const presenceSchema = z.object({
  storeId: z.string(), status: z.enum(["online", "away", "offline"]),
});
export const appointmentSchema = z.object({
  id: z.string(), supplier: z.string(), protocol: z.string(),
  startTime: z.string(), endTime: z.string(), status: z.string(),
  type: z.string().optional(), items: z.number().optional(),
  volumes: z.number().optional(), pallets: z.number().optional(),
  hasExchanges: z.boolean().optional(), observation: z.string().nullable().optional(),
});
export const detailSchema = z.object({
  agenda: z.object({
    id: z.string(), storeCode: z.string(), storeName: z.string(),
    date: z.string(), dayStatus: z.string(),
  }),
  appointments: z.array(appointmentSchema),
});

export type Store = z.infer<typeof storeSchema>;
export type AgendaSummary = z.infer<typeof summarySchema>;
export type Presence = z.infer<typeof presenceSchema>;
export type AgendaDetail = z.infer<typeof detailSchema>;

export type ReceivingRow = {
  store: Store;
  agenda: AgendaSummary | null;
  presence: Presence["status"];
};

export function receivingModel(stores: Store[], agendas: AgendaSummary[], presences: Presence[]) {
  const active = stores.filter(store => store.ativo && store.temConferenteAtivo !== false);
  const byCode = new Map(agendas.map(agenda => [agenda.storeCode, agenda]));
  const byId = new Map(presences.map(presence => [presence.storeId, presence]));
  const rows: ReceivingRow[] = active.map(store => ({
    store, agenda: byCode.get(store.codigo) ?? null,
    presence: byId.get(store.id)?.status ?? "offline",
  })).sort((a, b) => Number(a.agenda?.dayStatus === "concluido") - Number(b.agenda?.dayStatus === "concluido"));
  return {
    rows,
    totalStores: active.length,
    storesWithAgenda: rows.filter(row => row.agenda).length,
    openStores: rows.filter(row => row.agenda && row.agenda.dayStatus !== "concluido").length,
    completedStores: rows.filter(row => row.agenda?.dayStatus === "concluido").length,
    storesWithoutAgenda: rows.filter(row => !row.agenda).length,
  };
}

export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const entry = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return `${entry("year")}-${entry("month")}-${entry("day")}`;
}

export function shiftDay(iso: string, offset: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatDay(iso: string) {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

export function pendingLabels(agenda: AgendaSummary) {
  return [
    [agenda.aguardando, "aguardando", "warning"],
    [agenda.naoChegou, "não recebidos", "danger"],
    [agenda.recusado, "recusados", "danger"],
    [agenda.semAgenda, "sem agenda", "neutral"],
  ].filter(([count]) => Number(count) > 0) as Array<[number, string, string]>;
}
