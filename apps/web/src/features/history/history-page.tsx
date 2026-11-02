import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, X } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatDay, type AgendaDetail } from "@/features/receiving/model";
import {
  changeAppointmentExchanges, changeAppointmentStatus, getAgendaDetail, getStores,
  historyAgendasKey, historyDayEventsKey, historyDetailKey, historyStatusEventsKey,
  listDayEvents, listHistoryAgendas, listStatusEvents, reopenAgenda,
  type AppointmentStatus,
} from "./api";

type Appointment = AgendaDetail["appointments"][number];

const surface = "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#344d69] bg-[#142338] shadow-lg";
const input = "h-9 min-w-0 w-full rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400";
const statusLabels: Record<string, string> = {
  aguardando: "Aguardando", recebido: "Recebido", nao_chegou: "Não recebido", recusado: "Recusado",
};
const dayActionLabels: Record<string, string> = {
  concluido: "Dia concluído", reaberto: "Dia reaberto", concluido_automaticamente: "Dia concluído automaticamente",
};
// Mesmos motivos do contrato em shared/observations.js; a validação continua no Worker.
const reasons = [
  "Sem agenda", "Sem pedido", "Sem boleto", "Prazo de pagamento incorreto",
  "Temperatura acima do OK", "Não veio",
] as const;
const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback;

