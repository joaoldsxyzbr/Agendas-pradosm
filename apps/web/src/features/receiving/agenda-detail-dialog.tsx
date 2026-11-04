import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUpDown, ArrowUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/operations/status-badge";
import { ApiError } from "@/lib/api";
import { nextAgendaSort, sortAppointments, type AgendaSort, type AgendaSortKey } from "@/features/conference/model";
import {
  addManualSupplier, deleteManualSupplier, getAgendaDetail,
  renameManualSupplier, reopenAgenda,
} from "./api";
import { formatDay } from "./model";
import { AppointmentControls } from "./appointment-controls";

// Mesmas colunas ordenáveis da tela de Conferência, com o mesmo ciclo de ordenação.
const sortableColumns: { key: AgendaSortKey; label: string; width: string }[] = [
  { key: "startTime", label: "Horário", width: "w-[96px]" },
  { key: "supplier", label: "Fornecedor", width: "" },
  { key: "protocol", label: "Protocolo", width: "w-[100px]" },
  { key: "type", label: "Tipo", width: "w-[104px]" },
  { key: "status", label: "Status", width: "w-[116px]" },
];
type ManualAction =
  | { type: "add" }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string; name: string };

function operationError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Não foi possível concluir a operação. Atualize e tente novamente.";
}

