export type UserRole = "admin" | "conferente" | "visualizador";

export type AuthUser = {
  id: string;
  nome: string;
  papel: UserRole;
  lojaId: string | null;
  lojaCodigo: string | null;
  lojaNome: string | null;
};
