import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, Store as StoreIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { MetricCard } from "@/components/operations/metric-card";
import { useSession } from "@/app/session-query";
import { AgendaDetailDialog } from "./agenda-detail-dialog";
import { useReceivingRealtime } from "./use-realtime";
import { getAgendas, getPresence, getStores } from "./api";
import {
  businessToday, formatDay, pendingLabels, receivingModel, shiftDay,
  type ReceivingRow,
} from "./model";

const tableHead = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300";
const tableCell = "px-3 py-2 align-middle text-xs text-slate-200";

function PresenceStatus({ status, unavailable }: {
  status: ReceivingRow["presence"]; unavailable: boolean;
}) {
  const label = unavailable ? "Indisponível" : status === "online" ? "Online" : status === "away" ? "Ausente" : "Offline";
  const color = unavailable ? "bg-amber-400" : status === "online" ? "bg-emerald-400" : status === "away" ? "bg-amber-400" : "bg-slate-500";
  return <span className="inline-flex items-center gap-2 text-[11px] text-slate-300">
    <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
    <span>{label}</span>
  </span>;
}

function ReceivingTable({ rows, onDetails, presenceUnavailable }: {
  rows: ReceivingRow[]; onDetails: (id: string) => void; presenceUnavailable: boolean;
}) {
  return <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#38516d] bg-[#142235] shadow-lg">
    <div className="w-full min-w-0 max-w-full overflow-x-auto" data-testid="receiving-table-scroll">
      <table className="w-full min-w-[930px] table-fixed border-collapse" aria-label="Recebimento por loja">
        <colgroup>
          <col className="w-[24%]" /><col className="w-[15%]" />
          <col className="w-[16%]" /><col className="w-[19%]" />
          <col className="w-[15%]" /><col className="w-[11%]" />
        </colgroup>
        <thead className="border-b border-[#38516d] bg-[#21374f]">
          <tr><th scope="col" className={tableHead}>Loja</th>
            <th scope="col" className={tableHead}>Conferente</th>
            <th scope="col" className={tableHead}>Recebimentos</th>
            <th scope="col" className={tableHead}>Pendências</th>
            <th scope="col" className={tableHead}>Situação</th>
            <th scope="col" className={tableHead}><span className="sr-only">Ações</span></th></tr>
        </thead>
        <tbody className="divide-y divide-[#304865]">
          {rows.map(({ store, agenda, presence }, index) => {
            const pending = agenda ? pendingLabels(agenda) : [];
            const total = Math.max(0, agenda?.total ?? 0);
            const received = Math.max(0, agenda?.recebido ?? 0);
            return <tr key={store.id} data-testid={`receiving-store-${store.codigo}`}
              className={`h-[60px] hover:bg-[#29405a] ${index % 2 ? "bg-[#1a2a40]" : "bg-[#142235]"}`}>
              <td className={tableCell}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="text-[12px] font-bold text-white">{store.codigo}</strong>
                  <span className="rounded-full border border-[#3c5977] bg-[#203854] px-2 py-0.5 text-[10px] text-blue-100">{agenda ? "Agenda importada" : "Sem agenda"}</span>
                </div>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400" title={store.nome}>{store.nome}</span>
              </td>
              <td className={tableCell}><PresenceStatus status={presence} unavailable={presenceUnavailable} /></td>
              <td className={tableCell}>{agenda
                ? <div className="max-w-[155px]">
                  <strong className="font-bold tabular-nums text-white">{received} <span className="text-slate-500">/</span> {total}</strong>
                  <progress className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#354a65] accent-blue-400"
                    value={Math.min(received, Math.max(1, total))} max={Math.max(1, total)}
                    aria-label={`Recebimentos concluídos da loja ${store.codigo}`} />
                </div>
                : <span className="text-slate-500">—</span>}
              </td>
              <td className={tableCell}>{agenda ? <div className="flex flex-col gap-0.5">
                {pending.length ? pending.map(([count, label, tone]) =>
                  <span key={label} className={`text-[11px] ${tone === "danger" ? "text-rose-300" : tone === "warning" ? "text-amber-300" : "text-slate-300"}`}>{count} {label}</span>)
                  : <span className="text-[11px] text-slate-400">Sem pendências</span>}
              </div> : <span className="text-[11px] text-slate-400">Sem agenda nesta data</span>}</td>
              <td className={tableCell}><StatusBadge tone={!agenda ? "neutral" : agenda.dayStatus === "concluido" ? "success" : "warning"}>
                {!agenda ? "Sem agenda" : agenda.dayStatus === "concluido" ? "Concluído" : "Em andamento"}
              </StatusBadge></td>
              <td className={tableCell}>{agenda && <Button size="sm" variant="secondary" className="h-8 px-2 text-[10px]"
                onClick={() => onDetails(agenda.id)}>Ver detalhes <ChevronRight size={13} aria-hidden="true" /></Button>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

export function ReceivingPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [today, setToday] = useState(() => businessToday());
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailId, setDetailId] = useState<string | null>(null);
  const realtimeStatus = useReceivingRealtime(session.data?.id, selectedDate);
  const stores = useQuery({ queryKey: ["receiving", "stores"], queryFn: getStores, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const agendas = useQuery({ queryKey: ["receiving", "agendas", selectedDate], queryFn: () => getAgendas(selectedDate), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const presence = useQuery({ queryKey: ["receiving", "presence"], queryFn: getPresence, refetchInterval: 30_000, refetchOnWindowFocus: true });

  // A data da operacao obedece America/Sao_Paulo, inclusive na virada do dia.
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

  const model = useMemo(() =>
    receivingModel(stores.data ?? [], agendas.data ?? [], presence.data ?? []),
    [stores.data, agendas.data, presence.data],
  );
  const loading = stores.isPending || agendas.isPending;
  const failure = stores.isError || agendas.isError;
  const updating = stores.isFetching || agendas.isFetching || presence.isFetching;
  const readonly = session.data?.papel === "visualizador";
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["receiving"] });

  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-3" aria-label="Recebimento">
    <PageHeader eyebrow={readonly ? "Acompanhamento" : "Administração"} title="Recebimento"
      description={readonly ? "Acompanhe o andamento das agendas por loja." : "Acompanhe as agendas e gerencie a operação do dia."}
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
        {!readonly && <Button size="sm" disabled title="Importação disponível apenas na versão operacional atual"
          aria-label="Importar agenda indisponível durante a migração">
          <Upload size={14} aria-hidden="true" />Importar agenda
        </Button>}
      </div>}
    />
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-100">Recebimento por loja</h2>
      <span className="text-[11px] text-slate-400 tabular-nums">Referência: {formatDay(selectedDate)}{realtimeStatus === "connected" ? " · Tempo real conectado" : ""}</span>
    </div>
    {loading && <p role="status" className="rounded-lg border border-[#37516d] bg-[#182a40] p-4 text-xs text-slate-300">Carregando agendas…</p>}
    {failure && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
      <span>Não foi possível carregar o Recebimento.</span>
      <Button size="sm" variant="secondary" onClick={reload}>Tentar novamente</Button>
    </div>}
    {!loading && !failure && <>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#304b6b] bg-[#162740] shadow-lg sm:grid-cols-3 lg:grid-cols-5" aria-label="Situação do dia">
        <MetricCard label="lojas" value={model.totalStores} icon={<StoreIcon size={18} />} />
        <MetricCard label="com agenda" value={model.storesWithAgenda} icon={<CalendarDays size={18} />} />
        <MetricCard label="em andamento" value={model.openStores} tone="amber" icon={<Clock3 size={18} />} />
        <MetricCard label="concluídas" value={model.completedStores} tone="green" icon={<CheckCircle2 size={18} />} />
        <MetricCard label="sem agenda" value={model.storesWithoutAgenda} tone="red" icon={<Ban size={18} />} />
      </div>
      {presence.isError && <p role="status" className="text-[11px] text-amber-300">Presença de conferentes indisponível no momento.</p>}
      {model.rows.length ? <ReceivingTable rows={model.rows} onDetails={setDetailId} presenceUnavailable={presence.isError} />
        : <p className="rounded-lg border border-[#38516d] bg-[#142338] p-6 text-sm text-slate-400">Nenhuma loja com conferente ativo.</p>}
      {!readonly && <p className="text-[11px] text-slate-500">Versão em migração: importar agendas e alterar os status dos fornecedores continuam disponíveis no sistema atual.</p>}
    </>}
    {detailId && <AgendaDetailDialog key={detailId} agendaId={detailId} canEdit={session.data?.papel === "admin"} onClose={() => setDetailId(null)} />}
  </section>;
}
