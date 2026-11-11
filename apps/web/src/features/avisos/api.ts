import { apiFetch } from "@/lib/api";
import {
  avisosResponseSchema,
  avisoPublicadoSchema,
  publicarAvisoSchema,
  type AvisoPublicado,
  type AvisosResponse,
  type PublicarAvisoInput,
} from "./model";

// GET /api/avisos — lista ativos + contagem de não lidos do usuário logado.
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

// POST /api/admin/avisos — publica aviso visível a todos os papéis.
export async function publishAviso(input: PublicarAvisoInput): Promise<AvisoPublicado> {
  return avisoPublicadoSchema.parse(await apiFetch<unknown>("/api/admin/avisos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(publicarAvisoSchema.parse(input)),
  }));
}

// POST /api/admin/avisos/:id/inativar — soft delete; 404 se já inativo.
export async function inativarAviso(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/admin/avisos/${encodeURIComponent(id)}/inativar`, {
    method: "POST",
  });
}
