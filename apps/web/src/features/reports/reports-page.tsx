import { useEffect, useRef, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, Clock3, Info, RefreshCw, Users, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/features/receiving/model";
import { getLatest, getOccurrences, getReport, getStores } from "./api";
import {
  clampPercent, delta, group, groupWeekday, initialFilters, lastSevenCalendarDays, numberBR, percentBR,
  presetRange, previousRange, rate, totals, validRange, WEEKDAY_LABELS,
  type CalendarDay, type Delta, type Grouped, type Latest, type Occurrences, type ReportFilters, type Totals,
} from "./model";

const panel = "min-w-0 rounded-xl border border-[#314b66] bg-[#142338] p-4 shadow-lg md:p-5";
const input = "h-9 w-full min-w-0 rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400 [color-scheme:dark]";
const heads = "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-300";
const cells = "px-3 py-3 text-xs text-slate-200";

const STATUS = [
  { key: "recebido", label: "Recebidos", color: "#24c78b" },
  { key: "naoChegou", label: "Não recebidos", color: "#f0525f" },
  { key: "naoCompareceu", label: "Não compareceu", color: "#ffbf40" },
  { key: "aguardando", label: "Aguardando", color: "#9464ed" },
  { key: "recusado", label: "Recusados", color: "#94a7bf" },
] as const;

const REPORT_HELP: Record<string, string> = {
  "Agendamentos": "Quantidade total de agendamentos no período selecionado, incluindo todos os status.",
  "Recebidos": "Agendamentos marcados como recebidos. O percentual considera o total do período.",
  "Não recebidos": "Quantidade marcada como não recebida. Os motivos aparecem em Ocorrências e observações.",
  "Não compareceu": "Pendências classificadas como não comparecimento pelo sistema ao concluir o dia. Inclui agendas antigas encerradas com pendências; não comprova ausência física do fornecedor.",
  "Aguardando": "Agendamentos pendentes de recebimento em agendas que continuam abertas.",
  "Taxa de recebimento": "Recebidos ÷ total de agendamentos × 100. Os agendamentos pendentes também entram no total.",
  "Evolução dos recebimentos": "Mostra a taxa de recebimento de cada dia: recebidos ÷ total de agendamentos do dia × 100. Exibe até 14 datas recentes dentro do filtro, não a quantidade absoluta de entregas.",
  "Distribuição das situações": "Distribui todos os agendamentos do período por situação. As porcentagens são calculadas sobre o total e incluem entregas aguardando.",
  "Desempenho por loja": "Mostra as cinco lojas com maior taxa de recebimento no período filtrado. A barra representa recebidos ÷ total da loja × 100, não o volume de entregas.",
  "Agendamentos por situação (por dia)": "Cada coluna representa um dos últimos sete dias corridos do período selecionado (ou menos, se o intervalo for menor). Dias sem agendamentos aparecem com zero. As cores indicam a quantidade em cada situação.",
  "Ocorrências recentes": "Exibe até cinco ocorrências das datas mais recentes do período: não recebidos registrados e não comparecimentos classificados pelo sistema. A lista completa abre no botão abaixo.",
  "Agendamentos recentes por data de entrega": "Exibe os cinco agendamentos com data e horário de entrega mais recentes no período e nas lojas selecionadas, incluindo os aguardando. Não são necessariamente os últimos cadastrados no sistema.",
  "Evolução diária": "Volume diário por resultado: recebidos, não recebidos, aguardando em dias abertos, não comparecimentos do sistema e recusados. A alternância mostra o volume por status ou a taxa de recebimento de cada dia.",
  "Comparativo por loja": "Taxa de recebimento de cada loja: recebidos ÷ total da unidade × 100. A barra representa esse percentual.",
  "Fornecedores com ocorrências": "Fornecedores com mais não recebidos. A barra compara a quantidade de cada um com a do líder do ranking e mostra também a taxa de recebimento do fornecedor no período.",
  "Padrão por dia da semana": "Taxa de recebimento agrupada por dia da semana no período, somando todas as lojas. Ajuda a identificar dias que concentram problemas de entrega.",
};

const statusNames: Record<string, string> = {
  recebido: "Recebido", nao_recebido: "Não recebido", nao_compareceu: "Não compareceu",
  aguardando: "Aguardando", recusado: "Recusado",
};
const originNames: Record<string, string> = {
  historico: "Sistema · agenda antiga concluída",
  sistema: "Sistema · fechamento do dia",
  manual: "Registrado manualmente",
};
const shortDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8) + "/" + iso.slice(5, 7) : iso;
const Empty = ({ text }: { text: string }) => <p className="text-xs text-slate-400">{text}</p>;

