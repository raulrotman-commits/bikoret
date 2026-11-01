import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc, vanilla, errMsg } from "../lib/trpc";
import { Empty, ErrorBox, Spinner, TopBar } from "../components/ui";
import { heDate, clsx } from "../lib/format";
import type { ReportData, ReportFinding } from "@shared/visit-types";
import { RISK_LEVEL_LABELS, describeThresholds } from "@shared/risk";
import { loadLocal, saveLocal } from "../lib/visitStore";
import { BAKAR_SOURCE, MAZMIN_48H_SOURCE, STOP_REASONS, STOP_SOURCE, isSafetyController, isSafetyOfficer } from "@shared/stopReasons";

const sentTime = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function OwnerReportPage({ id }: { id: string }) {
  const q = trpc.visits.report.useQuery({ id });
  const done = new URLSearchParams(useSearch()).get("done") === "1";
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  if (q.isLoading) return <Spinner />;
  if (!q.data) return <Empty icon="📄" title="הדוח לא נמצא">{q.error && errMsg(q.error)}</Empty>;
  const r = q.data;
  const url = r.visit.shareUrl;

  const waText = () => {
    const lines = [`*דוח ביקור בטיחות — ${r.site.name}*`, `תאריך: ${heDate(r.visit.visitDate)}`, `${r.counts.total} ממצאים פתוחים`];
    if (r.counts.unacceptable) lines.push(`⚠️ ${r.counts.unacceptable} סיכונים שאינם קבילים — נדרש טיפול מיידי`);
    if (r.counts.fixed) lines.push(`✓ ${r.counts.fixed} ממצאים מהביקור הקודם תוקנו`);
    if (url) lines.push("", `לדוח המלא עם התמונות: ${url}`);
    return lines.join("\n");
  };

  const reopen = async () => {
    setErr("");
    try {
      await vanilla.visits.reopen.mutate({ id });
      const lv = await loadLocal(id);
      if (lv) await saveLocal({ ...lv, visit: { ...lv.visit, status: "draft" } });
      await utils.visits.invalidate();
      nav(`/visit/${id}`);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <>
      <TopBar title="הדוח" sub={r.site.name} back="/" />
      <div className="no-print mx-auto max-w-3xl px-3 pt-4">
        {isSafetyOfficer(r.visit.authorRole) && r.findings.some((f) => f.stopReason && !f.regulatorNotifiedAt) && (
          <div className="mb-3 rounded-2xl bg-danger-500 px-4 py-3 text-white">
            <div className="text-[15px] font-extrabold">חובה להודיע למפקח העבודה האזורי</div>
            <div className="text-[13px] opacity-95">
              בדוח יש הפסקת עבודה מסיבה שבתוספת הראשונה, ועדיין לא סומן שהטופס המקוון נשלח. מסמנים בממצא עצמו, בעריכת הביקור.
            </div>
          </div>
        )}
        {r.visit.status !== "final" ? (
          <div className="mb-3 rounded-2xl bg-gold-50 px-4 py-3 text-[14px] font-bold text-navy-800 ring-1 ring-gold-300">
            זו תצוגה מקדימה של טיוטה. <Link href={`/visit/${id}`} className="underline">חזרה לעריכה</Link>
          </div>
        ) : (
          <div className="card mb-4 p-4">
            {done && <div className="mb-3 text-[16px] font-extrabold text-emerald-700">✓ הדוח הופק</div>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <a className="btn bg-[#25D366] text-white" href={`https://wa.me/?text=${encodeURIComponent(waText())}`} target="_blank" rel="noreferrer">
                וואטסאפ
              </a>
              <button
                className="btn-ghost"
                onClick={async () => {
                  if (!url) return;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: `דוח ביקור בטיחות — ${r.site.name}`, text: waText(), url });
                      return;
                    } catch {
                      /* בוטל */
                    }
                  }
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                }}
              >
                {copied ? "הקישור הועתק ✓" : "שיתוף קישור"}
              </button>
              <button className="btn-primary" onClick={() => window.print()}>
                שמירה כ-PDF
              </button>
              <button className="btn-ghost" onClick={reopen}>
                פתיחה לעריכה
              </button>
            </div>
            <p className="mt-2 text-[12px] text-navy-400">הקישור פותח את הדוח עם התמונות, בלי צורך בחשבון.</p>
            <ErrorBox>{err}</ErrorBox>
          </div>
        )}
      </div>
      <Report r={r} />
    </>
  );
}

