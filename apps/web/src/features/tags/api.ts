import { z } from "zod";
import { apiFetch } from "@/lib/api";

export const tagColors = [
  { value: "azul", label: "Azul", style: "border-sky-500/40 bg-sky-500/15 text-sky-200" },
  { value: "verde", label: "Verde", style: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" },
  { value: "amarelo", label: "Amarelo", style: "border-amber-500/40 bg-amber-500/15 text-amber-200" },
  { value: "vermelho", label: "Vermelho", style: "border-rose-500/40 bg-rose-500/15 text-rose-200" },
  { value: "roxo", label: "Roxo", style: "border-violet-500/40 bg-violet-500/15 text-violet-200" },
  { value: "cinza", label: "Cinza", style: "border-slate-400/40 bg-slate-400/15 text-slate-200" },
] as const;
export const colorSchema = z.enum(["azul", "verde", "amarelo", "vermelho", "roxo", "cinza"]);
export const tagSchema = z.object({ id: z.string(), name: z.string(), color: colorSchema });
export const assignedTagsSchema = z.object({
  tags: z.array(tagSchema),
  assignments: z.record(z.string(), z.array(tagSchema)),
});
export const assignmentResultSchema = z.object({ tags: z.array(tagSchema) });
export type Tag = z.infer<typeof tagSchema>;
export type TagColor = z.infer<typeof colorSchema>;

export async function getTags(): Promise<Tag[]> {
  return z.array(tagSchema).parse(await apiFetch<unknown>("/api/store/tags"));
}
export async function createTag(name: string, color: TagColor): Promise<Tag> {
  return tagSchema.parse(await apiFetch<unknown>("/api/store/tags", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  }));
}
export async function archiveTag(id: string): Promise<void> {
  return apiFetch<void>("/api/store/tags/" + encodeURIComponent(id), { method: "DELETE" });
}
export async function getAssignedTags(date: string) {
  return assignedTagsSchema.parse(await apiFetch<unknown>("/api/store/tags/agenda/" + encodeURIComponent(date)));
}
export async function assignTags(appointmentId: string, tagIds: string[]) {
  return assignmentResultSchema.parse(await apiFetch<unknown>(
    "/api/store/tags/appointments/" + encodeURIComponent(appointmentId), {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    }));
}
export function tagClass(color: string) {
  return tagColors.find(option => option.value === color)?.style ?? tagColors[5].style;
}
