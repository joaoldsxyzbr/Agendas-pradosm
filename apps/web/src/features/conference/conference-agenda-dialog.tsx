import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Ban, CalendarDays, CheckCircle2, Clock3, FileDown, Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/operations/status-badge";
import { ApiError } from "@/lib/api";
import { formatDay } from "@/features/receiving/model";
import { AppointmentDetailsDialog, AppointmentRow, ManualSupplierDialog, type ConferenceApi } from "./conference-page";
import {
  filterAppointments, metricValues, nextAgendaSort, sortAppointments,
  type AgendaSort, type AgendaSortKey, type StoreAppointment,
} from "./model";
import {
  createAdminManual, deleteAdminManual, getAdminAppointmentDetail, loadAdminAgenda,
  patchAdminExchanges, patchAdminManual, patchAdminObservation, patchAdminStatus, reopenAdminAgenda,
} from "./admin-model";

// Mesmas colunas ordenáveis da tela de Conferência, com o mesmo ciclo de ordenação.
const sortableColumns: { key: AgendaSortKey; label: string; width: string }[] = [
  { key: "startTime", label: "Horário", width: "w-[96px]" },
  { key: "supplier", label: "Fornecedor", width: "" },
  { key: "status", label: "Status", width: "w-[116px]" },
];
const adminApi: ConferenceApi = {
  patchStatus: patchAdminStatus,
  patchExchanges: patchAdminExchanges,
  patchObservation: patchAdminObservation,
  patchManual: patchAdminManual,
  deleteManual: deleteAdminManual,
  getDetail: getAdminAppointmentDetail,
};
function operationError(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message
    : "Não foi possível concluir a operação. Atualize e tente novamente.";
}