function HelpTip({ title }: { title: string }) {
  const text = REPORT_HELP[title];
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!holder.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("click", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onPointerDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!text) return null;
  return <span ref={holder} className="relative inline-flex">
    <button type="button" aria-label={"Sobre: " + title} aria-expanded={open}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
      className="rounded p-0.5 text-slate-400 transition-colors hover:text-sky-300">
      <Info size={13} aria-hidden="true" />
    </button>
    {open && <span role="tooltip" onClick={event => event.stopPropagation()}
      className="absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 rounded-md border border-[#48617b] bg-[#0f1a2b] p-2.5 text-[11px] font-normal leading-snug text-slate-300 shadow-xl">
      {text}
    </span>}
  </span>;
}

function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={panel + " " + className}>
    <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-white">{title}<HelpTip title={title} /></h3>
      {action}
    </div>
    {children}
  </section>;
}

function Panel({ title, hint, actions, children }: { title: string; hint: string; actions?: ReactNode; children: ReactNode }) {
  return <section className={panel}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-1.5 text-base font-bold text-white">{title}<HelpTip title={title} /></h2><p className="mt-1 text-xs text-slate-400">{hint}</p></div>
      {actions}
    </header>
    {children}
  </section>;
}

function ReportDialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={onClose}
    className="fixed inset-0 m-auto max-h-[88vh] w-[min(1080px,calc(100vw-20px))] overflow-y-auto rounded-xl border border-[#48617b] bg-[#142338] p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#344d69] bg-[#142338] px-5 py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Relatório Gerencial</p>
        <h2 className="mt-1 text-lg font-bold">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
      <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></Button>
    </div>
    <div className="space-y-4 p-5">{children}</div>
  </dialog>;
}

function Failure({ retry, text }: { retry: () => void; text: string }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
    <span>{text}</span><Button variant="secondary" size="sm" onClick={retry}>Tentar novamente</Button>
  </div>;
}

