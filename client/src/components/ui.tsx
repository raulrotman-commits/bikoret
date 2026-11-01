import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { clsx } from "../lib/format";
import type { SyncState } from "../lib/visitStore";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@shared/risk";

export const APP_NAME = "ביקורת שטח";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0D2153" />
      <path d="M32 11 50 18v13c0 11-7.6 19.4-18 22-10.4-2.6-18-11-18-22V18z" fill="none" stroke="#D4A018" strokeWidth="4" strokeLinejoin="round" />
      <path d="m24 32 6 6 11-12" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ title, back, right, sub }: { title: string; back?: string | true; right?: ReactNode; sub?: ReactNode }) {
  const [, nav] = useLocation();
  return (
    <header className="no-print sticky top-0 z-30 bg-navy-800 text-white shadow-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
        {back ? (
          <button
            aria-label="חזרה"
            className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-2xl hover:bg-white/10"
            onClick={() => (back === true ? history.back() : nav(back))}
          >
            →
          </button>
        ) : (
          <BrandMark size={30} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold leading-tight">{title}</h1>
          {sub && <div className="truncate text-[12px] text-gold-300">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={clsx("mx-auto w-full max-w-3xl px-3 pb-28 pt-4", className)}>{children}</main>;
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-[#F4F6FA] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-navy-100 bg-white px-4 py-3 sm:rounded-t-3xl rounded-t-3xl">
          <h2 className="flex-1 text-[16px] font-extrabold text-navy-800">{title}</h2>
          <button aria-label="סגירה" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-navy-700">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-navy-100 bg-white px-4 py-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
    </div>
  );
}

const LEVEL_STYLE: Record<RiskLevel, string> = {
  unacceptable: "bg-danger-500 text-white",
  approval: "bg-gold-500 text-navy-900",
  acceptable: "bg-emerald-600 text-white",
};

export function RiskBadge({ level, score, small }: { level: RiskLevel | null; score: number | null; small?: boolean }) {
  if (!level) return <span className={clsx("rounded-full bg-navy-50 font-bold text-navy-500", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]")}>ללא הערכת סיכון</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full font-extrabold", LEVEL_STYLE[level], small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]")}>
      {score != null && <span className="tabular-nums">{score}</span>}
      <span>{RISK_LEVEL_LABELS[level]}</span>
    </span>
  );
}

export function SyncBadge({ state }: { state: SyncState }) {
  const map: Record<SyncState, [string, string]> = {
    saved: ["נשמר בענן", "bg-emerald-500/20 text-emerald-100"],
    pending: ["שומר…", "bg-white/15 text-white"],
    offline: ["שמור במכשיר · יסונכרן", "bg-gold-500/25 text-gold-100"],
    error: ["שגיאת סנכרון", "bg-danger-500/40 text-white"],
    locked: ["הדוח הופק", "bg-white/15 text-white"],
    expired: ["המנוי אינו פעיל", "bg-danger-500/40 text-white"],
  };
  const [t, c] = map[state];
  return <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-bold", c)}>{t}</span>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="text-[16px] font-extrabold text-navy-800">{title}</div>
      {children && <div className="mt-1 text-[14px] text-navy-500">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-navy-400">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-2 text-[14px] font-bold text-danger-700">{children}</div>;
}

export function Spinner() {
  return <div className="mx-auto my-10 h-8 w-8 animate-spin rounded-full border-4 border-navy-100 border-t-navy-800" />;
}
