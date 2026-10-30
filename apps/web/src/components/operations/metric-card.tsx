import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "amber" | "green" | "red";
const tones: Record<Tone, { icon: string; number: string }> = {
  blue: { icon: "bg-blue-500/15 text-blue-300", number: "text-blue-200" },
  amber: { icon: "bg-amber-500/15 text-amber-300", number: "text-amber-300" },
  green: { icon: "bg-emerald-500/15 text-emerald-300", number: "text-emerald-300" },
  red: { icon: "bg-rose-500/15 text-rose-300", number: "text-rose-300" },
};

export function MetricCard({ label, value, icon, tone = "blue" }: {
  label: string; value: number; icon: ReactNode; tone?: Tone;
}) {
  return <div className="flex min-h-[76px] min-w-0 items-center justify-center gap-2.5 border-b border-r border-[#304865] px-2.5 py-2.5 last:border-r-0 sm:border-b-0">
    <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-full", tones[tone].icon)}>{icon}</span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <strong className={cn("text-[22px] leading-none font-bold tabular-nums", tones[tone].number)}>{value}</strong>
      <span className="text-[11px] leading-snug text-slate-300">{label}</span>
    </span>
  </div>;
}
