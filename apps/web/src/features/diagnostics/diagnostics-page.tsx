import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { Button } from "@/components/ui/button";
import { listStores, storesKey } from "@/features/stores/api";
import { listUsers, usersKey } from "@/features/users/api";
import {
  EVENT_LABELS, auditLogKey, diagnosticsKey, emptyDiagnosticsFilters, listAuditRecords,
  listDiagnosticRecords, type AuditRecord, type DiagnosticRecord, type DiagnosticsFilters,
  type DiagnosticsTab,
} from "./api";

const surface = "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#344d69] bg-[#142338] shadow-lg";
const input = "h-9 min-w-0 w-full rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400 disabled:opacity-50";
const tabs: Array<{ id: DiagnosticsTab; label: string }> = [
  { id: "errors", label: "Erros" },
  { id: "operations", label: "Operações" },
  { id: "audit", label: "Auditoria" },
];

const dateBR = (value: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
};

const levelTone: Record<DiagnosticRecord["level"], string> = {
  error: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};

function diagnosticDetails(item: DiagnosticRecord) {
  return [
    item.format?.toUpperCase() ?? null,
    item.count == null ? null : item.count + " registros",
    item.durationMs == null ? null : item.durationMs + " ms",
    item.httpStatus == null ? null : "HTTP " + item.httpStatus,
  ].filter(Boolean).join(" · ");
}

function DiagnosticRow({ item }: { item: DiagnosticRecord }) {
  return <tr data-testid={"diagnostic-" + item.id} className="hover:bg-[#1c3047]">
    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{dateBR(item.createdAt)}</td>
    <td className="px-4 py-3">
      <strong className="block text-xs text-white">{EVENT_LABELS[item.event] ?? item.event}</strong>
      <small className="block text-[11px] text-slate-400">{item.operation} · {item.source}</small>
    </td>
    <td className="px-4 py-3"><span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (levelTone[item.level] ?? "")}>{item.level}</span></td>
    <td className="px-4 py-3 text-xs text-slate-300">
      {diagnosticDetails(item) || "—"}
      {item.correlationId && <small className="block text-[11px] text-slate-500" title={item.correlationId}>ID: {item.correlationId.slice(0, 8)}</small>}
    </td>
    <td className="px-4 py-3 text-xs text-slate-300">{item.user?.name ?? "Sistema"}</td>
  </tr>;
}

function AuditRow({ item }: { item: AuditRecord }) {
  return <tr data-testid={"audit-" + item.id} className="hover:bg-[#1c3047]">
    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{dateBR(item.createdAt)}</td>
    <td className="px-4 py-3">
      <strong className="block text-xs text-white">{item.action.replaceAll("_", " ")}</strong>
      <small className="block text-[11px] text-slate-400">{item.entity ?? "—"}</small>
    </td>
    <td className="px-4 py-3 text-xs text-slate-300">{item.user?.name ?? "Sistema"}</td>
    <td className="px-4 py-3 text-xs text-slate-300">{item.details ?? "—"}</td>
  </tr>;
}

