export type UserProfile = "admin" | "loja";
export type UserAccess = "admin" | "dashboard" | "loja";

export type AuthUser = {
  id: string;
  nome: string;
  perfil: UserProfile;
  acesso: UserAccess;
  lojaId: string | null;
  lojaCodigo: string | null;
  lojaNome: string | null;
};
