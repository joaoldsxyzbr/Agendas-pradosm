import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "neutral" | "danger";
const tones: Record<Tone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  neutral: "border-slate-600 bg-slate-700/30 text-slate-300",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export function StatusBadge({ children, tone = "neutral" }: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}