// Popup "Ver detalhes" do admin: a própria tela de Conferência, carregada pelos
// endpoints administrativos da agenda da loja. Abre em modo consulta; o botão
// "Editar agenda" destrava as mesmas ações que o conferente tem na loja, com a
// mesma proteção contra alteração acidental. O visualizador nunca vê a edição.
export function ConferenceAgendaDialog({ agendaId, canEdit = false, onClose }: {
  agendaId: string;
  canEdit?: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AgendaSort>(null);
  const [editMode, setEditMode] = useState(false);
  const [reopenConfirmation, setReopenConfirmation] = useState(false);
  const [manualTarget, setManualTarget] = useState<{ mode: "create" } | { mode: "edit"; item: StoreAppointment; confirmDelete?: boolean } | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const query = useQuery({
    queryKey: ["conference", "admin-agenda", agendaId],
    queryFn: () => loadAdminAgenda(agendaId),
    refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
  const agendaQueryKey = ["conference", "admin-agenda", agendaId] as const;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: agendaQueryKey, exact: true });
    await client.invalidateQueries({ queryKey: ["receiving", "agendas"] });
  };
  const reopening = useMutation({
    mutationFn: () => reopenAdminAgenda(agendaId),
    onSuccess: async () => { setReopenConfirmation(false); await refresh(); },
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  const agenda = query.data?.agenda;
  const appointments = query.data?.appointments ?? [];
  const completed = agenda?.dayStatus === "concluido";
  const editable = canEdit && editMode;
  const busy = reopening.isPending || pdfBusy;
  // Linhas seguem o contrato da Conferência: só saem do modo consulta quando a
  // edição está ativa e o dia não está concluído.
  const rowsReadOnly = !editable || completed || reopening.isPending;
  const metrics = metricValues(appointments);
  const filtered = useMemo(() => filterAppointments(appointments, search), [appointments, search]);
  const sorted = useMemo(() => sortAppointments(filtered, sort), [filtered, sort]);
  const pct = (count: number) => metrics.total ? Math.round(count / metrics.total * 100) : 0;
  const exportPdf = async () => {
    if (!agenda || pdfBusy) return;
    setPdfError("");
    setPdfBusy(true);
    try {
      const { downloadAgendaPdf } = await import("./export-agenda-pdf");
      downloadAgendaPdf(agenda, appointments);
    } catch {
      setPdfError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setPdfBusy(false);
    }
  };

  return <dialog ref={ref} aria-labelledby="detail-heading" onClose={event => {
    if (!event.currentTarget.open) onClose();
  }} onClick={event => { if (event.target === ref.current && !busy) ref.current?.close(); }}
    onKeyDownCapture={event => {
      if (event.key === "Escape") {
        // Diálogos aninhados (fornecedor manual, detalhes do agendamento) tratam o
        // próprio Escape; o popup só reage quando é o modal do topo.
        const topmost = Array.from(document.querySelectorAll("dialog[open]")).pop();
        if (topmost !== ref.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        if (reopenConfirmation) { setReopenConfirmation(false); return; }
        ref.current?.close();
      }
    }}
    className="m-auto max-h-[min(94dvh,940px)] w-[min(96vw,1240px)] max-w-none overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Agenda por loja</p>
        <h2 id="detail-heading" className="truncate text-base font-bold">{agenda ? `Agenda ${agenda.storeCode} — ${agenda.storeName}` : "Detalhes da agenda"}</h2>
      </div>
      <Button aria-label="Fechar detalhes" size="icon" variant="secondary" disabled={busy}
        onClick={() => ref.current?.close()}><X size={17} /></Button>
    </div>
    <div className="space-y-3 p-3">
      {query.isPending && <Loading label="Carregando detalhes…" className="text-sm" />}
      {query.isError && <div role="alert" className="space-y-2">
        <p className="text-sm text-rose-300">Não foi possível carregar os detalhes da agenda.</p>
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>}
      {agenda && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-300">Data: <strong className="text-white">{formatDay(agenda.date)}</strong></span>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={completed ? "success" : "warning"}>{completed ? "Concluído" : "Em andamento"}</StatusBadge>
            {canEdit && <Button size="sm" variant={editMode ? "default" : "secondary"} disabled={busy} aria-pressed={editMode}
              onClick={() => { setEditMode(value => !value); setManualTarget(null); setReopenConfirmation(false); }}>
              <Pencil size={13} aria-hidden="true" />{editMode ? "Sair da edição" : "Editar agenda"}
            </Button>}
            <Button size="sm" variant="secondary" disabled={query.isFetching || busy} onClick={() => void refresh()}>
              <RefreshCw size={14} aria-hidden="true" />{query.isFetching ? "Atualizando…" : "Atualizar"}
            </Button>
            <Button size="sm" variant="secondary" disabled={pdfBusy} onClick={() => void exportPdf()}>
              <FileDown size={14} aria-hidden="true" />{pdfBusy ? "Preparando PDF…" : "Exportar PDF"}
            </Button>
          </div>
        </div>
        {pdfError && <p role="alert" className="rounded-lg border border-rose-500/40 p-3 text-xs text-rose-200">{pdfError}</p>}
        {editable && completed && !reopenConfirmation && <Button size="sm" variant="secondary" disabled={busy}
          onClick={() => setReopenConfirmation(true)}>Reabrir para conferente</Button>}
        {editable && completed && reopenConfirmation && <section className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3" aria-label="Confirmar reabertura">
          <p className="text-xs text-amber-200">Reabrir esta agenda permitirá que o conferente continue a operação. Confirme a alteração.</p>
          {reopening.isError && <p role="alert" className="text-xs text-rose-300">{operationError(reopening.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => reopening.mutate()}>
              {reopening.isPending ? "Reabrindo…" : "Confirmar reabertura"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReopenConfirmation(false)}>Cancelar</Button>
          </div>
        </section>}
        <div aria-label="Resumo da agenda" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {([
            ["Total", metrics.total, CalendarDays],
            ["Aguardando", metrics.aguardando, Clock3],
            ["Recebidos", metrics.recebido, CheckCircle2],
            ["Não recebidos", metrics.naoChegou, Ban],
            ["Trocas", metrics.trocas, ArrowLeftRight],
          ] as const).map(([label, value, Icon]) => <div key={label} className="flex items-center gap-2 rounded-md border border-[#36516d] bg-[#1a2c41] px-2.5 py-1.5">
            <Icon size={14} className="shrink-0 text-sky-300" />
            <div className="min-w-0"><span className="block text-[10px] leading-tight text-slate-300">{label}</span>
              <strong className="block text-base font-bold leading-tight text-white tabular-nums">{value}</strong>
            </div>
            <small className="ml-auto text-[10px] text-slate-400 tabular-nums">{label === "Total" ? "100% do dia" : pct(value) + "%"}</small>
          </div>)}
        </div>
        <section className="space-y-2 rounded-xl border border-[#36516d] bg-[#142438] p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-sm font-bold text-white">Agenda do dia</h3>
              <p className="text-xs text-slate-400">Fornecedores agendados para recebimento.</p></div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="relative min-w-0">
                <Search aria-hidden="true" size={14} className="absolute top-2.5 left-2 text-slate-400" />
                <input aria-label="Pesquisar fornecedor ou protocolo" type="search" placeholder="Pesquisar fornecedor ou protocolo"
                  className="h-9 w-full rounded-md border border-[#3e5874] bg-[#101e30] pr-2 pl-7 text-xs text-white sm:w-56"
                  value={search} onChange={event => setSearch(event.target.value)} />
              </label>
              {editable && !completed && <Button size="sm" variant="secondary" className="border-amber-400 ring-2 ring-amber-400/60"
                onClick={() => setManualTarget({ mode: "create" })}><Plus size={13} />Fornecedor sem agenda</Button>}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#36516d]" aria-label="Fornecedores">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#36516d] bg-[#16283c] text-[11px] uppercase tracking-wide text-slate-400">
                  {sortableColumns.map(column => {
                    const ariaSort = !sort || sort.key !== column.key ? "none"
                      : sort.direction === "ascending" ? "ascending" : "descending";
                    return <th key={column.key} scope="col" aria-sort={ariaSort}
                      className={`whitespace-nowrap px-2.5 py-2 font-semibold ${column.width}`}>
                      <button type="button" title={`Ordenar por ${column.label}`}
                        className={`flex w-full items-center gap-1 uppercase ${ariaSort === "none" ? "hover:text-slate-100" : "text-slate-100"}`}
                        onClick={() => setSort(current => nextAgendaSort(current, column.key))}>
                        {column.label}
                        {ariaSort === "ascending" && <ArrowUp size={12} aria-hidden="true" />}
                        {ariaSort === "descending" && <ArrowDown size={12} aria-hidden="true" />}
                        {ariaSort === "none" && <ArrowUpDown size={12} aria-hidden="true" className="opacity-40" />}
                      </button>
                    </th>;
                  })}
                  <th scope="col" className="w-[196px] min-w-[196px] whitespace-nowrap px-2.5 py-2 font-semibold">Ações</th>
                  <th scope="col" className="whitespace-nowrap px-2.5 py-2 font-semibold w-[96px]">Trocas</th>
                  <th scope="col" className="whitespace-nowrap px-2.5 py-2 font-semibold w-[220px]">Obs.</th>
                </tr>
              </thead>
              {sorted.map(item => <AppointmentRow key={item.id} item={item} day={agenda.date} readOnly={rowsReadOnly}
                agendaQueryKey={agendaQueryKey} api={adminApi}
                onEditManual={item2 => setManualTarget({ mode: "edit", item: item2 })}
                onRemoveManual={item2 => setManualTarget({ mode: "edit", item: item2, confirmDelete: true })}
                onOpenDetails={setDetailsId} />)}
              {sorted.length === 0 && <tbody><tr><td role="status" colSpan={6} className="p-4 text-center text-xs text-slate-400">Nenhum fornecedor ou protocolo encontrado.</td></tr></tbody>}
            </table>
          </div>
        </section>
        {!canEdit && <p className="border-t border-[#34516d] pt-3 text-[11px] text-slate-400">Somente consulta nesta etapa. Edição e reabertura não estão disponíveis para o perfil visualizador.</p>}
      </>}
    </div>
    {manualTarget && agenda && <ManualSupplierDialog target={manualTarget}
      api={{ ...adminApi, create: (supplier: string) => createAdminManual(agendaId, supplier) }}
      onClose={() => setManualTarget(null)}
      onSaved={async () => { setSearch(""); await refresh(); }}
      onDeleted={async () => { setSearch(""); await refresh(); }} />}
    {detailsId && <AppointmentDetailsDialog appointmentId={detailsId} getDetail={getAdminAppointmentDetail} onClose={() => setDetailsId(null)} />}
  </dialog>;
}