function DeltaTag({ delta: value }: { delta: Delta }) {
  if (!value) return null;
  const tone = value.kind === "neutral" || (!value.up && !value.down)
    ? "text-slate-400"
    : value.up === (value.kind === "good") ? "text-emerald-300" : "text-rose-300";
  return <p className={"mt-1.5 flex items-center gap-1 text-[11px] " + tone}>
    {value.up ? <ArrowUpRight size={12} aria-hidden="true" /> : value.down ? <ArrowDownRight size={12} aria-hidden="true" /> : null}
    {(value.value > 0 ? "+" : "") + value.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vs. período anterior
  </p>;
}

const kpiDefs = [
  { key: "total", label: "Agendamentos", icon: CalendarDays, tone: "text-sky-300", kind: "neutral", description: "agendas" },
  { key: "recebido", label: "Recebidos", icon: CheckCircle2, tone: "text-emerald-300", kind: "good", description: "rate" },
  { key: "naoChegou", label: "Não recebidos", icon: XCircle, tone: "text-rose-300", kind: "invert", description: "Registrados na conferência" },
  { key: "naoCompareceu", label: "Não compareceu", icon: Users, tone: "text-amber-300", kind: "invert", description: "Classificados no fechamento" },
  { key: "aguardando", label: "Aguardando", icon: Clock3, tone: "text-violet-300", kind: "neutral", description: "Pendentes em agendas abertas" },
] as const;

function Kpis({ sum, prior }: { sum: Totals; prior: Totals | null }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores gerenciais">
    {kpiDefs.map(({ key, label, icon: Icon, tone, kind, description }) => <div key={key} className="min-w-0 rounded-xl border border-[#314b66] bg-[#142338] p-4 shadow-lg">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><Icon size={15} className={tone} aria-hidden="true" />{label}<HelpTip title={label} /></div>
      <strong className="mt-2 block text-2xl font-bold tabular-nums text-white md:text-3xl">{numberBR(sum[key])}</strong>
      {prior && <DeltaTag delta={delta(sum[key], prior[key], kind)} />}
      <small className="mt-1 block text-[11px] text-slate-400">
        {description === "agendas" ? numberBR(sum.agendas) + " agendas" : description === "rate" ? percentBR(rate(sum)) + " do total" : description}
      </small>
    </div>)}
  </div>;
}

function TrendChart({ days }: { days: Grouped[] }) {
  const recent = days.slice(-14);
  if (!recent.some(day => day.total)) return <Empty text="Sem agendamentos no período." />;
  const points = recent.map((day, index) => ({
    x: recent.length === 1 ? 50 : 6 + index * (88 / (recent.length - 1)),
    y: 91 - clampPercent(rate(day)) * 0.76,
    date: day.key,
  }));
  const coordinates = points.map(point => point.x.toFixed(2) + "," + point.y.toFixed(2)).join(" ");
  const gridlines = [0, 25, 50, 75, 100].map(value => {
    const y = (91 - value * 0.76).toFixed(2);
    return <line key={value} x1="6" y1={y} x2="94" y2={y} stroke="#2d4764" strokeWidth=".6" vectorEffect="non-scaling-stroke" />;
  });
  const labels = recent.filter((_, index) => index === 0 || index === recent.length - 1 || recent.length > 4 && index === Math.floor((recent.length - 1) / 2));
  return <div role="img" aria-label={"Taxa de recebimento diária dos últimos " + numberBR(recent.length) + " dias com agendas."}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full" aria-hidden="true">
      <defs><linearGradient id="report-trend-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#3f9cff" stopOpacity=".34" />
        <stop offset="100%" stopColor="#3f9cff" stopOpacity=".015" />
      </linearGradient></defs>
      {gridlines}
      <polygon points={"6,91 " + coordinates + " 94,91"} fill="url(#report-trend-fill)" />
      <polyline points={coordinates} fill="none" stroke="#449eff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map(point => <circle key={point.date} cx={point.x.toFixed(2)} cy={point.y.toFixed(2)} r=".85" fill="#70baff" />)}
    </svg>
    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">{labels.map(day => <span key={day.key}>{shortDate(day.key)}</span>)}</div>
    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400"><i className="size-2 rounded-full bg-[#449eff]" aria-hidden="true" /> Taxa de recebimento por dia</p>
  </div>;
}

function Donut({ sum }: { sum: Totals }) {
  if (!sum.total) return <Empty text="Nenhum agendamento no período." />;
  let used = 0;
  const stops = STATUS.map(status => {
    const current = used;
    used += sum[status.key] / sum.total * 100;
    return status.color + " " + current.toFixed(3) + "% " + Math.min(100, used).toFixed(3) + "%";
  }).join(", ");
  return <div className="flex flex-wrap items-center gap-5">
    <div className="relative size-32 shrink-0 rounded-full" style={{ background: "conic-gradient(" + stops + ")" }}
      role="img" aria-label={"Distribuição dos " + numberBR(sum.total) + " agendamentos por situação."}>
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-[#142338]">
        <strong className="text-xl font-bold tabular-nums text-white">{numberBR(sum.total)}</strong>
        <small className="text-[10px] text-slate-400">agendamentos</small>
      </div>
    </div>
    <ul className="min-w-0 flex-1 space-y-1.5">{STATUS.map(status => <li key={status.key} className="flex items-center justify-between gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-slate-300"><i className="size-2 shrink-0 rounded-sm" style={{ background: status.color }} />{status.label}</span>
      <strong className="shrink-0 text-slate-100">{numberBR(sum[status.key])} <span className="font-normal text-slate-400">({percentBR(sum[status.key] / sum.total * 100)})</span></strong>
    </li>)}</ul>
  </div>;
}

function StackedSeven({ daily, range }: { daily: Grouped[]; range: { start: string; end: string } }) {
  const days: CalendarDay[] = lastSevenCalendarDays(daily, range);
  if (!days.length) return <Empty text="Sem datas no período." />;
  const max = Math.max(1, ...days.map(day => day.total));
  return <>
    <div className="flex h-36 items-end gap-2" role="img" aria-label="Agendamentos por situação nos últimos sete dias corridos do período">
      {days.map(day => {
        const height = day.total ? Math.max(3, day.total / max * 100) : 0;
        return <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" role="img"
          aria-label={shortDate(day.date) + ": " + numberBR(day.total) + " agendamentos"}>
          <div className="flex h-[110px] w-full items-end justify-center">
            {day.total
              ? <div className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t" style={{ height: height + "%" }}>
                {STATUS.map(status => <span key={status.key} title={status.label + ": " + numberBR(day[status.key])}
                  style={{ height: (day[status.key] / day.total * 100).toFixed(3) + "%", background: status.color }} />)}
              </div>
              : <span className="text-[10px] text-slate-500" aria-hidden="true">0</span>}
          </div>
          <small className="text-[10px] text-slate-400">{shortDate(day.date)}</small>
        </div>;
      })}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">{STATUS.map(status =>
      <span key={status.key} className="flex items-center gap-1.5 text-[10px] text-slate-400"><i className="size-2 rounded-sm" style={{ background: status.color }} />{status.label}</span>)}</div>
  </>;
}

function Meter({ title, strong, width, footnote, tone = "#3f9cff" }: { title: string; strong: string; width: number; footnote?: string; tone?: string }) {
  return <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-slate-200" title={title}>{title}</span>
      <strong className="shrink-0 text-slate-100">{strong}</strong>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#2d4764]"><div className="h-full rounded-full" style={{ width: clampPercent(width) + "%", background: tone }} /></div>
    {footnote && <p className="text-[10px] text-slate-400">{footnote}</p>}
  </div>;
}

function StoreTop({ stores, onOpenAll }: { stores: Grouped[]; onOpenAll: () => void }) {
  const ranking = stores.filter(store => store.total > 0)
    .sort((a, b) => rate(b) - rate(a) || a.key.localeCompare(b.key, "pt-BR", { numeric: true }))
    .slice(0, 5);
  if (!ranking.length) return <Empty text="Sem resultados por loja no período." />;
  return <div className="space-y-4">
    {ranking.map(store => <Meter key={store.key} title={store.label} strong={percentBR(rate(store))} width={rate(store)}
      footnote={numberBR(store.recebido) + " / " + numberBR(store.total)} />)}
    <Button variant="ghost" size="sm" className="text-sky-300" onClick={onOpenAll}>Ver todas as lojas <ArrowRight size={13} aria-hidden="true" /></Button>
  </div>;
}

function OccurrenceBadge({ type }: { type: string }) {
  const automatic = type === "nao_compareceu";
  return <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + (automatic ? "bg-amber-400/15 text-amber-300" : "bg-rose-400/15 text-rose-300")}>
    {automatic ? "Não compareceu" : "Não recebido"}
  </span>;
}

