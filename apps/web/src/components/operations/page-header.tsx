import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-sky-400">{eyebrow}</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
      <p className="text-xs text-slate-400">{description}</p>
    </div>
    {actions}
  </header>;
}
