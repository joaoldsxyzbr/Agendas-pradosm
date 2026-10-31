import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { storeSchema, type Store } from "@/features/receiving/model";

const auditSchema = z.object({
  id: z.string(), action: z.string(), createdAt: z.string(),
  details: z.string().nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export type StoreAudit = z.infer<typeof auditSchema>;
export type StoreForm = { codigo: string; nome: string; ativo: boolean };
export const normalizeCode = (code: string) => code.trim().toLocaleUpperCase("pt-BR");
export const filterStores = (stores: Store[], search: string, status: "todas" | "ativas" | "inativas") => {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  return stores.filter(store =>
    (status === "todas" || store.ativo === (status === "ativas")) &&
    (!term || (store.codigo + " " + store.nome).toLocaleLowerCase("pt-BR").includes(term)));
};
export const validStore = (form: StoreForm) => form.codigo.trim().length > 0 &&
  form.codigo.trim().length <= 20 && form.nome.trim().length > 0 && form.nome.trim().length <= 120;
export const storesKey = ["admin", "stores"] as const;

export async function listStores() {
  return z.array(storeSchema).parse(await apiFetch<unknown>("/api/admin/stores"));
}
export async function saveStore(form: StoreForm, id?: string) {
  const payload = { codigo: normalizeCode(form.codigo), nome: form.nome.trim(), ...(id ? { id, ativo: form.ativo } : {}) };
  return storeSchema.parse(await apiFetch<unknown>("/api/admin/stores", {
    method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}
export async function deleteStore(id: string) {
  await apiFetch<void>("/api/admin/stores/" + encodeURIComponent(id), { method: "DELETE" });
}
export async function listStoreAudit(id: string) {
  const params = new URLSearchParams({ entity: "loja", entityId: id });
  return z.array(auditSchema).parse(await apiFetch<unknown>("/api/admin/audit?" + params));
}
