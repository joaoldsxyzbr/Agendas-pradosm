import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { Store } from "@/features/receiving/model";
import { deleteStore, filterStores, listStoreAudit, listStores, saveStore, storesKey, validStore, type StoreForm } from "./api";

const surface = "rounded-xl border border-[#344d69] bg-[#142338] shadow-lg";
const input = "h-9 min-w-0 w-full rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400";
const errorText = (e: unknown) => e instanceof ApiError ? e.message : "A operação não pôde ser concluída. Tente novamente.";
const auditActions: Record<string, string> = {
  loja_criada: "Loja criada", loja_atualizada: "Loja atualizada", loja_removida: "Loja removida",
};
function auditValue(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  return Object.entries(value).filter(([key]) => key !== "senha" && key !== "token").map(([key, item]) => {
    const label = { codigo: "Código", nome: "Nome", ativo: "Ativa" }[key] ?? key;
    return label + ": " + (typeof item === "boolean" ? item ? "Sim" : "Não" : String(item ?? "—"));
  }).join(" · ");
}
function StoreDialog({ store, onClose }: { store: Store | null; onClose: () => void }) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [form, setForm] = useState<StoreForm>(() => ({
    codigo: store?.codigo ?? "", nome: store?.nome ?? "", ativo: store?.ativo ?? true,
  }));
  const [auditVisible, setAuditVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState("");
  const audit = useQuery({
    queryKey: ["admin", "store-audit", store?.id], queryFn: () => listStoreAudit(store!.id),
    enabled: Boolean(store) && auditVisible,
  });
  useEffect(() => {
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: storesKey }),
      client.invalidateQueries({ queryKey: ["receiving"] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => saveStore(form, store?.id),
    onSuccess: async () => { await refresh(); onClose(); },
  });
  const remove = useMutation({
    mutationFn: async () => { if (!store) throw new Error("Loja não selecionada"); await deleteStore(store.id); },
    onSuccess: async () => { await refresh(); onClose(); },
  });
  const busy = save.isPending || remove.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && validStore(form)) save.mutate();
  };
  return <dialog ref={modalRef} aria-label={store ? "Editar loja" : "Cadastrar loja"}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}
    className="fixed inset-0 m-auto max-h-[90vh] w-[min(540px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#48617b] bg-[#142338] p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75">
    <div className="flex items-start justify-between gap-3 border-b border-[#344d69] px-5 py-4">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">{store ? "Gerenciar unidade" : "Nova unidade"}</p>
        <h2 className="mt-1 text-lg font-bold">{store ? "Editar loja" : "Cadastrar loja"}</h2></div>
      <Button size="icon" variant="ghost" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></Button>
    </div>
    <form onSubmit={submit} className="space-y-4 p-5" aria-label="Formulário da loja">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Código
          <input autoFocus name="codigo" className={input} maxLength={20} required value={form.codigo} placeholder="F03 ou CD DOCA 01"
            onChange={event => setForm(value => ({ ...value, codigo: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Nome
          <input name="nome" className={input} maxLength={120} required value={form.nome}
            onChange={event => setForm(value => ({ ...value, nome: event.target.value }))} />
        </label>
      </div>
      {store && <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Situação
        <select className={input} value={form.ativo ? "ativa" : "inativa"}
          onChange={event => setForm(value => ({ ...value, ativo: event.target.value === "ativa" }))}>
          <option value="ativa">Ativa</option><option value="inativa">Inativa</option>
        </select>
      </label>}
      {save.isError && <p role="alert" className="text-xs text-rose-300">{errorText(save.error)}</p>}
      {feedback && <p role="status" className="text-xs text-slate-300">{feedback}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={busy || !validStore(form)}>{save.isPending ? "Salvando…" : store ? "Salvar alterações" : "Cadastrar loja"}</Button>
      </div>
    </form>
    {store && <div className="space-y-4 border-t border-[#344d69] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold">Histórico de alterações</h3><p className="text-xs text-slate-400">Auditoria deste cadastro</p></div>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAuditVisible(value => !value)}>{auditVisible ? "Ocultar histórico" : "Ver histórico"}</Button>
      </div>
      {auditVisible && <div className="max-h-56 overflow-auto rounded-lg border border-[#344d69] bg-[#101e30] p-3">
        {audit.isPending && <p role="status" className="text-xs text-slate-400">Carregando histórico…</p>}
        {audit.isError && <p role="alert" className="text-xs text-rose-300">Não foi possível carregar o histórico.
          <Button variant="secondary" size="sm" onClick={() => void audit.refetch()}>Tentar novamente</Button></p>}
        {audit.data && (!audit.data.length ? <p className="text-xs text-slate-400">Nenhuma alteração registrada.</p>
          : <ol className="space-y-3">{audit.data.map(event => <li key={event.id} className="space-y-1 border-b border-[#344d69] pb-3 text-xs">
            <strong className="block text-white">{auditActions[event.action] ?? event.action}</strong>
            <span className="block text-slate-400">{event.user?.name ?? "Sistema"} · {new Date(event.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            {event.details && <span className="block text-slate-300">{event.details}</span>}
            {event.before && <span className="block break-words text-slate-400">Antes: {auditValue(event.before)}</span>}
            {event.after && <span className="block break-words text-slate-400">Depois: {auditValue(event.after)}</span>}
          </li>)}</ol>)}
      </div>}
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong className="text-xs text-slate-100">{confirmDelete ? "Confirmar exclusão da loja?" : "Excluir loja"}</strong>
            <p className="mt-1 text-[11px] text-slate-400">{confirmDelete ? "Usuários vinculados impedem a exclusão." : "Preserva agendas e histórico existentes."}</p></div>
          {!confirmDelete ? <Button size="sm" variant="danger" disabled={busy} onClick={() => { setFeedback(""); setConfirmDelete(true); }}><Trash2 size={13} />Excluir loja</Button>
            : <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => remove.mutate()}>{remove.isPending ? "Excluindo…" : "Confirmar exclusão"}</Button></div>}
        </div>
        {remove.isError && <p role="alert" className="mt-2 text-xs text-rose-300">{errorText(remove.error)}</p>}
      </div>
    </div>}
  </dialog>;
}

export function StoresPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"todas" | "ativas" | "inativas">("todas");
  const [editing, setEditing] = useState<Store | null | "new">(null);
  const query = useQuery({ queryKey: storesKey, queryFn: listStores });
  const stores = query.data ?? [];
  const visible = filterStores(stores, search, status);
  return <section className="mx-auto w-full min-w-0 max-w-[1450px] space-y-5" aria-label="Cadastro de lojas">
    <PageHeader eyebrow="Cadastros" title="Lojas" description="Gerencie as unidades habilitadas para recebimento."
      actions={<div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-slate-400">{stores.length} lojas · {stores.filter(s => s.ativo).length} ativas</span>
        <Button onClick={() => setEditing("new")}><Plus size={14} />Nova loja</Button>
      </div>} />
    <div className={surface}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#344d69] p-4">
        <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-[#48617b] bg-[#192d46] px-3 sm:max-w-sm">
          <Search size={15} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="sr-only">Buscar loja</span>
          <input type="search" aria-label="Buscar loja" value={search} onChange={event => setSearch(event.target.value)}
            className="h-9 w-full min-w-0 bg-transparent text-xs text-white outline-none" placeholder="Buscar por código ou nome..." />
        </label>
        <div className="flex items-center gap-2">
          <select aria-label="Filtrar por situação" value={status} onChange={event => setStatus(event.target.value as typeof status)} className={input + " max-w-[165px]"}>
            <option value="todas">Todas as situações</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option>
          </select>
          <Button size="icon" variant="secondary" aria-label="Atualizar lojas" disabled={query.isFetching} onClick={() => void query.refetch()}>
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>
      {query.isPending && <p role="status" className="p-5 text-xs text-slate-300">Carregando lojas…</p>}
      {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-xs text-rose-300">Não foi possível carregar as lojas.
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
      {query.data && <div className="w-full min-w-0 overflow-x-auto">
        <table aria-label="Lojas cadastradas" className="w-full min-w-[580px] border-collapse">
          <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
            <th className="px-4 py-3">Código</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Situação</th>
            <th className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="divide-y divide-[#344d69]">
            {visible.map(store => <tr key={store.id} data-testid={"store-" + store.codigo} className="hover:bg-[#1c3047]">
              <td className="px-4 py-3 text-xs font-bold text-white">{store.codigo}</td><td className="px-4 py-3 text-xs text-slate-200">{store.nome}</td>
              <td className="px-4 py-3"><StatusBadge tone={store.ativo ? "success" : "neutral"}>{store.ativo ? "Ativa" : "Inativa"}</StatusBadge></td>
              <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" aria-label={"Editar loja " + store.codigo} onClick={() => setEditing(store)}>
                <Pencil size={13} />Editar</Button></td>
            </tr>)}
            {!visible.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">Nenhuma loja encontrada.</td></tr>}
          </tbody>
        </table>
      </div>}
    </div>
    {editing !== null && <StoreDialog key={editing === "new" ? "new" : editing.id} store={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
  </section>;
}
