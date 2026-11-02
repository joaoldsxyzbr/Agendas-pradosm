import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { assignTags, type Tag } from "./api";
import { TagChip } from "./tags-page";

export function TagPicker({ appointmentId, supplier, choices, assigned, onSaved, onCancel }: {
  appointmentId: string; supplier: string; choices: Tag[]; assigned: Tag[];
  onSaved: () => Promise<void>; onCancel: () => void;
}) {
  // Tags arquivadas continuam no histórico, mas não podem ser reaplicadas.
  const [selected, setSelected] = useState<string[]>(() => assigned.filter(tag => choices.some(choice => choice.id === tag.id)).map(tag => tag.id));
  const save = useMutation({
    mutationFn: () => assignTags(appointmentId, selected),
    onSuccess: async () => { await onSaved(); onCancel(); },
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length <= 5 && !save.isPending) save.mutate();
  };
  return <form aria-label={"Editar tags de " + supplier} onSubmit={onSubmit}
    className="space-y-3 rounded-lg border border-sky-500/40 bg-[#1a3750] p-3">
    <div><h3 className="text-xs font-bold text-white">Tags de {supplier}</h3>
      <p className="mt-1 text-[11px] text-slate-300">Selecione até cinco etiquetas deste estabelecimento.</p></div>
    {!choices.length && <p role="status" className="text-xs text-amber-200">Nenhuma tag cadastrada. Crie etiquetas na aba Tags.</p>}
    <div className="flex flex-wrap gap-2">
      {choices.map(tag => <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#48617b] bg-[#182c44] p-2 text-xs">
        <input type="checkbox" aria-label={"Selecionar tag " + tag.name} checked={selected.includes(tag.id)} disabled={save.isPending}
          onChange={event => setSelected(value => event.target.checked ? [...value, tag.id] : value.filter(id => id !== tag.id))} />
        <TagChip tag={tag} />
      </label>)}
    </div>
    {selected.length > 5 && <p role="alert" className="text-xs text-rose-300">Selecione no máximo 5 tags.</p>}
    {save.isError && <p role="alert" className="text-xs text-rose-300">{save.error instanceof ApiError ? save.error.message : "Não foi possível salvar as tags."}</p>}
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={save.isPending || selected.length > 5}>
        {save.isPending ? "Salvando…" : "Salvar tags"}
      </Button>
      <Button variant="secondary" size="sm" disabled={save.isPending} onClick={onCancel}>Cancelar</Button>
    </div>
  </form>;
}
