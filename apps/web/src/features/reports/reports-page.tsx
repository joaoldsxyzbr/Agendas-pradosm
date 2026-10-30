import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, RefreshCw, Store, TrendingUp, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/features/receiving/model";
import { getLatest, getOccurrences, getReport, getStores } from "./api";
import {
  clampPercent, group, initialFilters, numberBR, percentBR, presetRange, previousRange,
  rate, totals, validRange, type Grouped, type ReportFilters, type Totals,
} from "./model";

const panel = "min-w-0 rounded-xl border border-[#314b66] bg-[#142338] p-4 shadow-lg md:p-5";
const input = "h-9 w-full min-w-0 rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400 [color-scheme:dark]";
const heads = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300";
const cells = "px-3 py-3 text-xs text-slate-200";
const metrics = [
  { key: "total", label: "Agendamentos", icon: CalendarDays, tone: "text-sky-300" },
  { key: "recebido", label: "Recebidos", icon: CheckCircle2, tone: "text-emerald-300" },
  { key: "naoChegou", label: "Não recebidos", icon: XCircle, tone: "text-rose-300" },
  { key: "naoCompareceu", label: "Não compareceu", icon: Users, tone: "text-amber-300" },
  { key: "aguardando", label: "Aguardando", icon: Clock3, tone: "text-violet-300" },
  { key: "recusado", label: "Recusados", icon: XCircle, tone: "text-slate-300" },
  { key: "semAgenda", label: "Sem agenda", icon: Store, tone: "text-slate-300" },
] as const;
const statusColors = [
  { key: "recebido", label: "Recebidos", cls: "bg-emerald-400" },
  { key: "naoChegou", label: "Não recebidos", cls: "bg-rose-400" },
  { key: "naoCompareceu", label: "Não compareceu", cls: "bg-amber-400" },
  { key: "aguardando", label: "Aguardando", cls: "bg-violet-400" },
  { key: "recusado", label: "Recusados", cls: "bg-slate-400" },
] as const;

