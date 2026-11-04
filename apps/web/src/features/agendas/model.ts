import { z } from "zod";

export const agendaBoardSchema = z.object({
  id: z.string(), storeId: z.string(), storeCode: z.string(),
  storeName: z.string().optional(), date: z.string().optional(),
  originalFileName: z.string().nullable().optional(),
  dayStatus: z.string(),
  total: z.number(), recebido: z.number(), aguardando: z.number(),
  digitadas: z.number().int().nonnegative(), fornecedores: z.number().int().nonnegative(),
  naoChegou: z.number(), recusado: z.number(), semAgenda: z.number(),
  // Compatibilidade com o campo legado; a nova tela não o utiliza.
  digitadoEm: z.string().nullable().optional(),
  digitadoPor: z.object({ id: z.string(), name: z.string() }).nullable().optional()
});

const digitador = z.object({ id: z.string(), name: z.string() }).nullable();
export const supplierAppointmentSchema = z.object({
  id: z.string(), protocol: z.string(), supplier: z.string(),
  startTime: z.string(), endTime: z.string(),
  items: z.number().nullable(), volumes: z.number().nullable(),
  pallets: z.number().nullable(), cargaBatida: z.string().nullable(),
  type: z.string().nullable(),
  nfe: z.array(z.string()), orders: z.array(z.string()),
  csvFields: z.record(z.string(), z.string())
});
export const supplierSchema = z.object({
  supplier: z.string(), hash: z.string().regex(/^[0-9a-f]{64}$/),
  digitadoEm: z.string().nullable(), digitadoPor: digitador,
  appointments: z.array(supplierAppointmentSchema)
});
export const agendaSuppliersSchema = z.object({
  agendaId: z.string(), suppliers: z.array(supplierSchema)
});
export const supplierUpdateSchema = supplierSchema.pick({
  supplier: true, hash: true, digitadoEm: true, digitadoPor: true
});
export type AgendaBoard = z.infer<typeof agendaBoardSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type SupplierAppointment = z.infer<typeof supplierAppointmentSchema>;

export function formatStamp(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);
}
