import { z } from "zod";

export const agendaBoardSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  storeCode: z.string(),
  storeName: z.string().optional(),
  date: z.string().optional(),
  originalFileName: z.string().nullable().optional(),
  dayStatus: z.string(),
  digitadoEm: z.string().nullable().optional(),
  digitadoPor: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  total: z.number(),
  recebido: z.number(),
  aguardando: z.number(),
  naoChegou: z.number(),
  recusado: z.number(),
  semAgenda: z.number(),
});

export const digitadoUpdateSchema = z.object({
  id: z.string(),
  digitadoEm: z.string().nullable(),
  digitadoPor: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export type AgendaBoard = z.infer<typeof agendaBoardSchema>;
export type DigitadoUpdate = z.infer<typeof digitadoUpdateSchema>;

export function formatStamp(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
