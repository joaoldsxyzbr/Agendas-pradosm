import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/operations/status-badge";
import { getAgendaDetail } from "./api";
import { formatDay } from "./model";

const statusInfo: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  aguardando: { label: "Aguardando", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  nao_chegou: { label: "Não recebido", tone: "danger" },
  recusado: { label: "Recusado", tone: "danger" },
};

export function AgendaDetailDialog({ agendaId, onClose }: {
  agendaId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["receiving", "detail", agendaId],
    queryFn: () => getAgendaDetail(agendaId),
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const appointments = query.data?.appointments.filter(item => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return !term || `${item.supplier} ${item.protocol}`.toLocaleLowerCase("pt-BR").includes(term);
  }) ?? [];
  const agenda = query.data?.agenda;
  return <dialog ref={ref} aria-labelledby="detail-heading" onClose={onClose}
    onClick={(event) => { if (event.target === ref.current) ref.current.close(); }}
    className="m-auto max-h-[min(92dvh,900px)] w-[min(94vw,850px)] max-w-none overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Consulta da agenda</p>
        <h2 id="detail-heading" className="truncate text-base font-bold">{agenda ? `Agenda ${agenda.storeCode} — ${agenda.storeName}` : "Detalhes da agenda"}</h2>
      </div>
      <Button aria-label="Fechar detalhes" size="icon" variant="secondary" onClick={() => ref.current?.close()}><X size={17} /></Button>
    </div>
    <div className="space-y-4 p-4">
      {query.isPending && <p role="status" className="text-sm text-slate-300">Carregando detalhes…</p>}
      {query.isError && <div role="alert" className="space-y-2">
        <p className="text-sm text-rose-300">Não foi possível carregar os detalhes da agenda.</p>
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>}
      {agenda && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-300">Data: <strong className="text-white">{formatDay(agenda.date)}</strong></span>
          <StatusBadge tone={agenda.dayStatus === "concluido" ? "success" : "warning"}>{agenda.dayStatus === "concluido" ? "Concluído" : "Em andamento"}</StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Indicadores da agenda">
          {[
            ["total", query.data?.appointments.length ?? 0],
            ["aguardando", query.data?.appointments.filter(x => x.status === "aguardando").length ?? 0],
            ["recebidos", query.data?.appointments.filter(x => x.status === "recebido").length ?? 0],
            ["não recebidos", query.data?.appointments.filter(x => x.status === "nao_chegou").length ?? 0],
          ].map(([label, value]) => <span key={label} className="rounded-md border border-[#37516b] bg-[#20334c] px-3 py-2 text-xs text-slate-300"><strong className="mr-2 text-white tabular-nums">{value}</strong>{label}</span>)}
        </div>
        <label className="relative block">
          <span className="sr-only">Pesquisar fornecedor ou protocolo</span>
          <Search aria-hidden="true" size={16} className="absolute top-2.5 left-3 text-slate-400" />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar fornecedor ou protocolo"
            className="h-9 w-full rounded-md border border-slate-600 bg-[#101e30] pr-3 pl-9 text-xs text-white outline-none focus-visible:border-sky-400" />
        </label>
        <div className="max-h-[45dvh] space-y-2 overflow-y-auto" aria-label="Agendamentos">
          {appointments.length === 0 && <p className="rounded-md border border-[#37516b] p-3 text-xs text-slate-400">Nenhum fornecedor ou protocolo encontrado.</p>}
          {appointments.map(item => {
            const status = statusInfo[item.status] ?? { label: item.status, tone: "neutral" as const };
            return <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#38516e] bg-[#1b2d43] p-3">
              <div className="min-w-0 space-y-1">
                <strong className="block text-xs text-white">{item.supplier}</strong>
                <span className="text-[11px] text-slate-400">Protocolo {item.protocol} · {item.startTime}–{item.endTime}</span>
                {item.observation && <p className="text-xs text-amber-200">{item.observation}</p>}
              </div>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </article>;
          })}
        </div>
        <p className="border-t border-[#34516d] pt-3 text-[11px] text-slate-400">Somente consulta nesta etapa. Edição de agenda, reabertura e fornecedores manuais permanecem na versão atual.</p>
      </>}
    </div>
  </dialog>;
}