function OccurrenceItems({ rows }: { rows: Occurrences["rows"] }) {
  if (!rows.length) return <Empty text="Nenhuma ocorrência no período." />;
  return <div role="list" aria-label="Ocorrências recentes" className="space-y-2.5">
    {rows.map((row, index) => {
      const automatic = row.occurrenceType === "nao_compareceu";
      const reason = automatic ? "Classificação no fechamento" : row.observation || "Motivo não informado";
      return <div key={row.protocol + index} role="listitem" className="space-y-1 border-b border-[#263a52] pb-2.5 last:border-0 last:pb-0">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="shrink-0 text-slate-400">{shortDate(row.date)}</span>
          <span className="shrink-0 font-semibold text-slate-200">{row.storeCode}</span>
          <span className="min-w-0 flex-1 truncate text-slate-300" title={row.supplier}>{row.supplier}</span>
          <OccurrenceBadge type={row.occurrenceType} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-slate-400">
          <span className="min-w-0 truncate" title={"Motivo: " + reason}>Motivo: {reason}</span>
          <span>Origem: {automatic ? "Sistema" : "Conferente"}</span>
        </div>
      </div>;
    })}
  </div>;
}

function LatestBadge({ status }: { status: string }) {
  const tone = status === "recebido" ? "bg-emerald-400/15 text-emerald-300"
    : status === "nao_recebido" ? "bg-rose-400/15 text-rose-300"
    : status === "nao_compareceu" ? "bg-amber-400/15 text-amber-300"
    : status === "recusado" ? "bg-slate-400/15 text-slate-300"
    : "bg-violet-400/15 text-violet-300";
  return <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + tone}>{statusNames[status] || "Aguardando"}</span>;
}

function LatestItems({ rows }: { rows: Latest["rows"] }) {
  if (!rows.length) return <Empty text="Nenhum agendamento recente no período." />;
  return <>
    <p className="mb-2 text-[10px] text-slate-400">Ordenados pela data e hora da entrega, do mais recente para o mais antigo.</p>
    <div role="list" aria-label="Agendamentos recentes por data de entrega" className="space-y-2">
      {rows.map((row, index) => <div key={row.date + row.storeCode + index} role="listitem"
        className="flex min-w-0 items-center gap-2 text-xs">
        <span className="shrink-0 text-slate-400" title="Data e hora da entrega">{shortDate(row.date)} · {row.time || "—"}</span>
        <span className="shrink-0 font-semibold text-slate-200">{row.storeCode}</span>
        <span className="min-w-0 flex-1 truncate text-slate-300" title={row.supplier}>{row.supplier || "—"}</span>
        <LatestBadge status={row.status} />
      </div>)}
    </div>
  </>;
}

