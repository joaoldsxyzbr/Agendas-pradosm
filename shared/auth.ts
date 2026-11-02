// Contratos de autenticacao compartilhados entre Worker e UI.
export type UserRole = "admin" | "conferente" | "visualizador";
export interface AuthUser {
  id: string;
  nome: string;
  papel: UserRole;
  lojaId: string | null;
  lojaCodigo: string | null;
  lojaNome: string | null;
}
export interface SessionPayload {
  userId: string;
  sessionVersion: number;
  exp: number;
}
