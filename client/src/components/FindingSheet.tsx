import { useRef, useState } from "react";
import { catalogItem, categoryLabel, itemSource, requirementOf } from "@shared/catalog";
import { REGULATIONS, type RegulationKey } from "@shared/regulations";
import { DEFAULT_DEADLINE_DAYS, RISK_LEVEL_LABELS, riskLevel, riskScore, type RiskThresholds } from "@shared/risk";
import type { LocalFinding } from "../lib/visitStore";
import { RiskMatrix } from "./RiskMatrix";
import { RiskBadge, Sheet } from "./ui";
import { PhotoThumb } from "./PhotoThumb";
import { clsx, heDate } from "../lib/format";
import {
  BAKAR_SOURCE,
  MAZMIN_48H_SOURCE,
  STOP_REASONS,
  STOP_REASON_IDS,
  STOP_REASON_SHORT,
  STOP_SOURCE,
  isSafetyController,
  isSafetyOfficer,
} from "@shared/stopReasons";

/** פרטים שהממונה על הבטיחות צריך לטופס המקוון של הפסקת עבודה */
export type StopContext = { siteName: string; address: string; contractor: string; authorName: string; visitDate: string };

const DEADLINES: [number, string][] = [
  [0, "מיידי"],
  [1, "יום"],
  [3, "3 ימים"],
  [7, "שבוע"],
  [14, "שבועיים"],
  [30, "חודש"],
];