function DailyChart({ days, mode }: { days: Grouped[]; mode: "volume" | "rate" }) {
  if (!days.length) return <Empty text="Sem movimentação no período." />;
  const max = Math.max(1, ...days.map(day => day.total));
  const step = Math.max(1, Math.ceil(days.length / 12));
  return <>
    <div className="flex h-48 items-end gap-1.5 overflow-x-auto pb-1" aria-label="Evolução diária de recebimentos">
      {days.map((day, index) => {
        const height = mode === "rate" ? clampPercent(rate(day)) : day.total / max * 100;
        return <div key={day.key} className="flex h-full min-w-[30px] flex-1 flex-col items-center justify-end gap-1" role="img"
          aria-label={formatDay(day.key) + ": " + numberBR(day.total) + " agendamentos; " + numberBR(day.recebido) + " recebidos; " + numberBR(day.naoChegou) + " não recebidos; " + numberBR(day.aguardando) + " aguardando; " + numberBR(day.naoCompareceu) + " não compareceu"}>
          <div className="flex h-[160px] w-full items-end justify-center">
            <div className="flex w-7 flex-col justify-end overflow-hidden rounded-t" style={{ height: Math.max(2, Math.min(100, height)) + "%" }}>
              {mode === "rate"
                ? <div className="h-full" style={{ background: "#24c78b" }} />
                : STATUS.map(status => <div key={status.key}
                  style={{ height: (day.total ? day[status.key] / day.total * 100 : 0) + "%", background: status.color }} />)}
            </div>
          </div>
          <small className="text-[10px] text-slate-400">{index % step === 0 ? day.key.slice(8) + "/" + day.key.slice(5, 7) : "\u00A0"}</small>
        </div>;
      })}
    </div>
    {mode === "volume" && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">{STATUS.map(status =>
      <span key={status.key} className="flex items-center gap-1.5 text-[10px] text-slate-400"><i className="size-2 rounded-sm" style={{ background: status.color }} />{status.label}</span>)}</div>}
  </>;
}

function StoreHighlights({ stores }: { stores: Grouped[] }) {
  const ranked = stores.filter(store => store.total > 0)
    .sort((a, b) => rate(b) - rate(a) || a.key.localeCompare(b.key, "pt-BR", { numeric: true }));
  if (!ranked.length) return <Empty text="Sem movimentação por loja no período." />;
  const best = ranked[0];
  const low = ranked[ranked.length - 1];
  if (!best || !low) return <Empty text="Sem movimentação por loja no período." />;
  return <div className="space-y-4">
    <Meter title={best.label} strong={percentBR(rate(best))} width={rate(best)} tone="#24c78b"
      footnote={"Maior taxa no período · " + numberBR(best.recebido) + " de " + numberBR(best.total) + " recebidos"} />
    {ranked.length > 1 && <Meter title={low.label} strong={percentBR(rate(low))} width={rate(low)} tone="#f0525f"
      footnote={"Menor taxa no período · " + numberBR(low.recebido) + " de " + numberBR(low.total) + " recebidos"} />}
  </div>;
}

function SupplierRanking({ suppliers }: { suppliers: { supplier: string; total: number; recebido: number; naoChegou: number }[] }) {
  if (!suppliers.length) return <Empty text="Sem ocorrências." />;
  const highest = Math.max(1, ...suppliers.map(supplier => supplier.naoChegou));
  return <div className="space-y-4">{suppliers.map((supplier, index) => <Meter key={supplier.supplier}
    title={(index + 1) + ". " + supplier.supplier} strong={numberBR(supplier.naoChegou)}
    width={supplier.naoChegou / highest * 100} tone="#f0525f"
    footnote={"Taxa de recebimento no período: " + percentBR(supplier.total ? supplier.recebido / supplier.total * 100 : 0)
      + " (" + numberBR(supplier.recebido) + " de " + numberBR(supplier.total) + ")"} />)}</div>;
}

function WeekdayPattern({ weekdays }: { weekdays: { weekday: number; total: number; recebido: number; days: number }[] }) {
  if (!weekdays.length) return <Empty text="Sem movimentação no período." />;
  return <div className="space-y-4">{weekdays.map(day => <Meter key={day.weekday} title={WEEKDAY_LABELS[day.weekday] ?? ""}
    strong={percentBR(rate(day))} width={rate(day)}
    footnote={numberBR(day.total) + " agendamento(s) em " + numberBR(day.days) + " dia(s) · " + numberBR(day.recebido) + " recebidos"} />)}</div>;
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

// Persistência dos filtros do relatório, no mesmo contrato da UI em produção.
const FILTERS_STORAGE_KEY = "agenda-prado-report-filters";

function restoreFilters(): ReportFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<ReportFilters> | null;
    if (!saved || !validRange(String(saved.start), String(saved.end))) return null;
    const stores = Array.isArray(saved.stores)
      ? [...new Set(saved.stores.filter(code => typeof code === "string" && code.trim().length > 0 && code.length <= 20))]
      : [];
    return { start: String(saved.start), end: String(saved.end), stores, compare: !!saved.compare };
  } catch {
    // Armazenamento corrompido ou bloqueado: usa os filtros padrão.
    return null;
  }
}

function persistFilters(filters: ReportFilters) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
      start: filters.start, end: filters.end, stores: filters.stores, compare: filters.compare,
    }));
  } catch {
    // A preferência vale apenas até o recarregamento quando o armazenamento está bloqueado.
  }
}

