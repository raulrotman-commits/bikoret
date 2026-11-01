import { LIKELIHOOD_LABELS, SEVERITY_LABELS, riskLevel, type RiskThresholds } from "@shared/risk";
import { clsx } from "../lib/format";

const CELL: Record<string, string> = {
  unacceptable: "bg-danger-500/90 text-white",
  approval: "bg-gold-300 text-navy-900",
  acceptable: "bg-emerald-500/80 text-white",
};

/**
 * מטריצת סיכון 4×4: שורות = חומרה (4 למעלה), עמודות = סבירות (1 מימין).
 * לחיצה אחת על תא קובעת את שני הערכים.
 */
export function RiskMatrix({
  likelihood,
  severity,
  thresholds,
  onChange,
}: {
  likelihood: number | null | undefined;
  severity: number | null | undefined;
  thresholds: RiskThresholds;
  onChange: (l: number | null, s: number | null) => void;
}) {
  return (
    <div>
      <div className="flex items-stretch gap-1.5">
        <div className="flex w-[74px] shrink-0 flex-col gap-1.5">
          <div className="flex h-6 items-end justify-center text-[11px] font-extrabold text-navy-500">חומרה ↓ / סבירות ←</div>
          {[4, 3, 2, 1].map((s) => (
            <div key={s} className="flex h-11 flex-col items-center justify-center rounded-lg bg-white text-center leading-tight">
              <span className="text-[13px] font-extrabold text-navy-800">{s}</span>
              <span className="text-[10px] text-navy-500">{SEVERITY_LABELS[s]}</span>
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((l) => (
            <div key={l} className="flex h-6 flex-col items-center justify-end text-center leading-none">
              <span className="text-[12px] font-extrabold text-navy-800">{l}</span>
              <span className="text-[10px] text-navy-500">{LIKELIHOOD_LABELS[l]}</span>
            </div>
          ))}
          {[4, 3, 2, 1].map((s) =>
            [1, 2, 3, 4].map((l) => {
              const lvl = riskLevel(l, s, thresholds)!;
              const sel = likelihood === l && severity === s;
              return (
                <button
                  key={`${s}-${l}`}
                  type="button"
                  aria-label={`סבירות ${l}, חומרה ${s}, ציון ${l * s}`}
                  onClick={() => (sel ? onChange(null, null) : onChange(l, s))}
                  className={clsx(
                    "flex h-11 items-center justify-center rounded-lg text-[15px] font-extrabold tabular-nums transition",
                    CELL[lvl],
                    sel ? "scale-105 ring-4 ring-navy-800 ring-offset-1" : "opacity-75 hover:opacity-100",
                  )}
                >
                  {l * s}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
