import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { storeSchema, type Store } from "@/features/receiving/model";

const userSchema = z.object({
  id: z.string(),
  nome: z.string(),
  login: z.string(),
  papel: z.enum(["admin", "conferente", "visualizador"]),
  lojaId: z.string().nullable().optional(),
  ativo: z.boolean(),
});

const auditSchema = z.object({
  id: z.string(),
  action: z.string(),
  createdAt: z.string(),
  details: z.string().nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export type AdminUser = z.infer<typeof userSchema>;
export type UserAudit = z.infer<typeof auditSchema>;
export type UserForm = {
  nome: string;
  login: string;
  senha: string;
  papel: AdminUser["papel"];
  lojaId: string;
};

export const ROLE_LABELS: Record<AdminUser["papel"], string> = {
  admin: "Administrador",
  conferente: "Conferente",
  visualizador: "Visualizador",
};

export const usersKey = ["admin", "users"] as const;

// Espelha filterUsers do frontend atual: busca por nome, login, loja ou papel.
export const filterUsers = (
  users: AdminUser[],
  stores: Store[],
  search = "",
  role: AdminUser["papel"] | "todos" = "todos",
  status: "todos" | "ativos" | "inativos" = "todos",
) => {
  const names = new Map(stores.map(store => [store.id, `${store.codigo} - ${store.nome}`]));
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return users.filter(user => {
    const store = user.lojaId ? names.get(user.lojaId) ?? "" : "";
    const text = [user.nome, user.login, store, ROLE_LABELS[user.papel] ?? ""]
      .join(" ").toLocaleLowerCase("pt-BR");
    return (!query || text.includes(query)) &&
      (role === "todos" || user.papel === role) &&
      (status === "todos" || user.ativo === (status === "ativos"));
  });
};

// Mesmas regras de CreateUserInput/UpdateUserInput do Worker.
export const validUser = (form: UserForm, creating: boolean) => {
  const nome = form.nome.trim();
  const login = form.login.trim();
  const senhaOk = creating ? form.senha.length >= 12 && form.senha.length <= 200
    : form.senha.length === 0 || (form.senha.length >= 12 && form.senha.length <= 200);
  return nome.length > 0 && nome.length <= 120 &&
    login.length >= 3 && login.length <= 100 && senhaOk &&
    (form.papel !== "conferente" || form.lojaId.length > 0);
};

export const emptyUserForm = (): UserForm => ({
  nome: "", login: "", senha: "", papel: "conferente", lojaId: "",
});

export async function listUsers() {
  return z.array(userSchema).parse(await apiFetch<unknown>("/api/admin/users"));
}

export async function saveUser(form: UserForm, id?: string) {
  const payload = {
    ...(id ? { id } : {}),
    nome: form.nome.trim(),
    login: form.login.trim(),
    ...(form.senha ? { senha: form.senha } : {}),
    papel: form.papel,
    ...(form.papel === "conferente" ? { lojaId: form.lojaId } : {}),
  };
  return userSchema.parse(await apiFetch<unknown>("/api/admin/users", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function setUserActive(id: string, ativo: boolean) {
  return userSchema.parse(await apiFetch<unknown>("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ativo }),
  }));
}

export async function listUserAudit(id: string) {
  const params = new URLSearchParams({ entity: "usuario", entityId: id });
  return z.array(auditSchema).parse(await apiFetch<unknown>("/api/admin/audit?" + params));
}