export function FindingSheet({
  finding,
  thresholds,
  recentLocations,
  readOnly,
  onChange,
  onRemove,
  onClose,
  onAddPhoto,
  onRemovePhoto,
  authorRole,
  stopContext,
}: {
  authorRole: string;
  stopContext: StopContext;
  finding: LocalFinding | null;
  thresholds: RiskThresholds;
  recentLocations: string[];
  readOnly: boolean;
  onChange: (patch: Partial<LocalFinding>) => void;
  onRemove: () => void;
  onClose: () => void;
  onAddPhoto: (file: File) => Promise<void>;
  onRemovePhoto: (pid: string) => void;
}) {
  const [showReq, setShowReq] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  if (!finding) return null;
  const item = catalogItem(finding.catalogId);
  const level = riskLevel(finding.likelihood, finding.severity, thresholds);
  const score = riskScore(finding.likelihood, finding.severity);
  const deadline = finding.deadlineDays ?? (level ? DEFAULT_DEADLINE_DAYS[level] : null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await onAddPhoto(f);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={finding.carriedFromId ? "ממצא מהביקור הקודם" : item ? "ממצא מהמאגר" : "ממצא נוסף"}
      footer={
        <div className="flex gap-2">
          {!readOnly && (
            <button
              className="btn-ghost text-danger-700"
              onClick={() => {
                if (confirm("למחוק את הממצא מהדוח?")) onRemove();
              }}
            >
              מחיקה
            </button>
          )}
          <button className="btn-primary flex-1" onClick={onClose}>
            סיום
          </button>
        </div>
      }
    >
      <fieldset disabled={readOnly} className="space-y-4">
        {finding.carriedFromId && (
          <div className="card p-3">
            <div className="mb-2 text-[13px] font-bold text-navy-600">מצב הממצא בביקור הזה</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={clsx("btn", finding.followStatus === "fixed" ? "bg-emerald-600 text-white" : "border border-navy-100 bg-white text-navy-700")}
                onClick={() => onChange({ followStatus: "fixed" })}
              >
                ✓ תוקן
              </button>
              <button
                type="button"
                className={clsx("btn", finding.followStatus !== "fixed" ? "bg-danger-500 text-white" : "border border-navy-100 bg-white text-navy-700")}
                onClick={() => onChange({ followStatus: "open" })}
              >
                עדיין פתוח
              </button>
            </div>
          </div>
        )}

        <div className="card p-4">
          {item ? (
            <>
              <div className="mb-1 text-[12px] font-bold text-gold-700">
                {categoryLabel(item.cat)} · {item.topic}
              </div>
              <div className="text-[16px] font-extrabold leading-snug text-navy-900">{item.title}</div>
              <div className="mt-2 text-[12px] font-bold text-navy-500">{itemSource(item)}</div>
              {requirementOf(item) && (
                <button type="button" className="mt-2 text-[12px] font-bold text-navy-700 underline" onClick={() => setShowReq(!showReq)}>
                  {showReq ? "הסתרת נוסח הדרישה" : "נוסח הדרישה"}
                </button>
              )}
              {showReq && <p className="mt-2 rounded-xl bg-navy-50 p-3 text-[13px] leading-relaxed text-navy-700">{requirementOf(item)}</p>}
            </>
          ) : (
            <div className="space-y-2">
              <label className="label">תיאור הממצא</label>
              <textarea
                className="input min-h-[80px]"
                value={finding.customTitle ?? ""}
                placeholder="מה נמצא באתר"
                onChange={(e) => onChange({ customTitle: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="input col-span-2"
                  value={finding.customReg ?? ""}
                  onChange={(e) => onChange({ customReg: e.target.value || null })}
                >
                  <option value="">מקור (לא חובה)</option>
                  {(Object.keys(REGULATIONS) as RegulationKey[]).map((k) => (
                    <option key={k} value={k}>
                      {REGULATIONS[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="מס' תקנה"
                  value={finding.customRegNo ?? ""}
                  onChange={(e) => onChange({ customRegNo: e.target.value || null })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[14px] font-extrabold text-navy-800">הערכת סיכון</span>
            <RiskBadge level={level} score={score} />
          </div>
          <RiskMatrix
            likelihood={finding.likelihood}
            severity={finding.severity}
            thresholds={thresholds}
            onChange={(l, s) => onChange({ likelihood: l, severity: s })}
          />
          {level === "unacceptable" && (
            <div className="mt-3 rounded-xl bg-danger-50 p-3 ring-1 ring-danger-500/30">
              <div className="text-[14px] font-extrabold text-danger-700">{RISK_LEVEL_LABELS.unacceptable} — טיפול מיידי</div>
              {isSafetyController(authorRole) && (
                <p className="mt-1 text-[13px] leading-relaxed text-navy-800">
                  דיווח מיידי בכתב למזמין, למבצע הבנייה, למנהל האתר ולמנהל העבודה. המזמין מאשר בכתב תוך 48 שעות שניתן מענה לסיכון.
                  <span className="mt-0.5 block text-[11px] text-navy-500">
                    {BAKAR_SOURCE}; {MAZMIN_48H_SOURCE}
                  </span>
                </p>
              )}
              <label className="mt-2 flex items-center gap-2 text-[14px] font-bold text-navy-800">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#C62828]"
                  checked={finding.workStopped}
                  onChange={(e) => onChange(e.target.checked ? { workStopped: true } : { workStopped: false, stopReason: null, regulatorNotifiedAt: null })}
                />
                {isSafetyOfficer(authorRole) ? "הוריתי על הפסקת העבודה הקשורה בסיכון" : "העבודה הקשורה בסיכון הופסקה"}
              </label>
              {isSafetyOfficer(authorRole) && finding.workStopped && (
                <StopReport finding={finding} title={item ? item.title : (finding.customTitle ?? "")} ctx={stopContext} readOnly={readOnly} onChange={onChange} />
              )}
            </div>
          )}
          {level && level !== "unacceptable" && finding.followStatus !== "fixed" && (
            <div className="mt-3">
              <div className="label">יעד לתיקון</div>
              <div className="flex flex-wrap gap-1.5">
                {DEADLINES.map(([d, t]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChange({ deadlineDays: d })}
                    className={clsx("chip", deadline === d ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 bg-white text-navy-700")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-3 p-4">
          <div>
            <label className="label">מיקום באתר</label>
            <input className="input" value={finding.location} placeholder="קומה, אגף, ציר" onChange={(e) => onChange({ location: e.target.value })} />
            {recentLocations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recentLocations.slice(0, 6).map((l) => (
                  <button key={l} type="button" className="chip border-navy-100 bg-white text-navy-600" onClick={() => onChange({ location: l })}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">הערה</label>
            <textarea className="input min-h-[70px]" value={finding.note ?? ""} placeholder="מה ראית, מה נדרש לעשות" onChange={(e) => onChange({ note: e.target.value })} />
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[14px] font-extrabold text-navy-800">תמונות</span>
            {busy && <span className="text-[12px] text-navy-500">מעבד…</span>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {finding.photoIds.map((pid) => (
              <PhotoThumb key={pid} id={pid} onOpen={setZoom} onRemove={readOnly ? undefined : () => onRemovePhoto(pid)} />
            ))}
          </div>
          {!readOnly && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => camRef.current?.click()}>
                📷 צילום
              </button>
              <button type="button" className="btn-ghost" onClick={() => galRef.current?.click()}>
                🖼️ מהגלריה
              </button>
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files).then(() => (e.target.value = ""))} />
              <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files).then(() => (e.target.value = ""))} />
            </div>
          )}
        </div>
      </fieldset>
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </Sheet>
  );
}

/** הפסקת עבודה בידי ממונה על הבטיחות: בחירת סיבה מהתוספת הראשונה, ותזכורת להודעה למפקח העבודה האזורי */
function StopReport({
  finding,
  title,
  ctx,
  readOnly,
  onChange,
}: {
  finding: LocalFinding;
  title: string;
  ctx: StopContext;
  readOnly: boolean;
  onChange: (patch: Partial<LocalFinding>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const r = finding.stopReason ?? null;
  const sentAt = finding.regulatorNotifiedAt ? new Date(finding.regulatorNotifiedAt) : null;

  const copy = async () => {
    const text = [
      "דיווח על הפסקת עבודה — לטופס המקוון",
      `שם מבצע הבנייה: ${ctx.contractor || "—"}`,
      `הממונה על הבטיחות: ${ctx.authorName || "—"}`,
      `שם הפרויקט: ${ctx.siteName || "—"}`,
      `כתובת: ${ctx.address || "—"}`,
      `תאריך הביקור: ${heDate(ctx.visitDate)}`,
      `הסיבה (התוספת הראשונה): ${r}. ${r ? STOP_REASONS[r] : ""}`,
      `הממצא: ${title}${finding.location ? ` — ${finding.location}` : ""}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* אין הרשאה ללוח — לא קריטי */
    }
  };

  return (
    <div className="mt-3 border-t border-danger-500/20 pt-3">
      <label className="block">
        <span className="label">הסיבה להפסקה לפי התוספת הראשונה</span>
        <select
          className="input"
          value={r ?? ""}
          onChange={(e) => onChange(e.target.value ? { stopReason: Number(e.target.value) } : { stopReason: null, regulatorNotifiedAt: null })}
        >
          <option value="">— לא אחת מ-11 הסיבות —</option>
          {STOP_REASON_IDS.map((n) => (
            <option key={n} value={n}>
              {n}. {STOP_REASON_SHORT[n]}
            </option>
          ))}
        </select>
      </label>
      {r ? (
        <>
          <p className="mt-2 text-[12px] leading-relaxed text-navy-600">{STOP_REASONS[r]}</p>
          <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-danger-500/40">
            <div className="text-[14px] font-extrabold text-danger-700">חובה להודיע למפקח העבודה האזורי</div>
            <ul className="mt-1 list-disc space-y-0.5 pr-5 text-[13px] text-navy-800">
              <li>בטופס המקוון "דיווח על הפסקת עבודה" שבתוספת הראשונה</li>
              <li>וגם דיווח מיידי למנהל העבודה, לבקר הבטיחות ולמנהל האתר</li>
            </ul>
            <div className="mt-1 text-[11px] text-navy-500">{STOP_SOURCE}</div>
            <button type="button" className="btn-ghost mt-2 w-full py-2 text-[13px]" onClick={copy}>
              {copied ? "הועתק ✓" : "העתקת הפרטים לטופס"}
            </button>
            {sentAt ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                <span className="text-[13px] font-bold text-emerald-700">
                  ✓ נשלחה הודעה למפקח העבודה האזורי, {sentAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                {!readOnly && (
                  <button type="button" className="text-[12px] font-bold text-navy-500 underline" onClick={() => onChange({ regulatorNotifiedAt: null })}>
                    ביטול
                  </button>
                )}
              </div>
            ) : (
              <button type="button" className="btn-primary mt-2 w-full" onClick={() => onChange({ regulatorNotifiedAt: new Date().toISOString() })}>
                שלחתי את הטופס למפקח העבודה האזורי
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-navy-500">
          אם ההפסקה היא בגלל אחת מ-11 הסיבות שבתוספת הראשונה, בחר אותה: יש חובה להודיע עליה למפקח העבודה האזורי.
        </p>
      )}
    </div>
  );
}
