import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api";

export const roleSchema = z.enum(["admin", "visualizador", "conferente"]);
export const userSchema = z.object({
  id: z.string(),
  nome: z.string(),
  // O Worker atual não retorna login em /me nem no POST /login.
  login: z.string().optional(),
  papel: roleSchema,
  lojaId: z.string().nullable().optional(),
  lojaNome: z.string().nullable().optional(),
  lojaCodigo: z.string().nullable().optional(),
});
export type SessionUser = z.infer<typeof userSchema>;
export type Role = z.infer<typeof roleSchema>;

export function homeForRole(role: Role): string {
  return role === "conferente" ? "/app" : "/admin";
}

export async function loadSession(): Promise<SessionUser | null> {
  try {
    const raw = await apiFetch<unknown>("/api/auth/me");
    return userSchema.parse(raw);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export async function login(login: string, senha: string): Promise<SessionUser> {
  const raw = await apiFetch<unknown>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, senha }),
  });
  return userSchema.parse(raw);
}
export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
