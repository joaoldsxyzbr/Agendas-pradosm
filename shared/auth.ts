export type UserProfile = "admin" | "loja";

export type AuthUser = {
  id: string;
  nome: string;
  perfil: UserProfile;
  lojaId: string | null;
};
