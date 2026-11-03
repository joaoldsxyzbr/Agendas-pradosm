import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { MetricCard } from "@/components/operations/metric-card";
import { AgendaDetailDialog } from "@/features/receiving/agenda-detail-dialog";
import { businessToday, formatDay, shiftDay } from "@/features/receiving/model";
import { ApiError } from "@/lib/api";
import { getAgendaBoards, markAgendaDigitado } from "./api";
import { digitadoUpdateSchema, formatStamp, type AgendaBoard } from "./model";

const tableHead = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300";
const tableCell = "px-3 py-2 align-middle text-xs text-slate-200";

function DigitadoCell({ board, busy, onToggle }: {
  board: AgendaBoard;
  busy: boolean;
  onToggle: (board: AgendaBoard, value: boolean) => void;
}) {
  if (!board.digitadoEm) {
    return <Button size="sm" variant="secondary" className="h-7 px-2 text-[10px]" disabled={busy}
      onClick={() => onToggle(board, true)}>Marcar como digitada</Button>;
  }
  return <div className="flex flex-col items-start gap-1">
    <StatusBadge tone="success">Digitado</StatusBadge>
    <span className="text-[10px] text-slate-400"
      title={"Digitado por " + (board.digitadoPor?.name ?? "Administrador") + " em " + formatStamp(board.digitadoEm)}>
      {board.digitadoPor?.name ?? "Administrador"} · {formatStamp(board.digitadoEm)}
    </span>
    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" disabled={busy}
      onClick={() => onToggle(board, false)}>Desmarcar digitação</Button>
  </div>;
}