export function PublicReportPage({ token }: { token: string }) {
  const q = trpc.share.get.useQuery({ token }, { retry: false });
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <div className="p-6"><Empty icon="📄" title="הדוח לא נמצא">ייתכן שהקישור שגוי.</Empty></div>;
  if (q.data.pending)
    return (
      <div className="p-6">
        <Empty icon="✍️" title="הדוח בעדכון">עורך הדוח פתח אותו לעריכה. הגרסה המעודכנת תופיע כאן כשיפיק אותו שוב.</Empty>
      </div>
    );
  return (
    <>
      <div className="no-print mx-auto flex max-w-3xl justify-end px-3 pt-4">
        <button className="btn-primary" onClick={() => window.print()}>
          שמירה כ-PDF
        </button>
      </div>
      <Report r={q.data.report} />
    </>
  );
}

const LEVEL_BOX: Record<string, string> = {
  unacceptable: "bg-[#C62828] text-white",
  approval: "bg-[#D4A018] text-[#06102B]",
  acceptable: "bg-[#2E7D32] text-white",
};

function Report({ r }: { r: ReportData }) {
  const c = r.brand.color || "#0D2153";
  const roles: [string, string][] = [
    ["המזמין", r.site.client],
    ["מבצע הבנייה", r.site.contractor],
    ["מנהל העבודה", r.site.workManager],
    ["מנהל האתר", r.site.siteManager],
    ["ממונה הבטיחות", r.site.safetyOfficer],
  ].filter(([, v]) => v) as [string, string][];
  const unacceptable = r.findings.filter((f) => f.level === "unacceptable");

  return (
    <article className="mx-auto my-4 max-w-3xl bg-white px-5 py-6 text-[#0B1530] shadow-sm print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none sm:rounded-2xl">
      <header className="flex items-start gap-4 border-b-4 pb-4" style={{ borderColor: c }}>
        {r.brand.logoUrl && <img src={r.brand.logoUrl} alt="" className="h-16 w-auto max-w-[140px] object-contain" />}
        <div className="flex-1">
          <div className="text-[13px] font-bold" style={{ color: c }}>{r.brand.companyName}</div>
          <h1 className="text-[24px] font-extrabold leading-tight">דוח ביקור בטיחות</h1>
          <div className="text-[15px] font-bold">{r.site.name}{r.site.address && ` · ${r.site.address}`}</div>
        </div>
        <div className="text-left text-[13px] leading-relaxed">
          <div className="font-extrabold">{heDate(r.visit.visitDate)}</div>
          {r.brand.companyPhone && <div dir="ltr">{r.brand.companyPhone}</div>}
          {r.brand.companyEmail && <div dir="ltr">{r.brand.companyEmail}</div>}
        </div>
      </header>

      <section className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2 print:grid-cols-2">
        <div>
          <div className="mb-1 font-extrabold" style={{ color: c }}>האתר ובעלי התפקידים</div>
          {roles.map(([k, v]) => (
            <div key={k}>
              <span className="text-[#5A6A8F]">{k}: </span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 font-extrabold" style={{ color: c }}>הביקור</div>
          <div>
            <span className="text-[#5A6A8F]">עורך הדוח: </span>
            <span className="font-bold">
              {r.visit.authorName}
              {r.visit.authorRole && `, ${r.visit.authorRole}`}
              {r.visit.authorLicense && ` (מס' ${r.visit.authorLicense})`}
            </span>
          </div>
          {r.visit.contractorRepName && (
            <div>
              <span className="text-[#5A6A8F]">ליווה את הביקור: </span>
              <span className="font-bold">
                {r.visit.contractorRepName}
                {r.visit.contractorRepRole && `, ${r.visit.contractorRepRole}`}
              </span>
            </div>
          )}
          {r.visit.recipients.length > 0 && (
            <div>
              <span className="text-[#5A6A8F]">מיועד ל: </span>
              <span className="font-bold">{r.visit.recipients.join(", ")}</span>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-4 gap-2 text-center print-break-avoid">
        <Stat n={r.counts.total} label="ממצאים פתוחים" color={c} />
        <Stat n={r.counts.unacceptable} label="סיכון שאינו קביל" color="#C62828" />
        <Stat n={r.counts.approval} label="דורש אישור" color="#B78A12" />
        <Stat n={r.counts.fixed} label="תוקנו מהביקור הקודם" color="#2E7D32" />
      </section>
      <p className="mt-2 text-[11px] text-[#5A6A8F]">הערכת הסיכון: {describeThresholds({ unacceptableFrom: r.site.unacceptableFrom, approvalFrom: r.site.approvalFrom })}</p>

      {unacceptable.length > 0 && (
        <section className="mt-4 rounded-xl border-2 border-[#C62828] bg-[#FDECEC] p-3 print-break-avoid">
          <div className="text-[15px] font-extrabold text-[#8E1B1B]">סיכונים שאינם קבילים — נדרש טיפול מיידי</div>
          <ul className="mt-1 list-inside list-disc text-[13px] font-bold text-[#8E1B1B]">
            {unacceptable.map((f) => (
              <li key={f.id}>
                ממצא {f.n}: {f.title}
                {f.workStopped && (isSafetyOfficer(r.visit.authorRole) ? " — הממונה על הבטיחות הורה על הפסקת העבודה הקשורה בסיכון" : " — העבודה הקשורה בסיכון הופסקה")}
                {f.stopReason && ` (סיבה ${f.stopReason} בתוספת הראשונה)`}
                {f.regulatorNotifiedAt && ` — נשלחה הודעה למפקח העבודה האזורי, ${sentTime(f.regulatorNotifiedAt)}`}
              </li>
            ))}
          </ul>
          {isSafetyController(r.visit.authorRole) && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#8E1B1B]">
              על סיכון שאינו קביל מדווח בקר הבטיחות מיד, בכתב, למזמין, למבצע הבנייה, למנהל האתר ולמנהל העבודה ({BAKAR_SOURCE}). המזמין יאשר בכתב, לא יאוחר
              מ-48 שעות ממועד הדיווח, כי ניתן מענה לסיכון, ואישורו יימסר למבצע הבנייה ({MAZMIN_48H_SOURCE}).
            </p>
          )}
          {isSafetyOfficer(r.visit.authorRole) && unacceptable.some((f) => f.stopReason) && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#8E1B1B]">
              הפסקת עבודה מסיבה שבתוספת הראשונה: הממונה על הבטיחות מדווח מיד למנהל העבודה, לבקר הבטיחות ולמנהל האתר, ומודיע למפקח העבודה האזורי בטופס המקוון ({STOP_SOURCE}).
            </p>
          )}
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-[17px] font-extrabold" style={{ color: c }}>ממצאים</h2>
        {r.findings.length === 0 ? (
          <p className="text-[14px]">לא נמצאו ליקויים בביקור.</p>
        ) : (
          <div className="space-y-3">
            {r.findings.map((f) => (
              <FindingBlock key={f.id} f={f} color={c} />
            ))}
          </div>
        )}
      </section>

      {r.fixedFromPrevious.length > 0 && (
        <section className="mt-6 print-break-avoid">
          <h2 className="mb-2 text-[17px] font-extrabold text-[#2E7D32]">תוקנו מאז הביקור הקודם (נבדק בשטח)</h2>
          <ul className="space-y-1 text-[13px]">
            {r.fixedFromPrevious.map((f) => (
              <li key={f.id} className="flex gap-2">
                <span className="font-extrabold text-[#2E7D32]">✓</span>
                <span>
                  {f.title}
                  {f.location && <span className="text-[#5A6A8F]"> · {f.location}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.visit.generalNotes && (
        <section className="mt-6 print-break-avoid">
          <h2 className="mb-1 text-[17px] font-extrabold" style={{ color: c }}>הערות כלליות</h2>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{r.visit.generalNotes}</p>
        </section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-8 text-[13px] print-break-avoid">
        <div>
          <div className="h-10 border-b border-[#AAB7D6]" />
          <div className="mt-1 text-[#5A6A8F]">חתימת עורך הדוח</div>
        </div>
        <div>
          <div className="h-10 border-b border-[#AAB7D6]" />
          <div className="mt-1 text-[#5A6A8F]">חתימת נציג מבצע הבנייה</div>
        </div>
      </section>

      <footer className="mt-8 border-t border-[#D5DCEC] pt-3 text-[11px] leading-relaxed text-[#5A6A8F]">
        הדוח מתעד את הממצאים שנמצאו במועד הביקור בלבד. אין בו כדי להעיד על תקינות דברים שלא נבדקו או לא צוינו בו.
        מקור כל ממצא מצוין לצידו; מספר תקנה מצוין רק לאחר שנבדק מול נוסח התקנות.
        <div className="mt-2 flex items-center justify-between">
          <span>
            הופק באמצעות <a href="https://www.rotmansafety.com" className="font-bold text-[#0D2153]">רוטמן בטיחות</a> · ביקורת שטח
          </span>
          <span>{r.visit.finalizedAt ? `הופק ${heDate(r.visit.finalizedAt)}` : "טיוטה"}</span>
        </div>
      </footer>
    </article>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#D5DCEC] px-1 py-2">
      <div className="text-[22px] font-extrabold tabular-nums" style={{ color }}>{n}</div>
      <div className="text-[11px] font-bold leading-tight text-[#5A6A8F]">{label}</div>
    </div>
  );
}

function FindingBlock({ f, color }: { f: ReportFinding; color: string }) {
  return (
    <div className={clsx("rounded-xl border p-3 print-break-avoid", f.level === "unacceptable" ? "border-[#C62828]" : "border-[#D5DCEC]")}>
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: color }}>
          {f.n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
            {f.level ? (
              <span className={clsx("rounded-full px-2 py-0.5", LEVEL_BOX[f.level])}>
                {f.score} · {RISK_LEVEL_LABELS[f.level]}
              </span>
            ) : (
              <span className="rounded-full bg-[#EEF1F8] px-2 py-0.5 text-[#5A6A8F]">ללא הערכת סיכון</span>
            )}
            {f.carried && <span className="rounded-full bg-[#EEF1F8] px-2 py-0.5 text-[#13286A]">פתוח מהביקור הקודם</span>}
            {f.recurring && <span className="rounded-full bg-[#FBF3DC] px-2 py-0.5 text-[#8A6500]">ליקוי חוזר</span>}
            {f.workStopped && <span className="rounded-full bg-[#06102B] px-2 py-0.5 text-white">העבודה הופסקה</span>}
            {f.deadline && <span className="rounded-full bg-[#EEF1F8] px-2 py-0.5 text-[#13286A]">יעד לתיקון: {f.deadline}</span>}
          </div>
          <div className="text-[15px] font-extrabold leading-snug">{f.title}</div>
          <div className="mt-0.5 text-[12px] text-[#5A6A8F]">
            {f.categoryLabel}
            {f.location && ` · מיקום: ${f.location}`}
          </div>
          {f.source && <div className="mt-1 text-[12px] font-bold text-[#13286A]">מקור: {f.source}</div>}
          {f.stopReason && (
            <div className="mt-1.5 rounded-lg bg-[#FDECEC] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#8E1B1B]">
              <span className="font-extrabold">סיבת הפסקת העבודה (סיבה {f.stopReason} בתוספת הראשונה): </span>
              {STOP_REASONS[f.stopReason]}
              {f.regulatorNotifiedAt && <div className="font-bold">נשלחה הודעה למפקח העבודה האזורי: {sentTime(f.regulatorNotifiedAt)}</div>}
            </div>
          )}
          {f.note && <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{f.note}</p>}
        </div>
      </div>
      {f.photos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {f.photos.map((p) => (
            <a key={p} href={p} target="_blank" rel="noreferrer">
              <img src={p} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
