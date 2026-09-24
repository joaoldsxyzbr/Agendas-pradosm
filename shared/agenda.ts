import { z } from "zod";

export const AGENDA_STATUSES = [
  "aguardando",
  "recebido",
  "nao_chegou",
  "recusado",
] as const;

export type AgendaStatus = (typeof AGENDA_STATUSES)[number];

export const AGENDA_DOCUMENT_TYPES = [
  "Nota fiscal",
  "Pedido",
  "CNPJ",
  "Agenda fixa",
] as const;

export type AgendaDocumentType = (typeof AGENDA_DOCUMENT_TYPES)[number];

export type ParsedAgendaAppointment = {
  protocol: string;
  startTime: string;
  endTime: string;
  supplier: string;
  items: number | null;
  volumes: number | null;
  pallets: number | null;
  cargaBatida: string | null;
  type: AgendaDocumentType;
  nfe: string[];
  orders: string[];
  status: "aguardando";
};

export type ParseAgendaResult = {
  storeCode: string | null;
  storeName: string | null;
  date: string | null;
  appointments: ParsedAgendaAppointment[];
  warnings: string[];
  blockingErrors: string[];
};

function isValidIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidIsoDate, { message: "Data inválida." });

const Time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

const NullableCount = z.number().int().nonnegative().nullable();

const ImportedAppointmentInput = z
  .object({
    protocol: z.string().trim().regex(/^\d{6,20}$/),
    startTime: Time,
    endTime: Time,
    supplier: z.string().trim().min(1).max(200),
    items: NullableCount,
    volumes: NullableCount,
    pallets: NullableCount,
    cargaBatida: z.string().trim().min(1).max(120).nullable(),
    type: z.enum(AGENDA_DOCUMENT_TYPES),
    nfe: z.array(z.string().trim().min(1).max(80)).max(100),
    orders: z.array(z.string().trim().min(1).max(80)).max(100),
  })
  .superRefine((value, ctx) => {
    if (timeToMinutes(value.startTime) >= timeToMinutes(value.endTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Horário final deve ser posterior ao inicial.",
      });
    }
  });

export const ImportAgendaInput = z
  .object({
    storeCode: z
      .string()
      .trim()
      .regex(/^F\d{1,4}$/i)
      .transform((value) => value.toUpperCase()),
    date: IsoDate,
    originalFileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (value) =>
          value !== "." &&
          value !== ".." &&
          !value.includes("/") &&
          !value.includes("\\"),
        { message: "Nome de arquivo inválido." },
      ),
    appointments: z.array(ImportedAppointmentInput).min(1).max(500),
    replace: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const protocols = new Set<string>();

    value.appointments.forEach((appointment, index) => {
      if (protocols.has(appointment.protocol)) {
        ctx.addIssue({
          code: "custom",
          path: ["appointments", index, "protocol"],
          message: "Protocolo duplicado no payload.",
        });
      }
      protocols.add(appointment.protocol);
    });
  });

export type ImportAgendaPayload = z.infer<typeof ImportAgendaInput>;
export type ImportedAppointmentPayload =
  ImportAgendaPayload["appointments"][number];
