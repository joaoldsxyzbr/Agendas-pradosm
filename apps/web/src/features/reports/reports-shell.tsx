// Apresentação reutilizável do relatório, isolada da busca e transformação de dados.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const panel = "min-w-0 rounded-xl border border-[#314b66] bg-[#142338] p-4 shadow-lg md:p-5";

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

export function HelpTip({ title }: { title: string }) {
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

export function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={panel + " " + className}>
    <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-white">{title}<HelpTip title={title} /></h3>
      {action}
    </div>
    {children}
  </section>;
}

export function Panel({ title, hint, actions, children }: { title: string; hint: string; actions?: ReactNode; children: ReactNode }) {
  return <section className={panel}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-1.5 text-base font-bold text-white">{title}<HelpTip title={title} /></h2><p className="mt-1 text-xs text-slate-400">{hint}</p></div>
      {actions}
    </header>
    {children}
  </section>;
}

export function ReportDialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
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

export function Failure({ retry, text }: { retry: () => void; text: string }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
    <span>{text}</span><Button variant="secondary" size="sm" onClick={retry}>Tentar novamente</Button>
  </div>;
}