function DayEvents({ events }: { events: { id: string; action: string; details?: string | null; changedAt: string; user: { name: string } | null }[] }) {
  if (!events.length) return <p className="text-xs text-slate-400">Nenhum evento registrado para o dia.</p>;
  return <ol className="space-y-2">{events.map(event => <li key={event.id} className="text-xs">
    <strong className="block text-slate-100">{dayActionLabels[event.action] ?? "Ajuste administrativo"}</strong>
    <span className="block text-slate-400">
      {event.user?.name ?? "Sistema"} · {new Date(event.changedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
      {event.details ? ` · ${event.details}` : ""}
    </span>
  </li>)}</ol>;
}

function StatusEvents({ events }: {
  events: { id: string; statusAnterior: string; statusNovo: string; observation: string | null; alteradoEm: string; usuario: { nome: string } }[];
}) {
  if (!events.length) return <p className="text-xs text-slate-400">Nenhuma alteração registrada.</p>;
  return <ol className="space-y-2">{events.map(event => <li key={event.id} className="text-xs">
    <strong className="block text-slate-100">
      {statusLabels[event.statusAnterior] ?? event.statusAnterior} → {statusLabels[event.statusNovo] ?? event.statusNovo}
    </strong>
    <span className="block text-slate-400">{event.usuario.nome} · {new Date(event.alteradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
    {event.observation && <span className="block text-slate-300">Obs.: {event.observation}</span>}
  </li>)}</ol>;
}

/** Motivo obrigatório para Não recebido, seguindo o diálogo legado da tela de Histórico. */
function ReasonDialog({ supplier, busy, error, onConfirm, onClose }: {
  supplier: string;
  busy: boolean;
  error: string;
  onConfirm: (observation: string) => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [formError, setFormError] = useState("");
  useEffect(() => {
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = reason === "Outros"
      ? (custom.trim() ? "Outros: " + custom.trim().replace(/\s+/g, " ") : "")
      : reason;
    if (!note || note.length > 250) {
      setFormError(note ? "A observação deve ter até 250 caracteres." : "Selecione um motivo ou preencha o motivo personalizado.");
      return;
    }
    onConfirm(note);
  };
  return <dialog ref={modalRef} aria-label={`Motivo de não recebimento de ${supplier}`}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}
    className="fixed inset-0 m-auto max-h-[90vh] w-[min(460px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#48617b] bg-[#142338] p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75">
    <div className="flex items-start justify-between gap-3 border-b border-[#344d69] px-5 py-4">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Não recebido</p>
        <h2 className="mt-1 text-lg font-bold">Motivo de não recebimento</h2>
        <p className="mt-1 break-words text-xs text-slate-400">{supplier}</p></div>
      <Button size="icon" variant="ghost" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></Button>
    </div>
    <form onSubmit={submit} className="space-y-4 p-5">
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Motivo (obrigatório)
        <select autoFocus className={input} value={reason} disabled={busy}
          onChange={event => { setReason(event.target.value); setFormError(""); }}>
          <option value="">Selecione um motivo</option>
          {reasons.map(item => <option key={item} value={item}>{item}</option>)}
          <option value="Outros">Personalizado</option>
        </select>
      </label>
      {reason === "Outros" && <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Descreva o motivo
        <textarea rows={2} maxLength={242} required className={input + " h-auto py-2"} disabled={busy} value={custom}
          onChange={event => { setCustom(event.target.value); setFormError(""); }} />
      </label>}
      {(formError || error) && <p role="alert" className="text-xs text-rose-300">{formError || error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Confirmar"}</Button>
      </div>
    </form>
  </dialog>;
}

function AppointmentControls({ item, busy, onStatus, onExchanges }: {
  item: Appointment;
  busy: boolean;
  onStatus: (item: Appointment, value: string) => void;
  onExchanges: (item: Appointment, value: boolean) => void;
}) {
  return <div className="flex min-w-0 items-center gap-2">
    <select aria-label={`Status de ${item.supplier}`} className={input + " max-w-[130px]"} value={item.status}
      disabled={busy} onChange={event => onStatus(item, event.target.value)}>
      {Object.entries(statusLabels).map(([value, label]) =>
        <option key={value} value={value}>{label}</option>)}
    </select>
    <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-200">
      <input type="checkbox" aria-label={`Trocas de ${item.supplier}`} checked={Boolean(item.hasExchanges)}
        disabled={busy} onChange={event => onExchanges(item, event.target.checked)}
        className="size-4 accent-sky-500" />Trocas
    </label>
  </div>;
}

export function HistoryPage() {
  const [storeCode, setStoreCode] = useState("");
  const [date, setDate] = useState("");
  const [filters, setFilters] = useState<{ storeCode: string; date: string } | null>(null);
  const [agendaId, setAgendaId] = useState<string | null>(null);
  const [statusAppointmentId, setStatusAppointmentId] = useState<string | null>(null);
  const [reasonAppointment, setReasonAppointment] = useState<Appointment | null>(null);
  const [mutationError, setMutationError] = useState("");
  const client = useQueryClient();

  const stores = useQuery({ queryKey: ["admin", "stores"], queryFn: getStores });
  const agendas = useQuery({
    queryKey: [...historyAgendasKey, filters?.storeCode ?? "", filters?.date ?? ""],
    queryFn: () => listHistoryAgendas(filters!.storeCode, filters!.date),
    enabled: filters !== null,
  });
  const detail = useQuery({
    queryKey: [...historyDetailKey, agendaId],
    queryFn: () => getAgendaDetail(agendaId!),
    enabled: Boolean(agendaId),
  });
  const dayEvents = useQuery({
    queryKey: [...historyDayEventsKey, agendaId],
    queryFn: () => listDayEvents(agendaId!),
    enabled: Boolean(agendaId),
  });
  const statusEvents = useQuery({
    queryKey: [...historyStatusEventsKey, statusAppointmentId],
    queryFn: () => listStatusEvents(statusAppointmentId!),
    enabled: Boolean(statusAppointmentId),
  });

  const refreshDetail = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...historyDetailKey, agendaId] }),
      client.invalidateQueries({ queryKey: [...historyDayEventsKey, agendaId] }),
      client.invalidateQueries({ queryKey: [...historyStatusEventsKey, statusAppointmentId] }),
    ]);
  };
  const status = useMutation({
    mutationFn: ({ id, value, observation }: { id: string; value: AppointmentStatus; observation: string | null }) =>
      changeAppointmentStatus(id, value, observation),
    onSuccess: async () => { setMutationError(""); setReasonAppointment(null); await refreshDetail(); },
    onError: error => setMutationError(errorText(error, "Não foi possível alterar o status.")),
  });
  const exchanges = useMutation({
    mutationFn: ({ id, hasExchanges }: { id: string; hasExchanges: boolean }) =>
      changeAppointmentExchanges(id, hasExchanges),
    onSuccess: async () => { setMutationError(""); await refreshDetail(); },
    onError: error => setMutationError(errorText(error, "Não foi possível alterar a marcação de trocas.")),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => reopenAgenda(id),
    onSuccess: async () => {
      setMutationError("");
      await Promise.all([
        client.invalidateQueries({ queryKey: historyAgendasKey }),
        refreshDetail(),
      ]);
    },
    onError: error => setMutationError(errorText(error, "Não foi possível reabrir o dia.")),
  });

  const busy = status.isPending || exchanges.isPending || reopen.isPending;
  const selectStatus = (item: Appointment, value: string) => {
    if (busy) return;
    if (value === "nao_chegou" && item.status !== "nao_chegou") {
      setMutationError("");
      setReasonAppointment(item); // Motivo obrigatório: sem gravação antes da confirmação.
      return;
    }
    status.mutate({ id: item.id, value: value as AppointmentStatus, observation: null });
  };
  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAgendaId(null);
    setStatusAppointmentId(null);
    setMutationError("");
    setFilters({ storeCode, date });
  };

  const rows = agendas.data ?? [];
  const agenda = detail.data?.agenda;
  const appointments = detail.data?.appointments ?? [];

  return <section className="mx-auto w-full min-w-0 max-w-[1450px] overflow-x-clip space-y-5" aria-label="Histórico de agendas">
    <PageHeader eyebrow="Administração" title="Histórico"
      description="Consulte agendas anteriores e a trilha de alterações de status." />
    <form onSubmit={submitFilters} aria-label="Filtros do histórico"
      className={surface + " flex min-w-0 flex-wrap items-end gap-3 p-4"}>
      <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold text-slate-300 sm:max-w-xs">Loja
        <select className={input} value={storeCode} onChange={event => setStoreCode(event.target.value)}>
          <option value="">Todas</option>
          {(stores.data ?? []).map(store =>
            <option key={store.id} value={store.codigo}>{store.codigo} - {store.nome}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">Data
        <input type="date" className={input} value={date} onChange={event => setDate(event.target.value)} />
      </label>
      <Button type="submit" disabled={agendas.isFetching}>{agendas.isFetching ? "Consultando…" : "Filtrar"}</Button>
    </form>
    {stores.isError && <p role="alert" className="text-xs text-rose-300">Não foi possível carregar as lojas.</p>}
    {mutationError && <p role="alert" className="text-xs text-rose-300">{mutationError}</p>}

    <div className={surface}>
      {agendas.isPending && filters && <p role="status" className="p-5 text-xs text-slate-300">Consultando agendas…</p>}
      {agendas.isError && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-xs text-rose-300">
        Não foi possível consultar as agendas.
        <Button size="sm" variant="secondary" onClick={() => void agendas.refetch()}>Tentar novamente</Button>
      </div>}
      {filters && agendas.data && <>
        <div className="min-w-0 divide-y divide-[#344d69] sm:hidden" aria-label="Agendas no celular">
          {rows.map(row => <article key={row.id} data-testid={"mobile-history-" + row.storeCode}
            className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-xs text-white">{row.storeCode}</strong>
                <StatusBadge tone={row.dayStatus === "concluido" ? "success" : "warning"}>
                  {row.dayStatus === "concluido" ? "Concluído" : "Em aberto"}
                </StatusBadge>
              </div>
              <p className="mt-1 break-words text-xs text-slate-300">{row.date ? formatDay(row.date) : "—"} · {row.storeName ?? ""}</p>
              <p className="mt-1 text-[11px] text-slate-400">{row.total} agendamentos · {row.recebido} recebidos · {row.aguardando} aguardando</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setAgendaId(row.id); setStatusAppointmentId(null); }}>Abrir agenda</Button>
          </article>)}
          {!rows.length && <p className="p-5 text-center text-xs text-slate-400">Nenhuma agenda encontrada para os filtros.</p>}
        </div>
        <div className="hidden w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain sm:block">
          <table aria-label="Agendas do histórico" className="w-full min-w-[700px] border-collapse">
            <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Loja</th><th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Aguardando</th><th className="px-4 py-3">Recebidos</th>
              <th className="px-4 py-3">Status do dia</th><th className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody className="divide-y divide-[#344d69]">
              {rows.map(row => <tr key={row.id} data-testid={"history-" + row.storeCode} className="hover:bg-[#1c3047]">
                <td className="px-4 py-3 text-xs text-slate-200">{row.date ? formatDay(row.date) : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-200">{row.storeName ?? row.storeCode}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-200">{row.total}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-200">{row.aguardando}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-slate-200">{row.recebido}</td>
                <td className="px-4 py-3"><StatusBadge tone={row.dayStatus === "concluido" ? "success" : "warning"}>
                  {row.dayStatus === "concluido" ? "Concluído" : "Em aberto"}</StatusBadge></td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => { setAgendaId(row.id); setStatusAppointmentId(null); }}>Abrir agenda</Button>
                </td>
              </tr>)}
              {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">Nenhuma agenda encontrada para os filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
      {!filters && <p className="p-5 text-xs text-slate-400">Use os filtros para consultar agendas.</p>}
    </div>

    {agenda && <section aria-label="Detalhe da agenda" className={surface + " space-y-4 p-4 md:p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">{agenda.storeCode} - {agenda.storeName}</h2>
          <p className="mt-1 text-xs text-slate-400">{formatDay(agenda.date)}</p>
          <div className="mt-2"><StatusBadge tone={agenda.dayStatus === "concluido" ? "success" : "warning"}>
            {agenda.dayStatus === "concluido" ? "Concluído" : "Em aberto"}</StatusBadge></div>
        </div>
        <div className="flex items-center gap-2">
          {agenda.dayStatus === "concluido" && <Button variant="secondary" disabled={reopen.isPending}
            onClick={() => reopen.mutate(agenda.id)}>
            <RotateCcw size={14} aria-hidden="true" />{reopen.isPending ? "Reabrindo…" : "Reabrir para conferente"}
          </Button>}
          <Button size="icon" variant="secondary" aria-label="Atualizar agenda" disabled={detail.isFetching}
            onClick={() => void detail.refetch()}><RefreshCw size={15} /></Button>
        </div>
      </div>

      <div className="min-w-0 divide-y divide-[#344d69] sm:hidden" aria-label="Agendamentos no celular">
        {appointments.map(item => <article key={item.id} className="space-y-2 px-1 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-xs text-white">{item.startTime} - {item.endTime}</strong>
            <StatusBadge tone={item.status === "recebido" ? "success" : item.status === "aguardando" ? "warning" : "danger"}>
              {statusLabels[item.status] ?? item.status}
            </StatusBadge>
          </div>
          <p className="break-words text-xs text-slate-200">{item.supplier}</p>
          <p className="break-words text-[11px] text-slate-400">Protocolo {item.protocol}</p>
          <AppointmentControls item={item} busy={busy} onStatus={selectStatus}
            onExchanges={(appointment, value) => exchanges.mutate({ id: appointment.id, hasExchanges: value })} />
          <Button size="sm" variant="ghost" aria-label={`Ver histórico de ${item.supplier}`}
            onClick={() => setStatusAppointmentId(item.id)}>Ver histórico</Button>
        </article>)}
        {!appointments.length && <p className="py-4 text-center text-xs text-slate-400">Nenhum agendamento nesta agenda.</p>}
      </div>
      <div className="hidden w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain sm:block">
        <table aria-label="Agendamentos da agenda" className="w-full min-w-[760px] border-collapse">
          <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
            <th className="px-4 py-3">Horário</th><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Fornecedor</th>
            <th className="px-4 py-3">Status</th><th className="px-4 py-3">Trocas</th><th className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="divide-y divide-[#344d69]">
            {appointments.map(item => <tr key={item.id} data-testid={"history-appointment-" + item.protocol} className="hover:bg-[#1c3047]">
              <td className="px-4 py-3 text-xs text-slate-200">{item.startTime} - {item.endTime}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{item.protocol}</td>
              <td className="px-4 py-3 text-xs text-slate-200">{item.supplier}</td>
              <td className="px-4 py-3">
                <select aria-label={`Status de ${item.supplier}`} className={input + " max-w-[130px]"} value={item.status}
                  disabled={busy} onChange={event => selectStatus(item, event.target.value)}>
                  {Object.entries(statusLabels).map(([value, label]) =>
                    <option key={value} value={value}>{label}</option>)}
                </select>
              </td>
              <td className="px-4 py-3 text-center"><input type="checkbox" aria-label={`Trocas de ${item.supplier}`}
                checked={Boolean(item.hasExchanges)} disabled={busy}
                onChange={event => exchanges.mutate({ id: item.id, hasExchanges: event.target.checked })}
                className="size-4 accent-sky-500" /></td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="ghost" aria-label={`Ver histórico de ${item.supplier}`}
                  onClick={() => setStatusAppointmentId(item.id)}>Ver histórico</Button>
              </td>
            </tr>)}
            {!appointments.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum agendamento nesta agenda.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-[#344d69] bg-[#101e30] p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico do dia</h3>
        {dayEvents.isPending && <p role="status" className="text-xs text-slate-400">Carregando eventos…</p>}
        {dayEvents.isError && <p role="alert" className="text-xs text-rose-300">Não foi possível carregar os eventos do dia.</p>}
        {dayEvents.data && <DayEvents events={dayEvents.data} />}
      </div>

      {statusAppointmentId && <section aria-label="Histórico de status" className="rounded-lg border border-[#344d69] bg-[#101e30] p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico de status</h3>
        {statusEvents.isPending && <p role="status" className="text-xs text-slate-400">Carregando alterações…</p>}
        {statusEvents.isError && <p role="alert" className="text-xs text-rose-300">Não foi possível consultar o histórico de status.
          <Button size="sm" variant="secondary" onClick={() => void statusEvents.refetch()}>Tentar novamente</Button></p>}
        {statusEvents.data && <StatusEvents events={statusEvents.data} />}
      </section>}
    </section>}

    {reasonAppointment && <ReasonDialog supplier={reasonAppointment.supplier} busy={status.isPending}
      error={status.isError ? errorText(status.error, "Não foi possível alterar o status.") : ""}
      onConfirm={observation => status.mutate({ id: reasonAppointment.id, value: "nao_chegou", observation })}
      onClose={() => { setReasonAppointment(null); status.reset(); }} />}
  </section>;
}
