import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileDown, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatDay } from "@/features/receiving/model";
import { getAssignedTags, type Tag } from "@/features/tags/api";
import { TagChip } from "@/features/tags/tags-page";
import { TagPicker } from "@/features/tags/tag-picker";
import { downloadAgendaPdf } from "./export-agenda-pdf";
import { useStoreRealtime } from "./use-store-realtime";
import {
  businessToday, shiftDay, loadStoreAgenda, filterAppointments, metricValues,
  patchStoreExchanges, patchStoreStatus, patchStoreObservation,
  createManualAppointment, patchManualSupplier, deleteManualSupplier,
  getStoreAppointmentDetail, completeStoreDay, type StoreAppointment, type StoreAppointmentDetail,
} from "./model";

const reasonOptions = ["Sem agenda", "Sem pedido", "Sem boleto", "Prazo de pagamento incorreto", "Temperatura acima do OK", "Não veio"];
const statusLabels = { aguardando:"Aguardando", recebido:"Recebido", nao_chegou:"Não recebido", recusado:"Recusado" } as const;
type StatusKey = keyof typeof statusLabels;
function displayStatus(status: string, observation?: string | null) {
  if (status === "nao_chegou" && observation === "Não compareceu") return "Não compareceu";
  return statusLabels[status as StatusKey] ?? status;
}
function errorText(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message
    : "Não foi possível salvar. Atualize a agenda e tente novamente.";
}

