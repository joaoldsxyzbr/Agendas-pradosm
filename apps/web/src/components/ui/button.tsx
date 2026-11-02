import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Componente de propriedade do projeto, seguindo o padrao shadcn/ui.
const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-blue-400 bg-blue-500 text-white hover:bg-blue-400",
        secondary: "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700",
        ghost: "text-slate-300 hover:bg-slate-800",
        danger: "border border-rose-500/50 bg-rose-600/15 text-rose-200 hover:bg-rose-600/25",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>;

export function Button({ className, variant, size, type = "button", ...props }: Props) {
  return <button type={type} className={cn(variants({ variant, size }), className)} {...props} />;
}
