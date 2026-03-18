import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
  tone?: "info" | "success" | "error";
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-green-200 bg-green-50 text-green-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

export default function StatusBanner({ children, tone = "info" }: Props) {
  if (!children) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}
