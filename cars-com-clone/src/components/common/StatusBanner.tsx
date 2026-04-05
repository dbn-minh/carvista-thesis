import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  tone?: "info" | "success" | "error";
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100",
};

export default function StatusBanner({ children, tone = "info" }: Props) {
  if (!children) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}