export function DiagnosticsPage() {
  const [tab, setTab] = useState<DiagnosticsTab>("errors");
  const [draft, setDraft] = useState<DiagnosticsFilters>(emptyDiagnosticsFilters);
  const [applied, setApplied] = useState<DiagnosticsFilters>(emptyDiagnosticsFilters);
  const usersQuery = useQuery({ queryKey: usersKey, queryFn: listUsers });
  const storesQuery = useQuery({ queryKey: storesKey, queryFn: listStores });
  const records = useQuery({
    queryKey: [...(tab === "audit" ? auditLogKey : diagnosticsKey), tab, applied],
    queryFn: async (): Promise<AuditRecord[] | DiagnosticRecord[]> =>
      tab === "audit" ? listAuditRecords(applied) : listDiagnosticRecords(applied, tab === "errors"),
  });
  const data = records.data;
  const auditItems: AuditRecord[] = tab === "audit" ? (data ?? []) as AuditRecord[] : [];
  const diagnosticItems: DiagnosticRecord[] = tab === "audit" ? []
    : tab === "operations" ? ((data ?? []) as DiagnosticRecord[]).filter(item => item.level !== "error")
      : ((data ?? []) as DiagnosticRecord[]);
  const count = tab === "audit" ? auditItems.length : diagnosticItems.length;
  const reload = () => void records.refetch();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setApplied({ ...draft });
  };
  return <section className="mx-auto w-full min-w-0 max-w-[1450px] overflow-x-clip space-y-5" aria-label="Logs e auditoria">
    <PageHeader eyebrow="Administração" title="Logs e Auditoria"
      description="Diagnostique falhas técnicas e consulte alterações realizadas no sistema."
      actions={<Button variant="secondary" onClick={reload}><RefreshCw size={14} />Atualizar</Button>} />
    <div role="tablist" aria-label="Categoria de registros" className="flex min-w-0 flex-wrap gap-2">
      {tabs.map(entry => {
        const active = tab === entry.id;
        return <Button key={entry.id} role="tab" aria-selected={active} variant={active ? "secondary" : "ghost"}
          onClick={() => setTab(entry.id)} className={active ? "border-sky-400" : ""}>{entry.label}</Button>;
      })}
    </div>
    <form onSubmit={submit} aria-label="Filtros de registros"
      className={surface + " grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"}>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Data (UTC)
        <input type="date" className={input} value={draft.date}
          onChange={event => setDraft(value => ({ ...value, date: event.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Origem
        <select className={input} aria-label="Origem" disabled={tab === "audit"} value={draft.origem}
          onChange={event => setDraft(value => ({ ...value, origem: event.target.value }))}>
          <option value="">Todas</option><option value="browser">Navegador</option><option value="worker">Worker</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Área
        <select className={input} aria-label="Área" disabled={tab === "audit"} value={draft.operacao}
          onChange={event => setDraft(value => ({ ...value, operacao: event.target.value }))}>
          <option value="">Todas</option><option value="importacao">Importação</option>
          <option value="aplicativo">Aplicativo</option><option value="api">API</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Usuário
        <select className={input} aria-label="Usuário" value={draft.userId}
          onChange={event => setDraft(value => ({ ...value, userId: event.target.value }))}>
          <option value="">Todos</option>
          {(usersQuery.data ?? []).map(user => <option key={user.id} value={user.id}>{user.nome}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Loja
        <select className={input} aria-label="Loja" value={draft.storeId}
          onChange={event => setDraft(value => ({ ...value, storeId: event.target.value }))}>
          <option value="">Todas</option>
          {(storesQuery.data ?? []).map(store => <option key={store.id} value={store.id}>{store.codigo} · {store.nome}</option>)}
        </select>
      </label>
      <Button type="submit">Filtrar</Button>
    </form>
    {records.isPending && <p role="status" className="text-xs text-slate-300">Carregando registros…</p>}
    {records.isError && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-xs text-rose-300">
      Não foi possível carregar os registros de auditoria.
      <Button size="sm" variant="secondary" onClick={reload}>Tentar novamente</Button>
    </div>}
    {records.data && <>
      <p role="status" className="text-xs text-slate-400">
        {count} registros nesta consulta (máximo de 100).
      </p>
      <div className={surface}>
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          {tab === "audit"
            ? <table aria-label="Registros de auditoria" className="w-full min-w-[640px] border-collapse">
              <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
                <th className="px-4 py-3">Data</th><th className="px-4 py-3">Alteração</th>
                <th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Detalhes</th></tr></thead>
              <tbody className="divide-y divide-[#344d69]">
                {auditItems.map(item => <AuditRow key={item.id} item={item} />)}
                {!auditItems.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum registro encontrado para esta consulta.</td></tr>}
              </tbody>
            </table>
            : <table aria-label="Registros de diagnóstico" className="w-full min-w-[760px] border-collapse">
              <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
                <th className="px-4 py-3">Data</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Nível</th>
                <th className="px-4 py-3">Informações</th><th className="px-4 py-3">Responsável</th></tr></thead>
              <tbody className="divide-y divide-[#344d69]">
                {diagnosticItems.map(item => <DiagnosticRow key={item.id} item={item} />)}
                {!diagnosticItems.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum registro encontrado para esta consulta.</td></tr>}
              </tbody>
            </table>}
        </div>
      </div>
    </>}
  </section>;
}