export function AgendaDetailDialog({ agendaId, canEdit = false, onClose }: {
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
  const [manualAction, setManualAction] = useState<ManualAction | null>(null);
  const [supplier, setSupplier] = useState("");
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const query = useQuery({
    queryKey: ["receiving", "detail", agendaId],
    queryFn: () => getAgendaDetail(agendaId),
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["receiving", "detail", agendaId], exact: true }),
      client.invalidateQueries({ queryKey: ["receiving", "agendas"] }),
    ]);
  };
  const reopening = useMutation({
    mutationFn: () => reopenAgenda(agendaId),
    onSuccess: async () => { setReopenConfirmation(false); await refresh(); },
  });
  const manualMutation = useMutation({
    mutationFn: async (action: ManualAction) => {
      if (action.type === "delete") return deleteManualSupplier(action.id);
      const cleaned = supplier.trim();
      if (!cleaned || cleaned.length > 160) throw new Error("Informe um fornecedor válido (até 160 caracteres).");
      if (action.type === "add") return addManualSupplier(agendaId, cleaned);
      return renameManualSupplier(action.id, cleaned);
    },
    onSuccess: async () => {
      setManualAction(null);
      setSupplier("");
      setSearch("");
      await refresh();
    },
  });
  const busy = reopening.isPending || manualMutation.isPending || appointmentBusy;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const filtered = (query.data?.appointments ?? []).filter(item => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return !term || `${item.supplier} ${item.protocol}`.toLocaleLowerCase("pt-BR").includes(term);
  });
  // Ordem padrão igual à Conferência: horário e protocolo sem ordenação ativa.
  const appointments = sortAppointments(
    [...filtered].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.protocol.localeCompare(b.protocol)),
    sort,
  );
  const agenda = query.data?.agenda;
  const completed = agenda?.dayStatus === "concluido";
  const editable = canEdit && editMode;

  function openManual(action: ManualAction) {
    if (!editable || busy) return;
    manualMutation.reset();
    setSupplier(action.type === "rename" ? action.name : "");
    setManualAction(action);
  }
  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualAction || busy || !editable) return;
    manualMutation.mutate(manualAction);
  }

  return <dialog ref={ref} aria-labelledby="detail-heading" onClose={event => {
    if (!event.currentTarget.open) onClose();
  }} onClick={event => { if (event.target === ref.current && !busy) ref.current?.close(); }}
    onKeyDownCapture={event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        if (manualAction) { setManualAction(null); return; }
        if (reopenConfirmation) { setReopenConfirmation(false); return; }
        ref.current?.close();
      }
    }}
    className="m-auto max-h-[min(92dvh,900px)] w-[min(94vw,1100px)] max-w-none overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Agenda por loja</p>
        <h2 id="detail-heading" className="truncate text-base font-bold">{agenda ? `Agenda ${agenda.storeCode} — ${agenda.storeName}` : "Detalhes da agenda"}</h2>
      </div>
      <Button aria-label="Fechar detalhes" size="icon" variant="secondary" disabled={busy}
        onClick={() => ref.current?.close()}><X size={17} /></Button>
    </div>
    <div className="space-y-3 p-3">
      {query.isPending && <p role="status" className="text-sm text-slate-300">Carregando detalhes…</p>}
      {query.isError && <div role="alert" className="space-y-2">
        <p className="text-sm text-rose-300">Não foi possível carregar os detalhes da agenda.</p>
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>}
      {agenda && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-300">Data: <strong className="text-white">{formatDay(agenda.date)}</strong></span>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={completed ? "success" : "warning"}>{completed ? "Concluído" : "Em andamento"}</StatusBadge>
            {canEdit && <Button size="sm" variant={editMode ? "default" : "secondary"} disabled={busy}
              aria-pressed={editMode}
              onClick={() => {
                setEditMode(value => !value);
                setManualAction(null);
                setReopenConfirmation(false);
              }}>{editMode ? "Sair da edição" : "Editar agenda"}</Button>}
          </div>
        </div>
        {editable && completed && !reopenConfirmation && <Button size="sm" variant="secondary"
          disabled={busy} onClick={() => setReopenConfirmation(true)}>
          Reabrir para conferente
        </Button>}
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
        <div className="flex flex-wrap gap-2" aria-label="Indicadores da agenda">
          {[
            ["total", query.data?.appointments.length ?? 0],
            ["aguardando", query.data?.appointments.filter(x => x.status === "aguardando").length ?? 0],
            ["recebidos", query.data?.appointments.filter(x => x.status === "recebido").length ?? 0],
            ["não recebidos", query.data?.appointments.filter(x => x.status === "nao_chegou").length ?? 0],
          ].map(([label, value]) => <span key={label} className="rounded-md border border-[#37516b] bg-[#20334c] px-2.5 py-1.5 text-[11px] text-slate-300"><strong className="mr-2 text-white tabular-nums">{value}</strong>{label}</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[190px] flex-1">
            <span className="sr-only">Pesquisar fornecedor ou protocolo</span>
            <Search aria-hidden="true" size={16} className="absolute top-2.5 left-3 text-slate-400" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar fornecedor ou protocolo"
              className="h-9 w-full rounded-md border border-slate-600 bg-[#101e30] pr-3 pl-9 text-xs text-white outline-none focus-visible:border-sky-400" />
          </label>
          {editable && <Button size="sm" variant="secondary" disabled={busy}
            onClick={() => openManual({ type: "add" })}><Plus size={14} aria-hidden="true" />Fornecedor sem agenda</Button>}
        </div>
        {editable && manualAction && <section aria-label={manualAction.type === "delete" ? "Confirmar exclusão de fornecedor" : "Editar fornecedor manual"}
          className="rounded-lg border border-sky-500/30 bg-[#203650] p-3">
          {manualAction.type === "delete" ? <>
            <p className="text-xs text-slate-200">Excluir <strong>{manualAction.name}</strong> desta agenda? A remoção será registrada na auditoria.</p>
            {manualMutation.isError && <p role="alert" className="mt-2 text-xs text-rose-300">{operationError(manualMutation.error)}</p>}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="danger" disabled={busy} onClick={() => manualMutation.mutate(manualAction)}>
                {manualMutation.isPending ? "Excluindo…" : "Confirmar exclusão"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setManualAction(null)}>Cancelar</Button>
            </div>
          </> : <form className="space-y-2" onSubmit={submitManual}>
            <label htmlFor="manual-supplier-name" className="block text-xs font-semibold text-slate-200">Nome do fornecedor</label>
            <input id="manual-supplier-name" autoFocus type="text" required maxLength={160} value={supplier}
              onChange={event => setSupplier(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-600 bg-[#101e30] px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-sky-300" />
            {manualMutation.isError && <p role="alert" className="text-xs text-rose-300">{operationError(manualMutation.error)}</p>}
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy || !supplier.trim()}>
                {manualMutation.isPending ? "Salvando…" : manualAction.type === "add" ? "Adicionar fornecedor" : "Salvar fornecedor"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setManualAction(null)}>Cancelar</Button>
            </div>
          </form>}
        </section>}
        <div className="max-h-[45dvh] overflow-auto rounded-lg border border-[#36516d]" aria-label="Agendamentos">
          <table className="w-full min-w-[960px] border-collapse text-left">
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
                <th scope="col" className="w-[148px] min-w-[148px] whitespace-nowrap px-2.5 py-2 font-semibold">Ações</th>
                <th scope="col" className="whitespace-nowrap px-2.5 py-2 font-semibold w-[96px]">Trocas</th>
                <th scope="col" className="whitespace-nowrap px-2.5 py-2 font-semibold w-[280px]">Obs.</th>
              </tr>
            </thead>
            {appointments.map(item => <AppointmentControls key={item.id} item={item} editable={editable}
              disabled={busy || Boolean(manualAction) || reopenConfirmation}
              onBusyChange={setAppointmentBusy} onSaved={refresh}
              extraActions={editable && item.origin === "manual" ? <>
                <Button size="icon" variant="secondary" className="h-7 w-7" disabled={busy}
                  title={`Renomear ${item.supplier}`} aria-label={`Renomear ${item.supplier}`}
                  onClick={() => openManual({ type: "rename", id: item.id, name: item.supplier })}>
                  <Pencil size={13} aria-hidden="true" />
                </Button>
                <Button size="icon" variant="danger" className="h-7 w-7" disabled={busy}
                  title={`Excluir ${item.supplier}`} aria-label={`Excluir ${item.supplier}`}
                  onClick={() => openManual({ type: "delete", id: item.id, name: item.supplier })}>
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </> : null} />)}
            {appointments.length === 0 && <tbody>
              <tr><td role="status" colSpan={8} className="p-4 text-center text-xs text-slate-400">Nenhum fornecedor ou protocolo encontrado.</td></tr>
            </tbody>}
          </table>
        </div>
        {!canEdit && <p className="border-t border-[#34516d] pt-3 text-[11px] text-slate-400">Somente consulta nesta etapa. Edição e reabertura não estão disponíveis para o perfil visualizador.</p>}
        {canEdit && <p className="border-t border-[#34516d] pt-3 text-[11px] text-slate-400">
          A edição deste detalhe utiliza as mesmas regras da API operacional, com autorização e auditoria no Worker.
        </p>}
      </>}
    </div>
  </dialog>;
}
