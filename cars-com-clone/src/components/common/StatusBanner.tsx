import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  tone?: "info" | "success" | "error";
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  info:
    "border-slate-200/80 bg-white/88 text-slate-700 dark:border-white/10 dark:bg-[rgba(255,255,255,0.06)] dark:text-slate-200",
  success:
    "border-sky-300/80 bg-sky-500/95 text-white dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  error:
    "border-rose-300/80 bg-rose-500/92 text-white dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100",
};

export default function StatusBanner({ children, tone = "info" }: Props) {
  if (!children) return null;
  return (
    <div
      className={`rounded-[22px] border px-4 py-3.5 text-sm leading-6 break-words shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:px-5 ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
