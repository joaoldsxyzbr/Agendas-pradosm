import { cn } from "@/lib/utils";

// Indicadores de carregamento padronizados. Todo ponto que aguarda dados usa o
// mesmo spinner acessível (role="status"); as telas principais (Conferência e
// Recebimento) usam skeletons que preservam o layout da tabela enquanto os
// dados chegam, evitando salto de conteúdo.

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-sky-300", className)} />;
}

export function Loading({ label, className }: { label: string; className?: string }) {
  return <p role="status" className={cn("inline-flex items-center gap-2 text-slate-300", className)}>
    <Spinner className="size-3.5" />
    <span>{label}</span>
  </p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded bg-[#2a415c]", className)} />;
}

// Esqueleto de tabela: mantém a moldura visual das tabelas do sistema
// (bordas, cabeçalho, linhas zebradas) enquanto os dados carregam.
export function TableSkeleton({ label, rows = 6, widths, className }: {
  label: string; rows?: number; widths?: string[]; className?: string;
}) {
  const cols = widths ?? ["w-[16%]", "w-[16%]", "w-[24%]", "w-[16%]", "w-[16%]", "w-[12%]"];
  return <div role="status" aria-label={label} className={cn("w-full overflow-hidden rounded-xl border border-[#38516d] bg-[#142235] shadow-lg", className)}>
    <span className="sr-only">{label}</span>
    <div className="border-b border-[#38516d] bg-[#21374f]">
      <div className="flex items-center gap-6 px-3 py-2.5">
        {cols.map((width, index) => <Skeleton key={index} className={cn("h-2.5", width)} />)}
      </div>
    </div>
    <div className="divide-y divide-[#304865]">
      {Array.from({ length: rows }, (_, row) => <div key={row} className={cn("flex items-center gap-6 px-3 py-3.5", row % 2 ? "bg-[#1a2a40]" : "bg-[#142235]")}>
        {cols.map((width, index) => <Skeleton key={index} className={cn("h-3", width)} />)}
      </div>)}
    </div>
  </div>;
}
