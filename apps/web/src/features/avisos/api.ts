import { apiFetch } from "@/lib/api";
import {
  avisosResponseSchema,
  avisoPublicadoSchema,
  publicarAvisoSchema,
  type AvisoPublicado,
  type AvisosResponse,
  type PublicarAvisoInput,
} from "./model";

// GET /api/avisos — lista (histórico permanente, mais recentes primeiro) +
// contagem de não lidos do usuário logado.
export async function getAvisos(): Promise<AvisosResponse> {
  return avisosResponseSchema.parse(await apiFetch<unknown>("/api/avisos"));
}

// POST /api/avisos/:id/lido — idempotente; o servidor responde { jaLido }.
export async function markAvisoLido(id: string): Promise<boolean> {
  const data = await apiFetch<{ jaLido?: boolean }>(`/api/avisos/${encodeURIComponent(id)}/lido`, {
    method: "POST",
  });
  return data.jaLido === true;
}

// POST /api/avisos/marcar-todos — grava a leitura de todos os avisos visíveis.
export async function marcarTodosLidos(): Promise<number> {
  const data = await apiFetch<{ marcados?: number }>("/api/avisos/marcar-todos", {
    method: "POST",
  });
  return data.marcados ?? 0;
}

// POST /api/admin/avisos — publica aviso (urgência e lojas opcionais).
// Aviso é registro permanente: nunca é excluído, apenas marcado como lido.
export async function publishAviso(input: PublicarAvisoInput): Promise<AvisoPublicado> {
  return avisoPublicadoSchema.parse(await apiFetch<unknown>("/api/admin/avisos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(publicarAvisoSchema.parse(input)),
  }));
}
