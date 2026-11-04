import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { MetricCard } from "@/components/operations/metric-card";
import { businessToday, formatDay, shiftDay } from "@/features/receiving/model";
import { ApiError } from "@/lib/api";
import { getAgendaBoards, getAgendaSuppliers, updateSupplierCheck } from "./api";
import { formatStamp, type AgendaBoard, type Supplier, type SupplierAppointment } from "./model";

const tableHead = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300";
const tableCell = "px-3 py-2 align-middle text-xs text-slate-200";

function ValueList({ values }: { values: string[] }) {
  return values.length
    ? <span className="break-words">{values.join(", ")}</span>
    : <span className="text-slate-500">—</span>;
}

function AppointmentDetails({ item }: { item: SupplierAppointment }) {
  return <div className="space-y-2 rounded-md border border-[#37516c] bg-[#101f31] p-3" data-testid={"agendas-protocol-" + item.protocol}>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-300">
      <strong className="text-slate-100">Protocolo {item.protocol}</strong>
      <span>{item.startTime}–{item.endTime}</span>
      <span>{item.type ?? "Tipo não informado"}</span>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
      <div><span className="text-slate-400">Itens</span><strong className="block">{item.items ?? "—"}</strong></div>
      <div><span className="text-slate-400">Volumes</span><strong className="block">{item.volumes ?? "—"}</strong></div>
      <div><span className="text-slate-400">Paletes</span><strong className="block">{item.pallets ?? "—"}</strong></div>
      <div><span className="text-slate-400">Carga batida</span><strong className="block">{item.cargaBatida ?? "—"}</strong></div>
      <div className="col-span-2"><span className="text-slate-400">NF-e</span><strong className="block"><ValueList values={item.nfe}/></strong></div>
      <div className="col-span-2"><span className="text-slate-400">Pedidos</span><strong className="block"><ValueList values={item.orders}/></strong></div>
    </div>
    {Object.keys(item.csvFields).length > 0 && <details className="border-t border-[#34516d] pt-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-sky-200">Todos os campos originais do CSV</summary>
      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(item.csvFields).map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-[10px] text-slate-400">{label}</dt>
          <dd className="break-all text-[11px] text-slate-200">{value || "—"}</dd>
        </div>)}
      </dl>
    </details>}
  </div>;
}

function supplierDocumentNumbers(appointments: SupplierAppointment[], kind: "nfe" | "orders") {
  const values = appointments.flatMap(appointment => appointment[kind])
    .map(number => number.trim()).filter(Boolean);
  return [...new Set(values)].join(", ") || "—";
}