function Section({ title, hint, children, actions }: { title: string; hint: string; children: ReactNode; actions?: ReactNode }) {
  return <section className={panel}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-bold text-white">{title}</h2><p className="mt-1 text-xs text-slate-400">{hint}</p></div>
      {actions}
    </header>
    {children}
  </section>;
}
function Failure({ retry, text }: { retry: () => void; text: string }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
    <span>{text}</span><Button variant="secondary" size="sm" onClick={retry}>Tentar novamente</Button>
  </div>;
}
function Summary({ sum, previous }: { sum: Totals; previous: Totals | null }) {
  const receiptRate = rate(sum);
  const change = previous && previous.total > 0 ? receiptRate - rate(previous) : null;
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores gerenciais">
    <div className="col-span-2 rounded-xl border border-sky-500/40 bg-gradient-to-br from-[#163657] to-[#142338] p-5 shadow-lg lg:row-span-2">
      <div className="flex items-center gap-2 text-sm font-medium text-sky-200"><TrendingUp size={18} aria-hidden="true" /> Taxa de recebimento</div>
      <strong className="mt-5 block text-5xl font-bold tracking-tight text-white tabular-nums">{percentBR(receiptRate)}</strong>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#2d4764]"><div className="h-full rounded-full bg-sky-400" style={{ width: clampPercent(receiptRate) + "%" }} /></div>
      <p className="mt-3 text-xs text-slate-300">{numberBR(sum.recebido)} de {numberBR(sum.total)} agendamentos</p>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        {change === null ? "Sem comparação disponível" : <>
          {change >= 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
          {change > 0 ? "+" : ""}{change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. em relação ao período anterior
        </>}
      </p>
    </div>
    {metrics.map(({ key, label, icon: Icon, tone }) => <div key={key}
      className="min-w-0 rounded-xl border border-[#314b66] bg-[#142338] p-4 shadow-lg">
      <div className="flex items-center gap-2 text-[11px] text-slate-300"><Icon size={15} className={tone} aria-hidden="true" />{label}</div>
      <strong className="mt-3 block text-3xl font-bold tabular-nums text-white">{numberBR(sum[key])}</strong>
      {previous && <p className="mt-2 text-[11px] text-slate-400">Anterior: {numberBR(previous[key])}</p>}
    </div>)}
  </div>;
}

function DailyChart({ days }: { days: Grouped[] }) {
  const [mode, setMode] = useState<"volume" | "rate">("volume");
  const visible = days.slice(-14);
  const maximum = Math.max(1, ...visible.map(row => row.total));
  return <Section title="Evolução diária" hint="Últimos 14 dias com agendas dentro do intervalo selecionado."
    actions={<div role="group" aria-label="Modo do gráfico" className="flex gap-1 rounded-md bg-[#203750] p-1">
      <Button variant={mode === "volume" ? "default" : "ghost"} size="sm" aria-pressed={mode === "volume"} onClick={() => setMode("volume")}>Volume</Button>
      <Button variant={mode === "rate" ? "default" : "ghost"} size="sm" aria-pressed={mode === "rate"} onClick={() => setMode("rate")}>Taxa</Button>
    </div>}>
    {!visible.length ? <p className="text-sm text-slate-400">Sem movimentação no período.</p> : <>
      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1" aria-label="Evolução diária de recebimentos">
        {visible.map(row => {
          const height = mode === "rate" ? rate(row) : row.total / maximum * 100;
          return <div key={row.key} className="flex h-full min-w-[35px] flex-1 flex-col items-center justify-end gap-1"
            role="img" aria-label={formatDay(row.key) + ": " + numberBR(row.total) + " agendamentos, " + percentBR(rate(row)) + " de recebimento"}>
            <div className="flex h-[155px] w-full items-end justify-center">
              <div className="flex w-7 flex-col justify-end overflow-hidden rounded-t bg-[#2c4663]" style={{ height: Math.max(0, Math.min(100, height)) + "%" }}>
                {mode === "rate" ? <div className="h-full bg-sky-400" /> : statusColors.map(s =>
                  <div key={s.key} className={s.cls} style={{ height: (row.total ? row[s.key] / row.total * 100 : 0) + "%" }} />)}
              </div>
            </div><small className="text-[10px] text-slate-400">{row.key.slice(8)}/{row.key.slice(5, 7)}</small>
          </div>;
        })}
      </div>
      {mode === "volume" && <div className="mt-3 flex flex-wrap gap-3">{statusColors.map(s =>
        <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-slate-400"><i className={"size-2 rounded-sm " + s.cls} />{s.label}</span>)}</div>}
    </>}
  </Section>;
}
function StoreRanking({ stores }: { stores: Grouped[] }) {
  const ranked = stores.filter(s => s.total > 0).slice().sort((a, b) => rate(b) - rate(a) || a.key.localeCompare(b.key, "pt-BR", { numeric: true }));
  return <Section title="Desempenho por loja" hint="Taxa de recebimento (recebidos ÷ total); não representa volume absoluto.">
    {ranked.length ? <div className="space-y-4">{ranked.slice(0, 5).map(store => <div key={store.key}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-slate-200" title={store.label}>{store.label}</span>
        <strong className="shrink-0 text-sky-200">{percentBR(rate(store))}</strong>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#2d4764]"><div className="h-full rounded-full bg-sky-400" style={{ width: clampPercent(rate(store)) + "%" }} /></div>
      <p className="mt-1 text-[10px] text-slate-400">{numberBR(store.recebido)} de {numberBR(store.total)} recebidos</p>
    </div>)}</div> : <p className="text-sm text-slate-400">Sem movimentação por loja no período.</p>}
  </Section>;
}
function Distribution({ total }: { total: Totals }) {
  return <Section title="Distribuição das situações" hint="Todas as situações são calculadas sobre o total de agendamentos.">
    {total.total ? <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-[#2d4764]" role="img"
        aria-label={"Distribuição de " + numberBR(total.total) + " agendamentos"}>
        {statusColors.map(s => <span key={s.key} className={s.cls} style={{ width: (total[s.key] / total.total * 100) + "%" }} />)}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{statusColors.map(s =>
        <div key={s.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2 text-slate-300"><i className={"size-2 rounded-sm " + s.cls} />{s.label}</span>
          <strong className="text-slate-100">{numberBR(total[s.key])} <span className="font-normal text-slate-400">({percentBR(total[s.key] / total.total * 100)})</span></strong>
        </div>)}</div>
    </div> : <p className="text-sm text-slate-400">Nenhum agendamento no período.</p>}
  </Section>;
}
function Pager({ offset, total, onChange }: { offset: number; total: number; onChange: (value: number) => void }) {
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#314b66] pt-3 text-xs text-slate-400">
    <span>{numberBR(total)} registro(s) · {total ? numberBR(offset + 1) : 0}–{numberBR(Math.min(offset + 50, total))}</span>
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - 50))}>Anterior</Button>
      <Button variant="secondary" size="sm" disabled={offset + 50 >= total} onClick={() => onChange(offset + 50)}>Próxima</Button>
    </div>
  </div>;
}
function ReportTable({ headings, children, label }: { headings: string[]; children: ReactNode; label: string }) {
  return <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-[#314b66]">
    <table aria-label={label} className="w-full min-w-[820px] border-collapse">
      <thead className="bg-[#203750]"><tr>{headings.map(heading => <th key={heading} scope="col" className={heads}>{heading}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#314b66]">{children}</tbody>
    </table>
  </div>;
}
const statusNames: Record<string, string> = {
  recebido: "Recebido", nao_recebido: "Não recebido", nao_compareceu: "Não compareceu",
  aguardando: "Aguardando", recusado: "Recusado",
};
const originNames: Record<string, string> = {
  historico: "Sistema · agenda antiga concluída",
  sistema: "Sistema · fechamento do dia",
  manual: "Registrado manualmente",
};
export function ReportsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ReportFilters>(initialFilters);
  const [applied, setApplied] = useState<ReportFilters>(initialFilters);
  const [filterError, setFilterError] = useState("");
  const [occurrenceInput, setOccurrenceInput] = useState("");
  const [occurrenceQuery, setOccurrenceQuery] = useState("");
  const [occurrenceOffset, setOccurrenceOffset] = useState(0);
  const [recentOffset, setRecentOffset] = useState(0);
  const stores = useQuery({ queryKey: ["manager-report", "stores"], queryFn: getStores, staleTime: 60_000 });
  const report = useQuery({ queryKey: ["manager-report", "rows", applied], queryFn: () => getReport(applied) });
  const previous = previousRange(applied);
  const previousReport = useQuery({
    queryKey: ["manager-report", "previous", applied], queryFn: () => getReport({ ...previous, stores: applied.stores }),
    enabled: applied.compare,
  });
  const occurrences = useQuery({
    queryKey: ["manager-report", "occurrences", applied, occurrenceOffset, occurrenceQuery],
    queryFn: () => getOccurrences(applied, occurrenceOffset, occurrenceQuery),
  });
  const latest = useQuery({
    queryKey: ["manager-report", "latest", applied, recentOffset], queryFn: () => getLatest(applied, recentOffset),
  });
  const summary = useMemo(() => totals(report.data?.rows ?? []), [report.data]);
  const priorSummary = useMemo(() => applied.compare && previousReport.data ? totals(previousReport.data.rows) : null, [applied.compare, previousReport.data]);
  const days = useMemo(() => group(report.data?.rows ?? [], "date"), [report.data]);
  const units = useMemo(() => group(report.data?.rows ?? [], "store"), [report.data]);
  const working = report.isFetching || occurrences.isFetching || latest.isFetching;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!validRange(draft.start, draft.end)) {
      setFilterError("Selecione um intervalo válido de até 93 dias.");
      return;
    }
    setFilterError("");
    setApplied({ ...draft, stores: [...draft.stores].sort() });
    setOccurrenceOffset(0);
    setRecentOffset(0);
  };
  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-5" aria-label="Relatório Gerencial">
    <PageHeader eyebrow="Inteligência operacional" title="Relatório Gerencial"
      description="Panorama dos recebimentos, desempenho das lojas e ocorrências registradas."
      actions={<Button variant="secondary" size="sm" disabled={working} onClick={() => void queryClient.invalidateQueries({ queryKey: ["manager-report"] })}>
        <RefreshCw size={14} aria-hidden="true" />{working ? "Atualizando…" : "Atualizar"}
      </Button>} />
    <form onSubmit={apply} className={panel} aria-label="Filtros do relatório">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-sm font-bold text-white">Filtros da análise</h2><p className="mt-1 text-xs text-slate-400">Período de até 93 dias, por uma ou várias lojas.</p></div>
        <span className="text-xs text-sky-200">{formatDay(applied.start)} a {formatDay(applied.end)}</span>
      </div>
      <div role="group" aria-label="Períodos rápidos" className="mb-4 flex flex-wrap gap-2">
        {([["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["month", "Mês atual"]] as const).map(([key, text]) =>
          <Button key={key} size="sm" variant="secondary" aria-pressed={draft.start === presetRange(key).start && draft.end === presetRange(key).end}
            onClick={() => setDraft(value => ({ ...value, ...presetRange(key) }))}>{text}</Button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,1.2fr)_auto] lg:items-end">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">De
          <input className={input} type="date" value={draft.start} onChange={event => setDraft(value => ({ ...value, start: event.target.value }))} />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">Até
          <input className={input} type="date" value={draft.end} onChange={event => setDraft(value => ({ ...value, end: event.target.value }))} />
        </label>
        <details className="relative min-w-0 rounded-md border border-[#48617b] bg-[#192d46] text-xs text-white">
          <summary className="flex min-h-9 cursor-pointer items-center px-3" aria-label="Selecionar lojas">
            {draft.stores.length ? draft.stores.length + " loja(s) selecionada(s)" : "Todas as lojas"}
          </summary>
          <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full min-w-[190px] overflow-auto rounded-md border border-[#48617b] bg-[#192d46] p-2 shadow-xl">
            <label className="flex cursor-pointer items-center gap-2 p-2"><input type="checkbox" checked={!draft.stores.length}
              onChange={() => setDraft(value => ({ ...value, stores: [] }))} />Todas as lojas</label>
            {stores.isPending && <p className="p-2 text-slate-400">Carregando lojas…</p>}
            {stores.isError && <p role="alert" className="p-2 text-rose-300">Não foi possível listar as lojas.</p>}
            {stores.data?.filter(store => store.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })).map(store =>
              <label key={store.id} className="flex cursor-pointer items-center gap-2 p-2">
                <input type="checkbox" value={store.codigo} checked={draft.stores.includes(store.codigo)}
                  onChange={event => setDraft(value => ({
                    ...value, stores: event.target.checked ? [...value.stores, store.codigo] : value.stores.filter(code => code !== store.codigo),
                  }))} />
                <span>{store.codigo} · {store.nome}</span>
              </label>)}
          </div>
        </details>
        <Button type="submit">Aplicar filtros</Button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={draft.compare} onChange={event => setDraft(value => ({ ...value, compare: event.target.checked }))} />
        Comparar período anterior
      </label>
      {filterError && <p role="alert" className="mt-2 text-xs text-rose-300">{filterError}</p>}
    </form>
    {report.isPending && <p role="status" className={panel}>Carregando relatório…</p>}
    {report.isError && <Failure retry={() => void report.refetch()} text="Não foi possível carregar os indicadores gerenciais." />}
    {report.data && <>
      <Summary sum={summary} previous={priorSummary} />
      {applied.compare && previousReport.isError && <Failure retry={() => void previousReport.refetch()} text="Comparação indisponível. Os indicadores atuais continuam disponíveis." />}
      {summary.abertas > 0 && <p role="status" className="text-xs text-amber-300">{numberBR(summary.abertas)} agenda(s) em aberto: os indicadores podem mudar até o fechamento.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DailyChart days={days} />
        <Distribution total={summary} />
        <StoreRanking stores={units} />
        <Section title="Fornecedores com ocorrências" hint="Mais não recebidos no período, sem incluir a classificação automática de não comparecimento.">
          {!report.data.suppliers.length ? <p className="text-sm text-slate-400">Sem ocorrências no período.</p> :
            <ol className="space-y-2">{report.data.suppliers.map((supplier, index) =>
              <li key={supplier.supplier} className="flex items-baseline justify-between gap-4 border-b border-[#314b66] pb-2 text-xs">
                <span className="truncate text-slate-200">{index + 1}. {supplier.supplier}</span>
                <span className="shrink-0 text-rose-300">{numberBR(supplier.naoChegou)} não recebidos</span>
              </li>)}</ol>}
        </Section>
      </div>
      <Section title="Por loja" hint="Indicadores consolidados de todas as unidades selecionadas.">
        <ReportTable label="Consolidado por loja" headings={["Loja", "Agendamentos", "Recebidos", "Não recebidos", "Não compareceu", "Aguardando", "Recusados", "Sem agenda", "Taxa"]}>
          {units.map(unit => <tr key={unit.key}>
            <td className={cells}>{unit.label}</td>
            {(["total", "recebido", "naoChegou", "naoCompareceu", "aguardando", "recusado", "semAgenda"] as const).map(metric =>
              <td key={metric} className={cells + " tabular-nums"}>{numberBR(unit[metric])}</td>)}
            <td className={cells + " font-semibold text-sky-200"}>{percentBR(rate(unit))}</td>
          </tr>)}
          {!units.length && <tr><td colSpan={9} className={cells}>Nenhum registro no período.</td></tr>}
        </ReportTable>
      </Section>
      <Section title="Ocorrências e observações" hint="Não recebidos e não comparecimentos, com classificação e origem.">
        <form className="mb-4 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setOccurrenceQuery(occurrenceInput.trim()); setOccurrenceOffset(0); }}>
          <input type="search" aria-label="Buscar ocorrência por fornecedor ou protocolo" maxLength={80} value={occurrenceInput}
            onChange={event => setOccurrenceInput(event.target.value)} className={input + " max-w-sm"} placeholder="Fornecedor ou protocolo" />
          <Button type="submit" size="sm">Buscar</Button>
          {occurrenceQuery && <Button size="sm" variant="secondary" onClick={() => { setOccurrenceInput(""); setOccurrenceQuery(""); setOccurrenceOffset(0); }}>Limpar</Button>}
        </form>
        {occurrences.isPending && <p role="status" className="text-sm text-slate-300">Carregando ocorrências…</p>}
        {occurrences.isError && <Failure retry={() => void occurrences.refetch()} text="Não foi possível consultar as ocorrências." />}
        {occurrences.data && <>
          <ReportTable label="Ocorrências e observações" headings={["Data", "Loja", "Fornecedor", "Protocolo", "Situação", "Motivo", "Origem"]}>
            {occurrences.data.rows.map((row, index) => <tr key={row.date + row.protocol + index}>
              <td className={cells}>{formatDay(row.date)}</td><td className={cells}>{row.storeCode} · {row.storeName}</td>
              <td className={cells}>{row.supplier}</td><td className={cells}>{row.protocol}</td>
              <td className={cells}>{statusNames[row.occurrenceType]}</td>
              <td className={cells}>{row.occurrenceType === "nao_compareceu" ? "Não compareceu" : row.observation || "Motivo não registrado"}</td>
              <td className={cells}>{originNames[row.classificationOrigin] || "Sistema"}</td>
            </tr>)}
            {!occurrences.data.rows.length && <tr><td colSpan={7} className={cells}>Nenhuma ocorrência encontrada.</td></tr>}
          </ReportTable>
          <Pager offset={occurrenceOffset} total={occurrences.data.total} onChange={setOccurrenceOffset} />
        </>}
      </Section>
      <Section title="Agendamentos recentes por data de entrega" hint="Ordenados por data e horário de entrega, do mais recente ao mais antigo.">
        {latest.isPending && <p role="status" className="text-sm text-slate-300">Carregando agendamentos…</p>}
        {latest.isError && <Failure retry={() => void latest.refetch()} text="Não foi possível consultar os agendamentos recentes." />}
        {latest.data && <>
          <ReportTable label="Agendamentos recentes" headings={["Data", "Horário", "Loja", "Fornecedor", "Situação"]}>
            {latest.data.rows.map((row, index) => <tr key={row.date + row.storeCode + index}>
              <td className={cells}>{formatDay(row.date)}</td><td className={cells}>{row.time || "—"}</td>
              <td className={cells}>{row.storeCode}</td><td className={cells}>{row.supplier}</td>
              <td className={cells}>{statusNames[row.status] || row.status}</td>
            </tr>)}
            {!latest.data.rows.length && <tr><td colSpan={5} className={cells}>Nenhum agendamento encontrado.</td></tr>}
          </ReportTable>
          <Pager offset={recentOffset} total={latest.data.total} onChange={setRecentOffset} />
        </>}
      </Section>
    </>}
    <p className="text-[11px] text-slate-500"><Activity size={12} className="mr-1 inline-block" aria-hidden="true" />Dados consultados na API oficial; nenhuma alteração de dados é feita neste relatório.</p>
  </section>;
}
