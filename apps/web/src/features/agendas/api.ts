import { apiFetch } from "@/lib/api";
import { z } from "zod";
import { agendaBoardSchema, agendaSuppliersSchema, supplierUpdateSchema } from "./model";

export async function getAgendaBoards(date: string) {
  return z.array(agendaBoardSchema).parse(await apiFetch<unknown>(
    "/api/admin/agendas?date=" + encodeURIComponent(date),
  ));
}

export async function getAgendaSuppliers(agendaId: string) {
  return agendaSuppliersSchema.parse(await apiFetch<unknown>(
    "/api/admin/agendas/" + encodeURIComponent(agendaId) + "/digitacao",
  ));
}

export async function updateSupplierCheck(agendaId: string, input: {
  supplier: string; hash: string; digitado: boolean; expectedDigitadoEm: string | null;
}) {
  return supplierUpdateSchema.parse(await apiFetch<unknown>(
    "/api/admin/agendas/" + encodeURIComponent(agendaId) + "/digitacao", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  ));
}
