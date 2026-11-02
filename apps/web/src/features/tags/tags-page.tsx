import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Tags as TagsIcon } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { archiveTag, createTag, getTags, tagClass, tagColors, type Tag, type TagColor } from "./api";

const inputClass = "h-10 w-full min-w-0 rounded-md border border-[#46627e] bg-[#101e30] px-3 text-sm text-slate-50 outline-none focus-visible:border-sky-400";
const card = "rounded-xl border border-[#36516d] bg-[#142438] p-4 sm:p-6";
const errorText = (err: unknown) => err instanceof ApiError ? err.message : "Não foi possível concluir a operação.";

export function TagChip({ tag }: { tag: Tag }) {
  return <span className={"inline-flex max-w-full items-center rounded-md border px-2 py-1 text-[11px] font-semibold " + tagClass(tag.color)}>{tag.name}</span>;
}
export function TagsPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("azul");
  const [search, setSearch] = useState("");
  const [archiving, setArchiving] = useState<Tag | null>(null);
  const tags = useQuery({ queryKey: ["store-tags", "catalog"], queryFn: getTags });
  const create = useMutation({
    mutationFn: () => createTag(name.trim(), color),
    onSuccess: async () => { setName(""); await client.invalidateQueries({ queryKey: ["store-tags"] }); },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveTag(id),
    onSuccess: async () => { setArchiving(null); await client.invalidateQueries({ queryKey: ["store-tags"] }); },
  });
  const visible = tags.data?.filter(tag => tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))) ?? [];
  const createSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending || !name.trim() || name.trim().length > 32 || (tags.data?.length ?? 0) >= 100) return;
    create.mutate();
  };
  return <section className="mx-auto max-w-[1150px] space-y-5" aria-label="Tags">
    <PageHeader eyebrow="Organização da loja" title="Tags"
      description="Crie etiquetas para reconhecer fornecedores durante a conferência."
      actions={<span className="rounded-full border border-sky-500/30 bg-[#203650] px-3 py-2 text-xs font-semibold text-sky-200">
        {tags.data?.length ?? 0} de 100 tags
      </span>} />
    <section className={card}>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-sky-500/15 text-sky-300"><Plus size={22} aria-hidden="true" /></div>
        <div><h2 className="font-bold text-white">Nova etiqueta</h2><p className="mt-1 text-xs text-slate-400">Nome de até 32 caracteres e uma das seis cores disponíveis.</p></div>
      </div>
      <form onSubmit={createSubmit} aria-label="Criar tag" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto] xl:items-end">
        <label className="grid gap-2 text-xs font-semibold text-slate-200">Nome da tag
          <input autoComplete="off" maxLength={32} required className={inputClass} value={name}
            placeholder="Ex.: Descarga prioritária" onChange={event => setName(event.target.value)} />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-200">Cor
          <select className={inputClass} value={color} onChange={event => setColor(event.target.value as TagColor)}>
            {tagColors.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="grid min-h-14 gap-2 text-xs text-slate-200"><span className="font-semibold">Prévia</span>
          <div className="flex items-center"><TagChip tag={{ id: "preview", color, name: name.trim() || "Nome da tag" }} /></div>
        </div>
        <Button type="submit" disabled={create.isPending || !name.trim() || (tags.data?.length ?? 0) >= 100}>
          <Plus size={14} aria-hidden="true" />{create.isPending ? "Criando…" : "Criar tag"}
        </Button>
      </form>
      {create.isError && <p role="alert" className="mt-3 text-xs text-rose-300">{errorText(create.error)}</p>}
      {(tags.data?.length ?? 0) >= 100 && <p role="status" className="mt-3 text-xs text-amber-300">Esta loja atingiu o limite de 100 tags.</p>}
    </section>
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-white">Biblioteca de tags</h2>
          <p className="mt-1 text-xs text-slate-400">Etiquetas disponíveis para os conferentes desta loja.</p></div>
        <div className="flex gap-2">
          <input type="search" aria-label="Buscar tags" className={inputClass + " w-48"} value={search}
            placeholder="Buscar etiqueta…" onChange={event => setSearch(event.target.value)} />
          <Button size="icon" variant="secondary" aria-label="Atualizar tags" disabled={tags.isFetching} onClick={() => void tags.refetch()}>
            <RefreshCw size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {tags.isPending && <p role="status" className="text-sm text-slate-400">Carregando tags…</p>}
      {tags.isError && <div role="alert" className="flex flex-wrap gap-3 text-xs text-rose-300">Não foi possível carregar as tags.
        <Button variant="secondary" size="sm" onClick={() => void tags.refetch()}>Tentar novamente</Button></div>}
      {tags.data && <ul aria-label="Biblioteca de tags" className="divide-y divide-[#31475e]">
        {visible.map(tag => <li key={tag.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <TagsIcon className="shrink-0 text-sky-300" size={17} aria-hidden="true" />
            <div className="min-w-0"><strong className="block break-words text-xs text-slate-100">{tag.name}</strong>
              <p className="mt-1 text-[11px] text-slate-400">Etiqueta desta loja</p></div>
          </div>
          <div className="flex items-center gap-3"><TagChip tag={tag} />
            <Button variant="secondary" size="sm" disabled={archive.isPending} onClick={() => { archive.reset(); setArchiving(tag); }}
              aria-label={"Arquivar tag " + tag.name}>Arquivar</Button></div>
        </li>)}
        {!visible.length && <li className="py-9 text-center text-xs text-slate-400">
          {search ? "Nenhuma tag encontrada." : "Sua biblioteca está vazia. Crie uma etiqueta acima."}
        </li>}
      </ul>}
      {archiving && <div role="dialog" aria-modal="true" aria-label="Confirmar arquivamento de tag"
        className="mt-4 space-y-3 rounded-lg border border-amber-500/40 bg-[#20334a] p-4">
        <strong className="text-sm text-white">Arquivar “{archiving.name}”?</strong>
        <p className="text-xs text-slate-300">A etiqueta ficará visível nos registros históricos, mas não poderá ser aplicada em novos agendamentos.</p>
        {archive.isError && <p role="alert" className="text-xs text-rose-300">{errorText(archive.error)}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={archive.isPending} onClick={() => archive.mutate(archiving.id)}>{archive.isPending ? "Arquivando…" : "Confirmar arquivamento"}</Button>
          <Button variant="secondary" size="sm" disabled={archive.isPending} onClick={() => setArchiving(null)}>Cancelar</Button>
        </div>
      </div>}
    </section>
  </section>;
}