type DialogName = "analysis" | "stores" | "occurrences" | "appointments";

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [base] = useState(() => restoreFilters() ?? initialFilters());
  const [draft, setDraft] = useState<ReportFilters>(base);
  const [applied, setApplied] = useState<ReportFilters>(base);
  const [filterError, setFilterError] = useState("");
  const [occurrenceInput, setOccurrenceInput] = useState("");
  const [occurrenceQuery, setOccurrenceQuery] = useState("");
  const [occurrenceOffset, setOccurrenceOffset] = useState(0);
  const [recentOffset, setRecentOffset] = useState(0);
  const [chartMode, setChartMode] = useState<"volume" | "rate">("volume");
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const filterRef = useRef<HTMLDetailsElement>(null);
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
  const weekdays = useMemo(() => groupWeekday(days), [days]);
  const rateDifference = priorSummary && priorSummary.total > 0 ? rate(summary) - rate(priorSummary) : null;
  const working = report.isFetching || occurrences.isFetching || latest.isFetching;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!validRange(draft.start, draft.end)) {
      setFilterError("Selecione um intervalo válido de até 93 dias.");
      return;
    }
    setFilterError("");
    const next: ReportFilters = { ...draft, stores: [...draft.stores].sort() };
    setApplied(next);
    persistFilters(next);
    setOccurrenceOffset(0);
    setRecentOffset(0);
    if (filterRef.current) filterRef.current.open = false;
  };
  const storeLabel = (codes: string[]) => {
    if (!codes.length) return "Todas as lojas";
    if (codes.length === 1) {
      const single = codes[0] ?? "";
      const store = stores.data?.find(item => item.codigo === single);
      return store ? store.codigo + " · " + store.nome : single;
    }
    return numberBR(codes.length) + " lojas selecionadas";
  };
  const applyPreset = (key: "7" | "30" | "90" | "month") => {
    const range = presetRange(key);
    if (!validRange(range.start, range.end)) return;
    setFilterError("");
    setDraft(value => ({ ...value, ...range }));
    setApplied(value => ({ ...value, ...range }));
    persistFilters({ ...applied, ...range });
    setOccurrenceOffset(0);
    setRecentOffset(0);
    if (filterRef.current) filterRef.current.open = false;
  };
  // Descarta códigos de loja salvos que não existem mais, como a main faz após carregar as lojas.
  useEffect(() => {
    const known = stores.data?.map(store => store.codigo);
    if (!known) return;
    const valid = new Set(known);
    if (applied.stores.every(code => valid.has(code))) return;
    const next: ReportFilters = { ...applied, stores: applied.stores.filter(code => valid.has(code)) };
    setApplied(next);
    setDraft(next);
    persistFilters(next);
  }, [stores.data, applied]);
  useEffect(() => {
    const details = filterRef.current;
    if (!details) return;
    const dismiss = (event: MouseEvent) => { if (details.open && !details.contains(event.target as Node)) details.open = false; };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return;
      details.open = false;
      details.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-5" aria-label="Relatório Gerencial">
    <PageHeader eyebrow="Inteligência operacional" title="Relatório Gerencial"
      description="Panorama dos recebimentos, desempenho das lojas e ocorrências registradas."
      actions={<div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300 sm:inline-block">Visão consolidada</span>
        <Button variant="secondary" size="sm" disabled={working} onClick={() => void queryClient.invalidateQueries({ queryKey: ["manager-report"] })}>
          <RefreshCw size={14} aria-hidden="true" />{working ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>} />
    <div className="flex justify-end">
      <details ref={filterRef} className="group relative">
        <summary aria-label="Editar período e lojas"
          className="flex min-h-[35px] w-max max-w-full cursor-pointer list-none items-center justify-between gap-2.5 rounded-lg border border-[#314b66] bg-[#142338] px-2.5 text-[11px] font-semibold text-white shadow-lg transition-colors hover:border-sky-400 group-open:border-sky-400 group-open:bg-[#192d46] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 max-w-[min(420px,60vw)] truncate text-slate-200">
            {formatDay(applied.start)} a {formatDay(applied.end)} · {storeLabel(applied.stores)}
          </span>
          <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-sky-400 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <form onSubmit={apply} aria-label="Filtros do relatório"
          className="absolute right-0 top-full z-40 mt-1.5 grid w-[min(525px,calc(100vw-36px))] grid-cols-2 gap-3 rounded-xl border border-[#48617b] bg-[#142338] p-4 shadow-2xl">
          <div role="group" aria-label="Períodos rápidos" className="col-span-2 flex flex-wrap gap-1.5">
            {([["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["month", "Mês atual"]] as const).map(([key, text]) =>
              <Button key={key} size="sm" variant="secondary" aria-pressed={applied.start === presetRange(key).start && applied.end === presetRange(key).end}
                onClick={() => applyPreset(key)}>{text}</Button>)}
          </div>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">De
            <input className={input} type="date" value={draft.start} onChange={event => setDraft(value => ({ ...value, start: event.target.value }))} />
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300">Até
            <input className={input} type="date" value={draft.end} onChange={event => setDraft(value => ({ ...value, end: event.target.value }))} />
          </label>
          <div className="col-span-2 grid min-w-0 gap-1.5 text-xs font-semibold text-slate-300"><span>Lojas</span>
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
          </div>
          <label className="flex items-center gap-2 self-center text-xs text-slate-300">
            <input type="checkbox" checked={draft.compare} onChange={event => setDraft(value => ({ ...value, compare: event.target.checked }))} />
            Comparar período anterior
          </label>
          <Button type="submit" className="self-end">Aplicar filtros</Button>
          {filterError && <p role="alert" className="col-span-2 text-xs text-rose-300">{filterError}</p>}
        </form>
      </details>
    </div>
    {report.isPending && <p role="status" className={panel}>Carregando relatório…</p>}
    {report.isError && <Failure retry={() => void report.refetch()} text="Não foi possível carregar os indicadores gerenciais." />}
    {report.data && <>
      <Kpis sum={summary} prior={priorSummary} />
      {applied.compare && previousReport.isError && <Failure retry={() => void previousReport.refetch()} text="Comparação indisponível. Os indicadores atuais continuam disponíveis." />}
      {summary.abertas > 0 && <p role="status" className="text-xs text-amber-300">{numberBR(summary.abertas)} agenda(s) em aberto: os indicadores podem mudar até o fechamento.</p>}
      <div className="space-y-4" aria-label="Visão gerencial de recebimentos">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Taxa de recebimento">
            <strong className="block text-4xl font-bold tracking-tight tabular-nums text-white">{percentBR(rate(summary))}</strong>
            <p className="mt-2 text-xs text-slate-400">{numberBR(summary.recebido)} de {numberBR(summary.total)} agendamentos</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2d4764]"><div className="h-full rounded-full bg-[#3f9cff]" style={{ width: clampPercent(rate(summary)) + "%" }} /></div>
            {rateDifference === null
              ? <p className="mt-2 text-[11px] text-slate-500">Sem comparação disponível</p>
              : <p className={"mt-2 flex items-center gap-1 text-[11px] " + (rateDifference >= 0 ? "text-emerald-300" : "text-rose-300")}>
                {rateDifference >= 0 ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}
                {(rateDifference > 0 ? "+" : "") + rateDifference.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. em relação ao período anterior
              </p>}
          </Card>
          <Card title="Evolução dos recebimentos"
            action={<Button variant="ghost" size="sm" className="text-sky-300" onClick={() => setDialog("analysis")}>Ver análises completas <ArrowRight size={13} aria-hidden="true" /></Button>}>
            <TrendChart days={days} />
          </Card>
          <Card title="Distribuição das situações">
            <Donut sum={summary} />
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Desempenho por loja"><StoreTop stores={units} onOpenAll={() => setDialog("stores")} /></Card>
          <Card title="Agendamentos por situação (por dia)"><StackedSeven daily={days} range={applied} /></Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Ocorrências recentes"
            action={<Button variant="ghost" size="sm" className="text-sky-300" onClick={() => setDialog("occurrences")}>Ver todas as ocorrências <ArrowRight size={13} aria-hidden="true" /></Button>}>
            {occurrences.isPending ? <Empty text="Carregando ocorrências…" /> : occurrences.isError
              ? <Empty text="Ocorrências indisponíveis." /> : <OccurrenceItems rows={occurrences.data?.rows.slice(0, 5) ?? []} />}
          </Card>
          <Card title="Agendamentos recentes por data de entrega"
            action={<Button variant="ghost" size="sm" className="text-sky-300" onClick={() => setDialog("appointments")}>Ver detalhamento <ArrowRight size={13} aria-hidden="true" /></Button>}>
            {latest.isPending ? <Empty text="Carregando agendamentos…" /> : latest.isError
              ? <Empty text="Agendamentos indisponíveis." /> : <LatestItems rows={latest.data?.rows.slice(0, 5) ?? []} />}
          </Card>
        </div>
      </div>
      <p className="text-[11px] text-slate-500"><Activity size={12} className="mr-1 inline-block" aria-hidden="true" />Dados consultados na API oficial; nenhuma alteração de dados é feita neste relatório.</p>
    </>}
    {dialog === "analysis" && <ReportDialog title="Análises completas" description="Evolução diária, fornecedores e padrões de recebimento." onClose={() => setDialog(null)}>
      <Panel title="Evolução diária" hint="Volume por status ou taxa de recebimento em cada dia"
        actions={<div role="group" aria-label="Modo do gráfico" className="flex gap-1 rounded-md bg-[#203750] p-1">
          <Button variant={chartMode === "volume" ? "default" : "ghost"} size="sm" aria-pressed={chartMode === "volume"} onClick={() => setChartMode("volume")}>Volume</Button>
          <Button variant={chartMode === "rate" ? "default" : "ghost"} size="sm" aria-pressed={chartMode === "rate"} onClick={() => setChartMode("rate")}>Taxa de recebimento</Button>
        </div>}>
        <DailyChart days={days} mode={chartMode} />
      </Panel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Comparativo por loja" hint="Maior e menor taxa no período; o detalhamento reúne todas as unidades.">
          <StoreHighlights stores={units} />
        </Panel>
        <Panel title="Fornecedores com ocorrências" hint="Ranking de não recebidos com a taxa de recebimento de cada um.">
          <SupplierRanking suppliers={report.data?.suppliers ?? []} />
        </Panel>
        <Panel title="Padrão por dia da semana" hint="Taxa de recebimento por dia da semana no período.">
          <WeekdayPattern weekdays={weekdays} />
        </Panel>
      </div>
    </ReportDialog>}
    {dialog === "stores" && <ReportDialog title="Todas as lojas" description="Indicadores consolidados das unidades no período selecionado." onClose={() => setDialog(null)}>
      <Panel title="Por loja" hint="Indicadores consolidados">
        <ReportTable label="Consolidado por loja" headings={["Loja", "Agendamentos", "Recebidos", "Não recebidos", "Não compareceu", "Aguardando", "Recusados", "Sem agenda", "Taxa"]}>
          {units.map(unit => <tr key={unit.key}>
            <td className={cells}>{unit.label}</td>
            {(["total", "recebido", "naoChegou", "naoCompareceu", "aguardando", "recusado", "semAgenda"] as const).map(metric =>
              <td key={metric} className={cells + " tabular-nums"}>{numberBR(unit[metric])}</td>)}
            <td className={cells + " font-semibold text-sky-200"}>{percentBR(rate(unit))}</td>
          </tr>)}
          {!units.length && <tr><td colSpan={9} className={cells}>Nenhum registro no período.</td></tr>}
        </ReportTable>
      </Panel>
    </ReportDialog>}
    {dialog === "occurrences" && <ReportDialog title="Todas as ocorrências" description="Registros, motivos e origem da classificação." onClose={() => setDialog(null)}>
      <Panel title="Ocorrências e observações" hint="Não recebidos registrados e não comparecimentos por fechamento">
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
              <td className={cells}><OccurrenceBadge type={row.occurrenceType} /></td>
              <td className={cells}>{row.occurrenceType === "nao_compareceu" ? "Não compareceu" : row.observation || "Motivo não registrado"}</td>
              <td className={cells}>{originNames[row.classificationOrigin] || "Sistema"}</td>
            </tr>)}
            {!occurrences.data.rows.length && <tr><td colSpan={7} className={cells}>Nenhuma ocorrência encontrada.</td></tr>}
          </ReportTable>
          <Pager offset={occurrenceOffset} total={occurrences.data.total} onChange={setOccurrenceOffset} />
        </>}
      </Panel>
    </ReportDialog>}
    {dialog === "appointments" && <ReportDialog title="Agendamentos por data de entrega" description="Registros do período organizados pela data e hora da entrega, não pelo cadastro." onClose={() => setDialog(null)}>
      <Panel title="Agendamentos por data de entrega" hint="Mais recentes primeiro; respeita os filtros de período e lojas.">
        {latest.isPending && <p role="status" className="text-sm text-slate-300">Carregando agendamentos…</p>}
        {latest.isError && <Failure retry={() => void latest.refetch()} text="Não foi possível consultar os agendamentos recentes." />}
        {latest.data && <>
          <ReportTable label="Agendamentos recentes" headings={["Data", "Horário", "Loja", "Fornecedor", "Situação"]}>
            {latest.data.rows.map((row, index) => <tr key={row.date + row.storeCode + index}>
              <td className={cells}>{formatDay(row.date)}</td><td className={cells}>{row.time || "—"}</td>
              <td className={cells}>{row.storeCode}</td><td className={cells}>{row.supplier}</td>
              <td className={cells}><LatestBadge status={row.status} /></td>
            </tr>)}
            {!latest.data.rows.length && <tr><td colSpan={5} className={cells}>Nenhum agendamento encontrado.</td></tr>}
          </ReportTable>
          <Pager offset={recentOffset} total={latest.data.total} onChange={setRecentOffset} />
        </>}
      </Panel>
    </ReportDialog>}
  </section>;
}
