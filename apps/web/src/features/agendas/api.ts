import { apiFetch } from "@/lib/api";
import { z } from "zod";
import { agendaBoardSchema } from "./model";

export async function getAgendaBoards(date: string) {
  return z.array(agendaBoardSchema).parse(await apiFetch<unknown>(
    "/api/admin/agendas?date=" + encodeURIComponent(date),
  ));
}

export async function markAgendaDigitado(id: string, digitado: boolean) {
  return apiFetch<unknown>("/api/admin/agendas/" + encodeURIComponent(id) + "/digitado", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ digitado }),
  });
}
