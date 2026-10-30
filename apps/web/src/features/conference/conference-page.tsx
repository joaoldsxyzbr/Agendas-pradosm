import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search, ArrowLeftRight, Ban, FileDown, Plus } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatDay } from "@/features/receiving/model";
import { businessToday, shiftDay, loadStoreAgenda, filterAppointments, metricValues,
  patchStoreExchanges, patchStoreStatus, completeStoreDay, type StoreAppointment } from "./model";

const reasonOptions = ["Sem agenda", "Sem pedido", "Sem boleto", "Prazo de pagamento incorreto", "Temperatura acima do OK", "Não veio"];
const statusLabels = { aguardando:"Aguardando", recebido:"Recebido", nao_chegou:"Não recebido", recusado:"Recusado" };
function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível salvar. Atualize a agenda e tente novamente.";
}

function AppointmentRow({ item, readOnly, day, onUpdated }: {
  item: StoreAppointment; readOnly:boolean; day:string; onUpdated:()=>Promise<void>;
}) {
  const [reasonOpen,setReasonOpen]=useState(false);
  const [reason,setReason]=useState("");
  const [other,setOther]=useState("");
  const patch=useMutation({
    mutationFn: async (change: {kind:"status";status:StoreAppointment["status"];observation:string|null} | {kind:"exchanges";hasExchanges:boolean}) => {
      if (change.kind === "status") return patchStoreStatus(item.id,change.status,change.observation);
      return patchStoreExchanges(item.id,change.hasExchanges);
    },
    onSuccess:async()=>{await onUpdated();setReasonOpen(false);setReason("");setOther("");},
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
      </div>
      <StatusBadge tone={item.status==="recebido"?"success":item.status==="nao_chegou"||item.status==="recusado"?"danger":"warning"}>
        {statusLabels[item.status]}
      </StatusBadge>
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
      </>}
      <label className="inline-flex items-center gap-2 text-[11px] text-slate-200">
        <input aria-label={`Trocas de ${item.supplier}`} type="checkbox" className="size-4 accent-sky-500"
          checked={item.hasExchanges} disabled={inactive}
          onChange={event=>patch.mutate({kind:"exchanges",hasExchanges:event.target.checked})}/>Trocas
      </label>
    </div>
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
    {day && <span className="sr-only">Agenda de {day}</span>}
  </article>;
}

export function ConferencePage(){
  const client=useQueryClient();
  const [today,setToday]=useState(()=>businessToday());
  const [date,setDate]=useState(today);
  const [search,setSearch]=useState("");
  const [confirmComplete,setConfirmComplete]=useState(false);
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
  const appointments=query.data?.appointments??[];
  const metrics=metricValues(appointments);
  const filtered=useMemo(()=>filterAppointments(appointments,search),[appointments,search]);
  const readOnly=agenda?.dayStatus!=="aberto";
  const changeDate=(next:string)=>{setDate(next);setSearch("");setConfirmComplete(false);};
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
            <Button size="sm" variant="secondary" disabled title="Fornecedor manual será migrado na próxima etapa"><Plus size={13}/>Fornecedor sem agenda</Button>
          </div>
        </div>
        <div className="grid gap-2" aria-label="Fornecedores">
          {filtered.map(item=><AppointmentRow key={item.id} item={item} day={date} readOnly={readOnly||complete.isPending} onUpdated={refresh}/>)}
          {filtered.length===0 && <p role="status" className="p-4 text-center text-xs text-slate-400">Nenhum fornecedor ou protocolo encontrado.</p>}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="secondary" disabled title="Exportação em PDF ainda disponível somente na aplicação operacional"><FileDown size={14}/>Exportar PDF</Button>
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
      <p className="text-[11px] text-slate-500">Em migração: edição de tags, fornecedores manuais, observações e exportação PDF permanecem na versão operacional.</p>
    </>}
  </section>;
}