function AgendasTable({ boards, onDetails, onToggle, busyId }: {
  boards: AgendaBoard[];
  onDetails: (id: string) => void;
  onToggle: (board: AgendaBoard, value: boolean) => void;
  busyId: string | null;
}) {
  return <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#38516d] bg-[#142235] shadow-lg">
    <div className="w-full min-w-0 max-w-full overflow-x-auto" data-testid="agendas-table-scroll">
      <table className="w-full min-w-[900px] table-fixed border-collapse" aria-label="Agendas por loja">
        <colgroup>
          <col className="w-[22%]" /><col className="w-[21%]" /><col className="w-[14%]" />
          <col className="w-[13%]" /><col className="w-[19%]" /><col className="w-[11%]" />
        </colgroup>
        <thead className="border-b border-[#38516d] bg-[#21374f]">
          <tr>
            <th scope="col" className={tableHead}>Loja</th>
            <th scope="col" className={tableHead}>Arquivo importado</th>
            <th scope="col" className={tableHead}>Agendamentos</th>
            <th scope="col" className={tableHead}>Situação</th>
            <th scope="col" className={tableHead}>Digitado para o conferente</th>
            <th scope="col" className={tableHead}><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#304865]">
          {boards.map((board, index) => <tr key={board.id} data-testid={"agendas-row-" + board.storeCode}
            className={"hover:bg-[#29405a] " + (index % 2 ? "bg-[#1a2a40]" : "bg-[#142235]")}>
            <td className={tableCell}>
              <strong className="text-[12px] font-bold text-white">{board.storeCode}</strong>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400" title={board.storeName}>{board.storeName}</span>
            </td>
            <td className={tableCell}>
              <span className="block truncate text-[11px] text-slate-300" title={board.originalFileName ?? undefined}>
                {board.originalFileName ?? "—"}
              </span>
            </td>
            <td className={tableCell}>
              <strong className="tabular-nums text-white">{board.total}</strong>
              <span className="block text-[10px] text-slate-400">{board.recebido} recebidos</span>
            </td>
            <td className={tableCell}><StatusBadge tone={board.dayStatus === "concluido" ? "success" : "warning"}>
              {board.dayStatus === "concluido" ? "Concluído" : "Em andamento"}
            </StatusBadge></td>
            <td className={tableCell}>
              <DigitadoCell board={board} busy={busyId === board.id} onToggle={onToggle} />
            </td>
            <td className={tableCell}>
              <Button size="sm" variant="secondary" className="h-8 px-2 text-[10px]"
                onClick={() => onDetails(board.id)}>Ver agendamentos</Button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

export function AgendasPage() {
  const queryClient = useQueryClient();
  const [today, setToday] = useState(() => businessToday());
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const boards = useQuery({
    queryKey: ["agendas-board", selectedDate],
    queryFn: () => getAgendaBoards(selectedDate),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // A data da operação obedece America/Sao_Paulo, inclusive na virada do dia.
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

  const digitado = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => markAgendaDigitado(id, value),
    onMutate: () => setFailure(null),
    onSuccess: data => {
      const parsed = digitadoUpdateSchema.safeParse(data);
      if (parsed.success) {
        queryClient.setQueryData<AgendaBoard[]>(["agendas-board", selectedDate], current =>
          current ? current.map(board => board.id === parsed.data.id
            ? { ...board, digitadoEm: parsed.data.digitadoEm, digitadoPor: parsed.data.digitadoPor }
            : board)
          : current);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["agendas-board"] });
      }
    },
    onError: error => {
      setFailure(error instanceof ApiError && error.status === 409
        ? "Este registro mudou. Atualize a tela e tente novamente."
        : "Não foi possível alterar a marcação de digitação.");
    },
  });

  const list = boards.data ?? [];
  const model = useMemo(() => ({
    total: list.length,
    digitadas: list.filter(board => board.digitadoEm).length,
    pendentes: list.filter(board => !board.digitadoEm).length,
  }), [list]);
  const updating = boards.isFetching || digitado.isPending;
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["agendas-board"] });

  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-3" aria-label="Agendas">
    <PageHeader eyebrow="Administração" title="Agendas"
      description="Acompanhe as agendas importadas por loja e marque quais já foram digitadas para o conferente."
      actions={<div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-[#426181] bg-[#192c43]" aria-label="Controles de calendário">
          <button aria-label="Dia anterior" onClick={() => setSelectedDate(day => shiftDay(day, -1))}
            className="grid h-full w-8 place-items-center hover:bg-[#2c4563] focus-visible:outline-2 focus-visible:outline-sky-300"><ChevronLeft size={17} /></button>
          <label className="flex h-full items-center gap-2 border-x border-[#426181] px-2 text-xs text-slate-100">
            <CalendarDays aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
            <span className="sr-only">Data da agenda</span>
            <input type="date" aria-label="Data da agenda" value={selectedDate} onChange={event => { if (event.target.value) setSelectedDate(event.target.value); }}
              className="h-full w-[121px] min-w-0 cursor-pointer bg-transparent text-xs text-slate-100 outline-none focus-visible:outline-2 focus-visible:outline-sky-300 [color-scheme:dark]" />
          </label>
          <button aria-label="Dia seguinte" onClick={() => setSelectedDate(day => shiftDay(day, 1))}
            className="grid h-full w-8 place-items-center hover:bg-[#2c4563] focus-visible:outline-2 focus-visible:outline-sky-300"><ChevronRight size={17} /></button>
        </div>
        {selectedDate !== today && <Button size="sm" variant="ghost" onClick={() => setSelectedDate(today)}>Hoje</Button>}
        <Button size="sm" variant="secondary" disabled={updating} onClick={reload}>
          <RefreshCw size={14} aria-hidden="true" className={updating ? "animate-spin" : ""} />{updating ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>}
    />
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-100">Agendas por loja</h2>
      <span className="text-[11px] text-slate-400 tabular-nums">Referência: {formatDay(selectedDate)}</span>
    </div>
    {boards.isPending && <p role="status" className="rounded-lg border border-[#37516d] bg-[#182a40] p-4 text-xs text-slate-300">Carregando agendas…</p>}
    {boards.isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
      <span>Não foi possível carregar as agendas.</span>
      <Button size="sm" variant="secondary" onClick={reload}>Tentar novamente</Button>
    </div>}
    {failure && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{failure}</p>}
    {!boards.isPending && !boards.isError && <>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#304b6b] bg-[#162740] shadow-lg sm:grid-cols-3" aria-label="Agendas do dia">
        <MetricCard label="agendas importadas" value={model.total} icon={<ClipboardList size={18} />} />
        <MetricCard label="digitadas" value={model.digitadas} tone="green" icon={<CalendarCheck size={18} />} />
        <MetricCard label="pendentes de digitação" value={model.pendentes} tone="amber" icon={<CalendarDays size={18} />} />
      </div>
      {list.length ? <AgendasTable boards={list} onDetails={setDetailId}
          onToggle={(board, value) => digitado.mutate({ id: board.id, value })}
          busyId={digitado.isPending ? digitado.variables?.id ?? null : null} />
        : <p className="rounded-lg border border-[#38516d] bg-[#142338] p-6 text-sm text-slate-400">Nenhuma agenda importada nesta data.</p>}
      <p className="text-[11px] text-slate-500">Marcação interna da administração: indica que a agenda já foi digitada para o conferente. Não aparece na tela do conferente.</p>
    </>}
    {detailId && <AgendaDetailDialog key={detailId} agendaId={detailId} canEdit onClose={() => setDetailId(null)} />}
  </section>;
}
