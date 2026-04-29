import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  tone?: "info" | "success" | "error";
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  info: "border-white/10 bg-[rgba(255,255,255,0.06)] text-slate-200",
  success:
    "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  error:
    "border-rose-400/20 bg-rose-500/10 text-rose-100",
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