function SupplierItem({ item, busy, onToggle }: {
  item: Supplier;
  busy: boolean;
  onToggle: (item: Supplier, checked: boolean) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const documents = `NF-e: ${supplierDocumentNumbers(item.appointments, "nfe")} | Pedidos: ${supplierDocumentNumbers(item.appointments, "orders")}`;
  return <li data-testid="agendas-supplier-item" className="min-w-0 bg-[#182a40] hover:bg-[#21354c]">
    <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
      <label className="flex min-w-0 flex-[1.2] cursor-pointer items-center gap-2">
        <input type="checkbox" aria-label={"Digitado: " + item.supplier}
          checked={Boolean(item.digitadoEm)} disabled={busy}
          onChange={event => onToggle(item, event.target.checked)}
          className="size-4 shrink-0 accent-emerald-500"/>
        <strong className="min-w-0 truncate text-[12px] font-semibold text-white" title={item.supplier}>
          {item.supplier}
        </strong>
      </label>
      <span data-testid="agendas-supplier-documents" title={documents}
        className="min-w-0 flex-[1.4] truncate whitespace-nowrap text-[11px] text-slate-300">{documents}</span>
      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-slate-400"
        aria-label={item.appointments.length + " agendamentos"}>
        {item.appointments.length} ag.
      </span>
      <span className={"w-[54px] shrink-0 text-right text-[10px] font-medium " +
        (item.digitadoEm ? "text-emerald-300" : "text-amber-300")}
        title={item.digitadoEm ? "Digitado em " + formatStamp(item.digitadoEm) : undefined}>
        {item.digitadoEm ? "Digitado" : "Pendente"}
      </span>
      <button type="button" aria-label={"Detalhes de " + item.supplier}
        aria-expanded={detailsOpen} aria-controls={detailsId}
        onClick={() => setDetailsOpen(value => !value)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] text-sky-200 hover:bg-[#2b4560] focus-visible:outline-2 focus-visible:outline-sky-300">
        {detailsOpen ? <ChevronUp size={14} aria-hidden="true"/> : <ChevronDown size={14} aria-hidden="true"/>}
        <span className="hidden sm:inline">Detalhes</span>
      </button>
    </div>
    {detailsOpen && <div id={detailsId} className="space-y-2 border-t border-[#304865] bg-[#142438] p-3">
      {item.digitadoEm && <p className="text-[11px] text-emerald-300">
        Digitado em {formatStamp(item.digitadoEm)}
        {item.digitadoPor?.name ? " por " + item.digitadoPor.name : ""}
      </p>}
      {item.appointments.map(appointment => <AppointmentDetails key={appointment.id} item={appointment}/>)}
    </div>}
  </li>;
}

function StoreRow({ board, index, busy, onToggle }: {
  board: AgendaBoard; index: number; busy: boolean;
  onToggle: (agendaId: string, item: Supplier, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const result = useQuery({
    queryKey: ["agenda-suppliers", board.id],
    queryFn: () => getAgendaSuppliers(board.id),
    enabled: expanded,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
  const suppliers = result.data?.suppliers ?? [];
  const completed = result.data
    ? suppliers.filter(supplier => supplier.digitadoEm).length : board.digitadas;
  const totalSuppliers = result.data ? suppliers.length : board.fornecedores;
  return <Fragment>
    <tr data-testid={"agendas-row-" + board.storeCode} className={"hover:bg-[#29405a] " + (index % 2 ? "bg-[#1a2a40]" : "bg-[#142235]")}>
      <td className={tableCell}>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
          aria-controls={"agendas-details-" + board.id}
          className="flex w-full items-center gap-2 rounded text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-300">
          {expanded ? <ChevronUp size={16} className="shrink-0 text-sky-300"/> : <ChevronDown size={16} className="shrink-0 text-sky-300"/>}
          <span className="min-w-0">
            <strong className="block text-[12px] text-white">{board.storeCode}</strong>
            <span className="block truncate text-[11px] text-slate-400">{board.storeName}</span>
          </span>
        </button>
      </td>
      <td className={tableCell} data-testid={"agendas-progress-" + board.storeCode}>
        <strong className="tabular-nums text-white">{completed}/{totalSuppliers}</strong>{" "}
        <span className="text-[11px] text-slate-400">digitadas</span>
      </td>
      <td className={tableCell}><strong className="tabular-nums text-white">{board.total}</strong><span className="block text-[10px] text-slate-400">{board.recebido} recebidos</span></td>
      <td className={tableCell}><StatusBadge tone={board.dayStatus === "concluido" ? "success" : "warning"}>{board.dayStatus === "concluido" ? "Concluído" : "Em andamento"}</StatusBadge></td>
      <td className={tableCell}>
        <button type="button" aria-expanded={expanded} aria-controls={"agendas-details-" + board.id}
          onClick={() => setExpanded(value => !value)}
          className="text-[11px] font-medium text-sky-200 hover:underline focus-visible:outline-2 focus-visible:outline-sky-300">
          {expanded ? "Ocultar fornecedores" : "Ver fornecedores"}
        </button>
      </td>
    </tr>
    {expanded && <tr className="bg-[#112236]" data-testid={"agendas-details-" + board.storeCode}>
      <td colSpan={5} id={"agendas-details-" + board.id} className="border-b border-[#38516d] p-3 sm:p-4">
        {result.isPending && <p role="status" className="text-xs text-slate-300">Carregando fornecedores…</p>}
        {result.isError && <div role="alert" className="flex items-center gap-3 text-xs text-rose-200">
          Não foi possível carregar os fornecedores.
          <Button size="sm" onClick={() => void result.refetch()}>Tentar novamente</Button>
        </div>}
        {result.data && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-xs text-slate-100">Fornecedores desta loja</strong>
            <span className="text-[11px] text-slate-300">{completed} de {totalSuppliers} digitados</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#304865]" aria-label="Progresso de digitação">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: (totalSuppliers ? completed / totalSuppliers * 100 : 0) + "%" }}/>
          </div>
          {suppliers.length
            ? <ul aria-label="Fornecedores desta loja" className="min-w-0 divide-y divide-[#304865] overflow-hidden rounded-lg border border-[#38516d]">{suppliers.map(item =>
                <SupplierItem key={item.supplier} item={item} busy={busy}
                  onToggle={(supplier, checked) => onToggle(board.id, supplier, checked)}/>)}</ul>
            : <p className="text-xs text-slate-400">Nenhum fornecedor importado nesta agenda.</p>}
        </div>}
      </td>
    </tr>}
  </Fragment>;
}

export function AgendasPage() {
  const client = useQueryClient();
  const [today, setToday] = useState(() => businessToday());
  const [selectedDate, setSelectedDate] = useState(today);
  const [failure, setFailure] = useState<string | null>(null);
  const boards = useQuery({
    queryKey: ["agendas-board", selectedDate],
    queryFn: () => getAgendaBoards(selectedDate),
    refetchInterval: 30_000, refetchOnWindowFocus: true
  });
  useEffect(() => {
    const check = () => {
      const next = businessToday();
      if (next === today) return;
      setToday(next);
      setSelectedDate(value => value === today ? next : value);
    };
    const interval = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [today]);
  const toggle = useMutation({
    mutationFn: (args: { agendaId: string; supplier: string; hash: string; digitado: boolean; expectedDigitadoEm: string | null }) =>
      updateSupplierCheck(args.agendaId, args),
    onMutate: () => setFailure(null),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["agenda-suppliers", vars.agendaId] }),
        client.invalidateQueries({ queryKey: ["agendas-board"] })
      ]);
    },
    onError: error => {
      setFailure(error instanceof ApiError && error.status === 409
        ? "Este fornecedor mudou. Atualize a lista e tente novamente."
        : "Não foi possível salvar a digitação do fornecedor.");
    }
  });
  const list = boards.data ?? [];
  const counts = useMemo(() => ({
    total: list.length,
    appointments: list.reduce((sum, board) => sum + board.total, 0),
    completed: list.filter(board => board.dayStatus === "concluido").length
  }), [list]);
  const updating = boards.isFetching || toggle.isPending;
  const reload = () => void Promise.all([
    client.invalidateQueries({ queryKey: ["agendas-board"] }),
    client.invalidateQueries({ queryKey: ["agenda-suppliers"] })
  ]);
  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-3" aria-label="Agendas">
    <PageHeader eyebrow="Administração" title="Agendas"
      description="Consulte o CSV completo por loja e marque individualmente os fornecedores já digitados. Esta marcação não altera o recebimento."
      actions={<div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-[#426181] bg-[#192c43]" aria-label="Controles de calendário">
          <button aria-label="Dia anterior" onClick={() => setSelectedDate(day => shiftDay(day, -1))}
            className="grid h-full w-8 place-items-center hover:bg-[#2c4563] focus-visible:outline-2 focus-visible:outline-sky-300"><ChevronLeft size={17}/></button>
          <label className="flex h-full items-center gap-2 border-x border-[#426181] px-2 text-xs text-slate-100">
            <CalendarDays aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
            <span className="sr-only">Data da agenda</span>
            <input type="date" aria-label="Data da agenda" value={selectedDate} onChange={event => { if (event.target.value) setSelectedDate(event.target.value); }}
              className="h-full w-[121px] min-w-0 cursor-pointer bg-transparent text-xs text-slate-100 outline-none focus-visible:outline-2 focus-visible:outline-sky-300 [color-scheme:dark]"/>
          </label>
          <button aria-label="Dia seguinte" onClick={() => setSelectedDate(day => shiftDay(day, 1))}
            className="grid h-full w-8 place-items-center hover:bg-[#2c4563] focus-visible:outline-2 focus-visible:outline-sky-300"><ChevronRight size={17}/></button>
        </div>
        {selectedDate !== today && <Button size="sm" variant="ghost" onClick={() => setSelectedDate(today)}>Hoje</Button>}
        <Button size="sm" variant="secondary" disabled={updating} onClick={reload}>
          <RefreshCw size={14} aria-hidden="true" className={updating ? "animate-spin" : ""}/>
          {updating ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>}/>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-100">Agendas por loja</h2>
      <span className="text-[11px] text-slate-400 tabular-nums">Referência: {formatDay(selectedDate)}</span>
    </div>
    {boards.isPending && <p role="status" className="rounded-lg border border-[#37516d] bg-[#182a40] p-4 text-xs text-slate-300">Carregando agendas…</p>}
    {boards.isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
      Não foi possível carregar as agendas.
      <Button size="sm" variant="secondary" onClick={reload}>Tentar novamente</Button>
    </div>}
    {failure && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{failure}</p>}
    {!boards.isPending && !boards.isError && <>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#304b6b] bg-[#162740] shadow-lg sm:grid-cols-3" aria-label="Agendas do dia">
        <MetricCard label="agendas importadas" value={counts.total} icon={<ClipboardList size={18}/>}/>
        <MetricCard label="agendamentos" value={counts.appointments} icon={<CalendarDays size={18}/>}/>
        <MetricCard label="lojas concluídas" value={counts.completed} tone="green" icon={<CheckCircle2 size={18}/>}/>
      </div>
      {list.length ? <div className="w-full overflow-hidden rounded-xl border border-[#38516d] bg-[#142235] shadow-lg">
        <div className="overflow-x-auto" data-testid="agendas-table-scroll">
          <table className="w-full min-w-[800px] table-fixed border-collapse" aria-label="Agendas por loja">
            <colgroup><col className="w-[27%]"/><col className="w-[18%]"/><col className="w-[18%]"/><col className="w-[17%]"/><col className="w-[20%]"/></colgroup>
            <thead className="border-b border-[#38516d] bg-[#21374f]"><tr>
              {["Loja", "Digitadas", "Agendamentos", "Situação", "Fornecedores"].map(h => <th key={h} scope="col" className={tableHead}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#304865]">
              {list.map((board, index) => <StoreRow key={board.id} board={board} index={index}
                busy={toggle.isPending}
                onToggle={(agendaId, supplier, digitado) => toggle.mutate({
                  agendaId, supplier: supplier.supplier, hash: supplier.hash,
                  digitado, expectedDigitadoEm: supplier.digitadoEm
                })}/>)}
            </tbody>
          </table>
        </div>
      </div> : <p className="rounded-lg border border-[#38516d] bg-[#142338] p-6 text-sm text-slate-400">Nenhuma agenda importada nesta data.</p>}
      <p className="text-[11px] text-slate-500">Os checks são exclusivos do ADM. A conferência, os status e o histórico operacional não são alterados.</p>
    </>}
  </section>;
}
