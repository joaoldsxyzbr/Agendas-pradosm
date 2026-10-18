import { normalizeStoreCode } from "./store.js";
import { z } from "zod";
const AGENDA_STATUSES = [
  "aguardando",
  "recebido",
  "nao_chegou",
  "recusado"
];
const AGENDA_DOCUMENT_TYPES = [
  "Nota fiscal",
  "Pedido",
  "CNPJ",
  "Agenda fixa"
];
function isValidIsoDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function timeToMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidIsoDate, { message: "Data inv\xE1lida." });
const Time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const NullableCount = z.number().int().nonnegative().nullable();
const ImportedAppointmentInput = z.object({
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
  orders: z.array(z.string().trim().min(1).max(80)).max(100)
}).superRefine((value, ctx) => {
  if (timeToMinutes(value.startTime) >= timeToMinutes(value.endTime)) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Hor\xE1rio final deve ser posterior ao inicial."
    });
  }
});
const ImportAgendaInput = z.object({
  storeCode: z.string().trim().min(1).max(20).transform(normalizeStoreCode),
  date: IsoDate,
  originalFileName: z.string().trim().min(1).max(255).refine(
    (value) => value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\"),
    { message: "Nome de arquivo inv\xE1lido." }
  ),
  appointments: z.array(ImportedAppointmentInput).min(1).max(500),
  replace: z.boolean().optional().default(false)
}).superRefine((value, ctx) => {
  const protocols = /* @__PURE__ */ new Set();
  value.appointments.forEach((appointment, index) => {
    if (protocols.has(appointment.protocol)) {
      ctx.addIssue({
        code: "custom",
        path: ["appointments", index, "protocol"],
        message: "Protocolo duplicado no payload."
      });
    }
    protocols.add(appointment.protocol);
  });
});
const ImportAgendaBatchInput = z.object({
  agendas: z.array(ImportAgendaInput).min(1).max(50)
}).superRefine((value, ctx) => {
  const agendaKeys = /* @__PURE__ */ new Set();
  let totalAppointments = 0;
  value.agendas.forEach((agenda, index) => {
    const key = `${agenda.storeCode}|${agenda.date}`;
    if (agendaKeys.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["agendas", index],
        message: "Loja e data duplicadas no lote."
      });
    }
    agendaKeys.add(key);
    totalAppointments += agenda.appointments.length;
  });
  if (totalAppointments > 700) {
    ctx.addIssue({
      code: "custom",
      path: ["agendas"],
      message: "O lote excede o limite seguro de 700 agendamentos."
    });
  }
});
export {
  AGENDA_DOCUMENT_TYPES,
  AGENDA_STATUSES,
  ImportAgendaBatchInput,
  ImportAgendaInput
};