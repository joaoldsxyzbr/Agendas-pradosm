import { z } from "zod";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Somente endpoints de mesma origem; cookies de sessao ficam sob controle do Worker.
  if (!path.startsWith("/api/")) throw new Error("Apenas endpoints internos sao permitidos.");
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = z.object({ error: z.string().optional(), message: z.string().optional() }).safeParse(body);
    throw new ApiError(
      response.status,
      error.success ? error.data.error ?? null : null,
      error.success ? error.data.message ?? "Não foi possível concluir a operação." : "Não foi possível concluir a operação.",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