function ManualSupplierDialog({ target, date, onClose, onSaved, onDeleted }: {
  target: { mode: "create" } | { mode: "edit"; item: StoreAppointment };
  date: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const editing = target.mode === "edit";
  const [supplier, setSupplier] = useState(target.mode === "edit" ? target.item.supplier : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: { kind: "save" } | { kind: "delete" }) => {
      if (action.kind === "delete") {
        if (target.mode !== "edit") throw new Error("Fornecedor inválido.");
        return deleteManualSupplier(target.item.id);
      }
      const cleaned = supplier.trim().replace(/\s+/g, " ");
      if (!cleaned) throw new Error("Informe o nome do fornecedor.");
      if (cleaned.length > 160) throw new Error("O nome do fornecedor deve ter até 160 caracteres.");
      return target.mode === "edit"
        ? patchManualSupplier(target.item.id, cleaned)
        : createManualAppointment(date, cleaned);
    },
    onSuccess: async (_saved, action) => {
      if (action.kind === "delete") await onDeleted();
      else await onSaved();
      onClose();
    },
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const busy = mutation.isPending;
  const message = mutation.isError ? errorText(mutation.error) : "";
  return <dialog ref={ref} aria-labelledby="manual-supplier-heading"
    onCancel={event => { if (busy) { event.preventDefault(); return; } onClose(); }}
    onClick={event => { if (event.target === ref.current && !busy) onClose(); }}
    className="m-auto w-[min(94vw,460px)] rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="flex items-center justify-between gap-3 border-b border-[#34516d] px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Recebimento</p>
        <h2 id="manual-supplier-heading" className="text-base font-bold">
          {confirmDelete ? "Remover fornecedor" : editing ? "Editar fornecedor" : "Fornecedor sem agenda"}
        </h2>
      </div>
      {!confirmDelete && <Button aria-label="Fechar" size="icon" variant="secondary" disabled={busy}
        onClick={onClose}><X size={16} /></Button>}
    </div>
    {confirmDelete && editing && target.mode === "edit" ? <div className="space-y-3 p-4">
      <p className="text-xs text-slate-300">Remover <strong>{target.item.supplier}</strong>?
        O registro ficará preservado no histórico de auditoria.</p>
      {message && <p role="alert" className="text-xs text-rose-300">{message}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setConfirmDelete(false); mutation.reset(); }}>Cancelar</Button>
        <Button size="sm" variant="danger" disabled={busy}
          onClick={() => mutation.mutate({ kind: "delete" })}>{busy ? "Removendo…" : "Remover"}</Button>
      </div>
    </div> : <form className="space-y-3 p-4" onSubmit={event => {
      event.preventDefault();
      if (!busy) mutation.mutate({ kind: "save" });
    }}>
      <label htmlFor="manual-supplier-name" className="block text-xs font-semibold text-slate-200">Nome do fornecedor</label>
      <input id="manual-supplier-name" autoFocus type="text" required maxLength={160} value={supplier}
        disabled={busy} onChange={event => { setSupplier(event.target.value); mutation.reset(); }}
        className="h-9 w-full rounded-md border border-slate-600 bg-[#101e30] px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-sky-300" />
      {message && <p role="alert" className="text-xs text-rose-300">{message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing && target.mode === "edit" && <Button type="button" size="sm" variant="danger" disabled={busy}
          onClick={() => { setConfirmDelete(true); mutation.reset(); }}><Trash2 size={13} aria-hidden="true" />Remover</Button>}
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={busy || !supplier.trim()}>
            {busy ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </div>
    </form>}
  </dialog>;
}

function AppointmentDetailsDialog({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const query = useQuery({
    queryKey: ["conference", "detail", appointmentId],
    queryFn: () => getStoreAppointmentDetail(appointmentId),
    staleTime: 10_000, refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const show = (value: string | null | undefined) => value === null || value === undefined || value === "" ? "-" : value;
  const item: StoreAppointmentDetail | undefined = query.data;
  return <dialog ref={ref} aria-labelledby="appointment-details-heading"
    onCancel={event => { if (query.isPending) { event.preventDefault(); return; } onClose(); }}
    onClick={event => { if (event.target === ref.current && !query.isPending) onClose(); }}
    className="m-auto max-h-[min(92dvh,860px)] w-[min(94vw,640px)] overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Recebimento</p>
        <h2 id="appointment-details-heading" className="text-base font-bold">Detalhes do agendamento</h2>
      </div>
      <Button aria-label="Fechar detalhes" size="icon" variant="secondary" onClick={onClose}><X size={16} /></Button>
    </div>
    <div className="space-y-4 p-4">
      {query.isPending && <p role="status" className="text-sm text-slate-300">Carregando detalhes…</p>}
      {query.isError && <div role="alert" className="space-y-2">
        <p className="text-sm text-rose-300">Não foi possível carregar os detalhes.</p>
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>}
      {item && <>
        <dl aria-label="Dados do agendamento" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            ["Horário", `${item.startTime} - ${item.endTime}`],
            ["Protocolo", item.protocol],
            ["Fornecedor", item.supplier],
            ["Status", displayStatus(item.status, item.observation)],
            ["Obs.", show(item.observation)],
            ["Tipo", show(item.type)],
            ["Itens", show(item.items)],
            ["Volumes", show(item.volumes)],
            ["Paletes", show(item.pallets)],
            ["Carga batida", show(item.cargaBatida)],
          ] as const).map(([label, value]) => <div key={label} className="rounded-md border border-[#37516b] bg-[#20334c] p-2">
            <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="break-words text-xs text-white">{value}</dd>
          </div>)}
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["NF-e", item.nfe], ["Pedidos", item.orders]] as const).map(([title, values]) => <section key={title}
            aria-label={title} className="rounded-md border border-[#37516b] bg-[#20334c] p-3">
            <h3 className="text-xs font-semibold text-slate-100">{title}</h3>
            {values.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
              {values.map(value => <li key={value}>{value}</li>)}
            </ul> : <p className="mt-1 text-[11px] text-slate-400">{title === "NF-e" ? "Nenhuma NF-e informada." : "Nenhum pedido informado."}</p>}
          </section>)}
        </div>
        <section aria-label="Histórico de alterações" className="rounded-md border border-[#37516b] bg-[#20334c] p-3">
          <h3 className="text-xs font-semibold text-slate-100">Histórico de alterações</h3>
          {item.history.length ? <ul className="mt-1 space-y-1.5">
            {item.history.map(entry => <li key={entry.id} className="text-xs text-slate-300">
              <strong className="block text-white">
                {displayStatus(entry.statusAnterior)} → {displayStatus(entry.statusNovo, entry.observation)}
              </strong>
              <span className="text-[11px] text-slate-400">{entry.usuario.nome}</span>
              {entry.observation && <span className="block text-[11px] text-amber-200">Obs.: {entry.observation}</span>}
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-400">Nenhuma alteração de status registrada.</p>}
        </section>
      </>}
    </div>
  </dialog>;
}

function AppointmentRow({ item, readOnly, day, onUpdated, tags, availableTags, tagsReady, onTagsUpdated, onEditManual, onOpenDetails }: {
  item: StoreAppointment; readOnly:boolean; day:string; onUpdated:()=>Promise<void>;
  tags:Tag[]; availableTags:Tag[]; tagsReady:boolean; onTagsUpdated:()=>Promise<void>;
  onEditManual:(item:StoreAppointment)=>void; onOpenDetails:(id:string)=>void;
}) {
  const [reasonOpen,setReasonOpen]=useState(false);
  const [tagsOpen,setTagsOpen]=useState(false);
  const [noteOpen,setNoteOpen]=useState(false);
  const [reason,setReason]=useState("");
  const [other,setOther]=useState("");
  const [note,setNote]=useState("");
  const [noteCustom,setNoteCustom]=useState("");
  const [noteError,setNoteError]=useState("");
  const patch=useMutation({
    mutationFn: async (change: {kind:"status";status:StoreAppointment["status"];observation:string|null} | {kind:"exchanges";hasExchanges:boolean} | {kind:"observation";observation:string|null}) => {
      if (change.kind === "status") return patchStoreStatus(item.id,change.status,change.observation);
      if (change.kind === "exchanges") return patchStoreExchanges(item.id,change.hasExchanges);
      return patchStoreObservation(item.id,change.observation);
    },
    onSuccess:async()=>{await onUpdated();setReasonOpen(false);setReason("");setOther("");setNoteOpen(false);setNoteError("");},
  });
  const inactive = readOnly || patch.isPending;
  const changeStatus=(status:"recebido"|"nao_chegou")=>{
    if(inactive)return;
    const next=item.status===status?"aguardando":status;
    if(next==="nao_chegou"){setReasonOpen(true);return;}
    patch.mutate({kind:"status",status:next,observation:null});
  };
  const sendReason=()=>{
    const value=reason==="Outros"? (other.trim() ? "Outros: "+other.trim():"") :reason;
    if(!value || value.length>250)return;
    patch.mutate({kind:"status",status:"nao_chegou",observation:value});
  };
  const openNote=()=>{
    if(inactive)return;
    const current=item.observation ?? "";
    const preset=reasonOptions.find(value=>value===current);
    setNote(preset ?? (current.startsWith("Outros: ")?"Outros":""));
    setNoteCustom(current.startsWith("Outros: ")?current.slice(8):"");
    setNoteOpen(true);
    setNoteError("");
    patch.reset();
  };
  const sendNote=()=>{
    if(inactive)return;
    const required=item.status==="nao_chegou";
    const value=note==="Outros"?"Outros: "+noteCustom.trim().replace(/\s+/g," "):note;
    if(note==="Outros"&&!noteCustom.trim()){setNoteError("Descreva o motivo personalizado.");return;}
    if(value.length>250){setNoteError("A observação deve ter até 250 caracteres.");return;}
    if(required&&!value){setNoteError("Selecione um motivo para Não recebido.");return;}
    patch.mutate({kind:"observation",observation:value||null});
  };
  return <article data-testid={`conference-row-${item.id}`} className="space-y-2 rounded-lg border border-[#36516d] bg-[#1a2c41] p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <strong className="block break-words text-xs text-slate-50">{item.supplier}</strong>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span>Protocolo: {item.protocol}</span>
          <span>{item.startTime}{item.endTime ? "–"+item.endTime : ""}</span>
          <span>{item.type}</span>
        </div>
        {item.observation && <p className="mt-1 text-[11px] text-amber-300">Obs.: {item.observation}</p>}
        {item.origin==="manual" && <span className="mt-1 block text-[10px] text-sky-300">Fornecedor sem agenda</span>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={"Tags de " + item.supplier}>
          {tags.map(tag => <TagChip key={tag.id} tag={tag} />)}
          {!readOnly && <Button size="sm" variant="ghost" className="h-7 border border-dashed border-slate-500 text-[11px]"
            disabled={!tagsReady} onClick={() => setTagsOpen(value => !value)}>{tagsOpen ? "Fechar tags" : "+ Tag"}</Button>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusBadge tone={item.status==="recebido"?"success":item.status==="nao_chegou"||item.status==="recusado"?"danger":"warning"}>
          {displayStatus(item.status,item.observation)}
        </StatusBadge>
        {readOnly && <Button size="sm" variant="secondary" aria-label={`Detalhes de ${item.supplier}`}
          onClick={() => onOpenDetails(item.id)}>Ver detalhes</Button>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-[#36516d] pt-2">
      {!readOnly && <>
        <Button size="sm" variant={item.status==="recebido"?"default":"secondary"} disabled={inactive}
          aria-pressed={item.status==="recebido"} onClick={()=>changeStatus("recebido")}>
          {item.status==="recebido"?"Desmarcar recebido":"Recebido"}
        </Button>
        <Button size="sm" variant={item.status==="nao_chegou"?"danger":"secondary"} disabled={inactive}
          aria-pressed={item.status==="nao_chegou"} onClick={()=>changeStatus("nao_chegou")}>
          {item.status==="nao_chegou"?"Desmarcar não recebido":"Não recebido"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={inactive}
          aria-label={`Observação de ${item.supplier}`} onClick={openNote}>
          {item.observation ? "Editar observação" : "+ Obs."}
        </Button>
        {item.origin==="manual" && <Button size="sm" variant="secondary" className="h-7 text-[11px]" disabled={inactive}
          aria-label={`Editar fornecedor ${item.supplier}`} onClick={() => onEditManual(item)}>
          <Pencil size={12} aria-hidden="true" />Editar fornecedor
        </Button>}
      </>}
      <label className="inline-flex items-center gap-2 text-[11px] text-slate-200">
        <input aria-label={`Trocas de ${item.supplier}`} type="checkbox" className="size-4 accent-sky-500"
          checked={item.hasExchanges} disabled={inactive}
          onChange={event=>patch.mutate({kind:"exchanges",hasExchanges:event.target.checked})}/>Trocas
      </label>
    </div>
    {tagsOpen && !readOnly && <TagPicker key={item.id} appointmentId={item.id} supplier={item.supplier}
      choices={availableTags} assigned={tags} onSaved={onTagsUpdated} onCancel={() => setTagsOpen(false)} />}
    {patch.isError && <p role="alert" className="text-xs text-rose-300">{errorText(patch.error)}</p>}
    {reasonOpen && !readOnly && <section aria-label={`Motivo de ${item.supplier}`} className="space-y-2 rounded-lg border border-amber-500/40 bg-[#20334a] p-3">
      <label className="block text-xs text-slate-200">Motivo obrigatório
        <select aria-label={`Motivo de ${item.supplier}`} value={reason} onChange={event=>setReason(event.target.value)}
          className="mt-1 block h-9 w-full rounded-md border border-[#46647c] bg-[#101e30] px-2 text-xs">
          <option value="">Selecione o motivo</option>
          {reasonOptions.map(value=><option key={value}>{value}</option>)}
          <option value="Outros">Personalizado</option>
        </select>
      </label>
      {reason==="Outros" && <label className="block text-xs text-slate-200">Descreva o motivo
        <textarea maxLength={242} rows={2} value={other} onChange={event=>setOther(event.target.value)}
          className="mt-1 block w-full rounded-md border border-[#46647c] bg-[#101e30] p-2 text-xs"/>
      </label>}
      <div className="flex gap-2">
        <Button size="sm" disabled={patch.isPending||!reason||(reason==="Outros"&&!other.trim())} onClick={sendReason}>Confirmar motivo</Button>
        <Button size="sm" variant="secondary" disabled={patch.isPending} onClick={()=>{setReasonOpen(false);setReason("");setOther("");}}>Cancelar</Button>
      </div>
    </section>}
    {noteOpen && !readOnly && <section aria-label={`Observação de ${item.supplier}`} className="space-y-2 rounded-lg border border-sky-500/40 bg-[#203650] p-3">
      <p className="text-xs font-semibold text-slate-100">
        Observação — {item.supplier} <span className="font-normal text-slate-400">({item.status==="nao_chegou"?"obrigatória":"opcional"})</span>
      </p>
      <label className="block text-xs text-slate-200">Motivo
        <select aria-label={`Editar observação de ${item.supplier}`} value={note} disabled={inactive}
          onChange={event=>{setNote(event.target.value);setNoteError("");}}
          className="mt-1 block h-9 w-full rounded-md border border-[#46647c] bg-[#101e30] px-2 text-xs">
          <option value="">Sem observação</option>
          {reasonOptions.map(value=><option key={value}>{value}</option>)}
          <option value="Outros">Personalizado</option>
        </select>
      </label>
      {note==="Outros" && <label className="block text-xs text-slate-200">Descreva o motivo
        <textarea maxLength={242} rows={2} value={noteCustom} disabled={inactive}
          onChange={event=>{setNoteCustom(event.target.value);setNoteError("");}}
          className="mt-1 block w-full rounded-md border border-[#46647c] bg-[#101e30] p-2 text-xs"/>
      </label>}
      {noteError && <p role="alert" className="text-xs text-rose-300">{noteError}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={inactive} onClick={sendNote}>{patch.isPending?"Salvando…":"Confirmar"}</Button>
        <Button size="sm" variant="secondary" disabled={inactive} onClick={()=>{setNoteOpen(false);setNoteError("");}}>Cancelar</Button>
      </div>
    </section>}
    {day && <span className="sr-only">Agenda de {day}</span>}
  </article>;
}

export function ConferencePage(){
  const client=useQueryClient();
  const [today,setToday]=useState(()=>businessToday());
  const [date,setDate]=useState(today);
  const [search,setSearch]=useState("");
  const [confirmComplete,setConfirmComplete]=useState(false);
  const [manualTarget,setManualTarget]=useState<{mode:"create"}|{mode:"edit";item:StoreAppointment}|null>(null);
  const [detailsId,setDetailsId]=useState<string|null>(null);
  useStoreRealtime(date);
  useEffect(()=>{
    const check=()=>{
      const next=businessToday();
      if(next===today)return;
      setDate(current=>current===today?next:current);
      setToday(next);
    };
    const timer=window.setInterval(check,30000);
    window.addEventListener("focus",check);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",check);};
  },[today]);
  const query=useQuery({
    queryKey:["conference","agenda",date,today],
    queryFn:()=>loadStoreAgenda(date,today),
    refetchInterval:30000, refetchOnWindowFocus:true,
  });
  const refresh=async()=>{await client.invalidateQueries({queryKey:["conference","agenda"]});};
  const complete=useMutation({
    mutationFn:()=>completeStoreDay(date),
    onSuccess:async()=>{setConfirmComplete(false);await refresh();},
  });
  const agenda=query.data?.agenda;
  const tagsQuery=useQuery({ queryKey:["store-tags","agenda",date], queryFn:()=>getAssignedTags(date), enabled:Boolean(agenda) });
  const refreshTags=async()=>{await client.invalidateQueries({queryKey:["store-tags","agenda",date]});};
  const appointments=query.data?.appointments??[];
  const metrics=metricValues(appointments);
  const filtered=useMemo(()=>filterAppointments(appointments,search),[appointments,search]);
  const readOnly=agenda?.dayStatus!=="aberto";
  const changeDate=(next:string)=>{setDate(next);setSearch("");setConfirmComplete(false);setManualTarget(null);setDetailsId(null);};
  const pct=(count:number)=>metrics.total?Math.round(count/metrics.total*100):0;

  return <section aria-label="Conferência" className="mx-auto max-w-[1430px] space-y-4">
    <PageHeader eyebrow="Operação da loja" title="Conferência de recebimentos"
      description="Consulte os fornecedores, atualize o recebimento e acompanhe a operação por data."
      actions={<div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-md border border-[#45617c] bg-[#1b3047]">
          <button className="grid size-9 place-items-center" aria-label="Dia anterior" onClick={()=>changeDate(shiftDay(date,-1))}><ChevronLeft size={17}/></button>
          <label className="flex items-center gap-1 border-x border-[#45617c] px-2 text-xs text-slate-200">
            <CalendarDays size={14} aria-hidden="true"/>
            <input aria-label="Data da conferência" type="date" className="w-[121px] bg-transparent text-xs [color-scheme:dark]" value={date}
              onChange={event=>{if(event.target.value)changeDate(event.target.value);}}/>
          </label>
          <button className="grid size-9 place-items-center" aria-label="Dia seguinte" onClick={()=>changeDate(shiftDay(date,1))}><ChevronRight size={17}/></button>
        </div>
        {date!==today && <Button size="sm" variant="secondary" onClick={()=>changeDate(today)}>Hoje</Button>}
        <Button size="sm" variant="secondary" disabled={query.isFetching} onClick={()=>void refresh()}><RefreshCw size={14}/>{query.isFetching?"Atualizando…":"Atualizar"}</Button>
      </div>}/>
    {query.isPending && <p role="status" className="rounded-lg border border-[#36516d] p-4 text-sm text-slate-300">Carregando agenda…</p>}
    {query.isError && <div role="alert" className="rounded-lg border border-rose-500/40 p-4 text-xs text-rose-200">
      Não foi possível carregar a agenda. <Button size="sm" variant="secondary" onClick={()=>void query.refetch()}>Tentar novamente</Button>
    </div>}
    {!query.isPending && !query.isError && !agenda && <div className="rounded-xl border border-[#36516d] bg-[#192c41] p-6 text-sm">
      <strong>Nenhuma agenda em {formatDay(date)}.</strong>
      <p className="mt-2 text-xs text-slate-400">A agenda aparecerá depois que o administrador importar o arquivo.</p>
    </div>}
    {agenda && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{agenda.storeCode} — {agenda.storeName} · {formatDay(date)}</span>
        <StatusBadge tone={readOnly?"success":"warning"}>{readOnly?"Dia concluído":"Em aberto"}</StatusBadge>
      </div>
      <div aria-label="Resumo da agenda" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {([
          ["Total",metrics.total,CalendarDays],
          ["Aguardando",metrics.aguardando,Clock3],
          ["Recebidos",metrics.recebido,CheckCircle2],
          ["Não recebidos",metrics.naoChegou,Ban],
          ["Trocas",metrics.trocas,ArrowLeftRight],
        ] as const).map(([label,value,Icon])=><div key={label} className="flex min-h-[88px] items-center gap-2 rounded-lg border border-[#36516d] bg-[#1a2c41] p-3">
          <Icon size={20} className="shrink-0 text-sky-300"/>
          <div><span className="block text-[11px] text-slate-300">{label}</span>
            <strong className="block text-xl font-bold text-white tabular-nums">{value}</strong>
            <small className="text-[10px] text-slate-400">{label==="Total"?"100% do dia":pct(value)+"%"}</small>
          </div>
        </div>)}
      </div>
      <section className="space-y-3 rounded-xl border border-[#36516d] bg-[#142438] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-bold text-white">Agenda do dia</h2>
            <p className="text-xs text-slate-400">Fornecedores agendados para recebimento.</p></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="relative min-w-0">
              <Search aria-hidden="true" size={14} className="absolute top-2.5 left-2 text-slate-400"/>
              <input aria-label="Pesquisar fornecedor ou protocolo" type="search" placeholder="Pesquisar fornecedor ou protocolo"
                className="h-9 w-full rounded-md border border-[#3e5874] bg-[#101e30] pr-2 pl-7 text-xs text-white sm:w-56"
                value={search} onChange={event=>setSearch(event.target.value)}/>
            </label>
            {!readOnly && <Button size="sm" variant="secondary"
              onClick={()=>setManualTarget({mode:"create"})}><Plus size={13}/>Fornecedor sem agenda</Button>}
          </div>
        </div>
        <div className="grid gap-2" aria-label="Fornecedores">
          {tagsQuery.isError && <p role="alert" className="text-xs text-amber-300">Tags indisponíveis. Os demais controles da conferência continuam disponíveis.</p>}
          {filtered.map(item=><AppointmentRow key={item.id} item={item} day={date} readOnly={readOnly||complete.isPending}
            tags={tagsQuery.data?.assignments[item.id] ?? []} availableTags={tagsQuery.data?.tags ?? []} tagsReady={Boolean(tagsQuery.data) && !tagsQuery.isError}
            onUpdated={refresh} onTagsUpdated={refreshTags}
            onEditManual={item2=>setManualTarget({mode:"edit",item:item2})} onOpenDetails={setDetailsId}/> )}
          {filtered.length===0 && <p role="status" className="p-4 text-center text-xs text-slate-400">Nenhum fornecedor ou protocolo encontrado.</p>}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={()=>downloadAgendaPdf(agenda,appointments)}>
          <FileDown size={14}/>Exportar PDF
        </Button>
        {!readOnly && <Button size="sm" disabled={complete.isPending} onClick={()=>setConfirmComplete(true)}>Concluir dia</Button>}
      </div>
      {confirmComplete && !readOnly && <section aria-label="Confirmar conclusão do dia" className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <strong className="text-sm text-amber-100">Concluir a agenda de {formatDay(date)}?</strong>
        <p className="text-xs text-slate-300">Após a conclusão, os registros não poderão mais ser editados pelo conferente.</p>
        {complete.isError && <p role="alert" className="text-xs text-rose-200">{errorText(complete.error)}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={complete.isPending} onClick={()=>complete.mutate()}>{complete.isPending?"Concluindo…":"Confirmar conclusão"}</Button>
          <Button size="sm" variant="secondary" disabled={complete.isPending} onClick={()=>setConfirmComplete(false)}>Cancelar</Button>
        </div>
      </section>}
      {manualTarget && <ManualSupplierDialog target={manualTarget} date={date} onClose={()=>setManualTarget(null)}
        onSaved={async()=>{setSearch("");await refresh();}}
        onDeleted={async()=>{setSearch("");await refresh();}}/>}
      {detailsId && <AppointmentDetailsDialog appointmentId={detailsId} onClose={()=>setDetailsId(null)}/>}
    </>}
  </section>;
}
