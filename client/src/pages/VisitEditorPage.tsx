import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc, vanilla, errMsg } from "../lib/trpc";
import { useVisitEditor } from "../lib/useVisitEditor";
import { catalogItem, categoryLabel, itemSourceShort, type CatItem } from "../lib/catalogClient";
import { DEFAULT_THRESHOLDS, normalizeThresholds, riskLevel, riskScore } from "@shared/risk";
import { AUTHOR_ROLES } from "@shared/roles";
import { Empty, ErrorBox, Field, Page, RiskBadge, Spinner, SyncBadge, TopBar } from "../components/ui";
import { FindingSheet } from "../components/FindingSheet";
import { CatalogPicker } from "../components/CatalogPicker";
import { clsx, heDate } from "../lib/format";
import type { LocalFinding } from "../lib/visitStore";

const RECIPIENT_OPTIONS = ["המזמין", "מבצע הבנייה", "מנהל האתר", "מנהל העבודה", "ממונה הבטיחות", "בקר הבטיחות"];

export default function VisitEditorPage({ id }: { id: string }) {
  const ed = useVisitEditor(id);
  const { lv } = ed;
  const site = trpc.sites.get.useQuery({ id: lv?.visit.siteId ?? 0 }, { enabled: Boolean(lv?.visit.siteId) });
  const [tab, setTab] = useState<"findings" | "details">("findings");
  const [picker, setPicker] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalErr, setFinalErr] = useState("");
  const [, nav] = useLocation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (site.data) ed.setSiteSnap({ name: site.data.name, unacceptableFrom: site.data.unacceptableFrom, approvalFrom: site.data.approvalFrom });
  }, [site.data, ed.setSiteSnap]); // eslint-disable-line react-hooks/exhaustive-deps

  const thresholds = useMemo(() => normalizeThresholds(lv?.siteSnap ?? site.data ?? DEFAULT_THRESHOLDS), [lv?.siteSnap, site.data]);
  const readOnly = lv?.visit.status === "final";

  const carried = lv?.findings.filter((f) => f.carriedFromId) ?? [];
  const mine = lv?.findings.filter((f) => !f.carriedFromId) ?? [];
  const addedIds = useMemo(() => new Set((lv?.findings ?? []).filter((f) => f.catalogId != null).map((f) => f.catalogId!)), [lv?.findings]);
  const recentLocations = useMemo(
    () => [...new Set((lv?.findings ?? []).map((f) => f.location.trim()).filter(Boolean))].reverse(),
    [lv?.findings],
  );

  if (ed.status === "loading") return <Spinner />;
  if (ed.status === "missing" || !lv)
    return (
      <>
        <TopBar title="ביקור" back="/" />
        <Page>
          <Empty icon="📭" title="הביקור לא נמצא">ייתכן שנמחק, או שהוא נשמר במכשיר אחר.</Empty>
        </Page>
      </>
    );

  const open = lv.findings.find((f) => f.id === openId) ?? null;

  const pick = (it: CatItem) => {
    const existing = lv.findings.find((f) => f.catalogId === it.id);
    setPicker(false);
    if (existing) {
      setOpenId(existing.id);
      return;
    }
    setOpenId(ed.addFinding({ catalogId: it.id }));
  };

  const finalize = async () => {
    setFinalErr("");
    const unscored = lv.findings.filter((f) => !(f.carriedFromId && f.followStatus === "fixed") && (!f.likelihood || !f.severity));
    if (unscored.length && !confirm(`ל-${unscored.length} ממצאים אין הערכת סיכון. להפיק את הדוח בכל זאת?`)) return;
    if (!navigator.onLine) {
      setFinalErr("להפקת הדוח צריך חיבור לאינטרנט. הכול שמור במכשיר — אפשר להפיק כשתחזור הקליטה.");
      return;
    }
    setFinalizing(true);
    try {
      const s = await ed.flush();
      if (s !== "saved") throw new Error(s === "expired" ? "המנוי אינו פעיל" : "הסנכרון לא הושלם. נסה שוב בעוד רגע.");
      await vanilla.visits.finalize.mutate({ id });
      await ed.markFinal();
      await utils.visits.list.invalidate();
      nav(`/visit/${id}/report?done=1`);
    } catch (e) {
      setFinalErr(errMsg(e));
    } finally {
      setFinalizing(false);
    }
  };

  const reopen = async () => {
    try {
      await vanilla.visits.reopen.mutate({ id });
      await ed.markDraft();
    } catch (e) {
      setFinalErr(errMsg(e));
    }
  };

  const count = mine.length + carried.filter((f) => f.followStatus !== "fixed").length;
  const v = lv.visit;

  return (
    <>
      <TopBar
        title={lv.siteSnap?.name ?? site.data?.name ?? "ביקור"}
        sub={
          <span className="flex items-center gap-2">
            {heDate(v.visitDate)} <SyncBadge state={ed.sync} />
          </span>
        }
        back="/"
      />
      <div className="no-print sticky top-[calc(56px+env(safe-area-inset-top))] z-20 border-b border-navy-100 bg-white">
        <div className="mx-auto grid max-w-3xl grid-cols-2">
          {(["findings", "details"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx("py-3 text-[14px] font-extrabold", tab === t ? "border-b-[3px] border-gold-500 text-navy-800" : "text-navy-400")}
            >
              {t === "findings" ? `ממצאים (${count})` : "פרטי הדוח"}
            </button>
          ))}
        </div>
      </div>

      <Page>
        {readOnly && (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-navy-800 px-4 py-3 text-white">
            <span className="text-[14px] font-bold">הדוח הופק ונעול לעריכה</span>
            <div className="flex gap-2">
              <Link href={`/visit/${id}/report`} className="btn bg-gold-500 py-1.5 text-navy-900">לדוח</Link>
              <button className="btn bg-white/15 py-1.5 text-white" onClick={reopen}>פתיחה לעריכה</button>
            </div>
          </div>
        )}

        {tab === "findings" ? (
          <>
            {carried.length > 0 && (
              <section className="mb-5">
                <h2 className="mb-1 text-[15px] font-extrabold text-navy-800">מהביקור הקודם — לבדוק בעיניים אם תוקן</h2>
                <p className="mb-2 text-[12px] text-navy-500">לא מקבלים "תוקן" בדיווח. מסמנים רק מה שראית.</p>
                <div className="space-y-2">
                  {carried.map((f) => (
                    <CarriedRow key={f.id} f={f} thresholds={thresholds} readOnly={readOnly} onOpen={() => setOpenId(f.id)} onSet={(st) => ed.updateFinding(f.id, { followStatus: st })} />
                  ))}
                </div>
              </section>
            )}

            <section>
              {carried.length > 0 && <h2 className="mb-2 text-[15px] font-extrabold text-navy-800">ממצאים חדשים</h2>}
              {mine.length === 0 ? (
                <Empty icon="🦺" title="עוד אין ממצאים בביקור">מוסיפים ממצא מהמאגר, או ממצא חופשי.</Empty>
              ) : (
                <div className="space-y-2">
                  {mine.map((f) => (
                    <FindingRow key={f.id} f={f} thresholds={thresholds} onOpen={() => setOpenId(f.id)} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <DetailsForm lv={lv} readOnly={readOnly} onChange={(patch) => ed.update((d) => ({ ...d, visit: { ...d.visit, ...patch } }))} />
        )}

        <div className="mt-4">
          <ErrorBox>{finalErr}</ErrorBox>
        </div>
      </Page>

      {!readOnly && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 backdrop-blur" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-3xl gap-2 px-3 pt-2.5">
            <button className="btn-gold flex-[1.4] py-3.5 text-[16px]" onClick={() => setPicker(true)}>
              ＋ הוספת ממצא
            </button>
            <button className="btn-primary flex-1 py-3.5" disabled={finalizing} onClick={finalize}>
              {finalizing ? "מפיק…" : "הפקת דוח"}
            </button>
          </div>
        </div>
      )}

      <CatalogPicker
        open={picker}
        onClose={() => setPicker(false)}
        addedIds={addedIds}
        onPick={pick}
        onCustom={() => {
          setPicker(false);
          setOpenId(ed.addFinding({ customTitle: "" }));
        }}
      />

      {open && (
        <FindingSheet
          finding={open}
          thresholds={thresholds}
          recentLocations={recentLocations}
          readOnly={readOnly}
          onChange={(patch) => ed.updateFinding(open.id, patch)}
          onRemove={() => {
            ed.removeFinding(open.id);
            setOpenId(null);
          }}
          onClose={() => {
            if (!open.catalogId && !open.carriedFromId && !(open.customTitle ?? "").trim() && !open.photoIds.length) ed.removeFinding(open.id);
            setOpenId(null);
          }}
          onAddPhoto={(file) => ed.addPhoto(open.id, file)}
          onRemovePhoto={(pid) => ed.removePhoto(open.id, pid)}
        />
      )}
    </>
  );
}

function findingTitle(f: LocalFinding) {
  const item = catalogItem(f.catalogId);
  return item ? item.title : f.customTitle || "ממצא ללא תיאור";
}

function FindingRow({ f, thresholds, onOpen }: { f: LocalFinding; thresholds: ReturnType<typeof normalizeThresholds>; onOpen: () => void }) {
  const item = catalogItem(f.catalogId);
  const level = riskLevel(f.likelihood, f.severity, thresholds);
  return (
    <button onClick={onOpen} className={clsx("card block w-full px-4 py-3 text-right", level === "unacceptable" && "border-danger-500/50 ring-1 ring-danger-500/30")}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <RiskBadge level={level} score={riskScore(f.likelihood, f.severity)} small />
        {f.workStopped && <span className="rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">העבודה הופסקה</span>}
        {f.photoIds.length > 0 && <span className="text-[12px] text-navy-500">📷 {f.photoIds.length}</span>}
      </div>
      <div className="text-[15px] font-bold leading-snug text-navy-900">{findingTitle(f)}</div>
      <div className="mt-0.5 text-[12px] text-navy-500">
        {[item ? categoryLabel(item.cat) : "ממצא נוסף", f.location, item ? itemSourceShort(item) : ""].filter(Boolean).join(" · ")}
      </div>
    </button>
  );
}

function CarriedRow({
  f,
  thresholds,
  readOnly,
  onOpen,
  onSet,
}: {
  f: LocalFinding;
  thresholds: ReturnType<typeof normalizeThresholds>;
  readOnly: boolean;
  onOpen: () => void;
  onSet: (s: "open" | "fixed") => void;
}) {
  const fixed = f.followStatus === "fixed";
  return (
    <div className={clsx("card px-4 py-3", fixed && "opacity-70")}>
      <button onClick={onOpen} className="block w-full text-right">
        <div className="mb-1">
          <RiskBadge level={riskLevel(f.likelihood, f.severity, thresholds)} score={riskScore(f.likelihood, f.severity)} small />
        </div>
        <div className={clsx("text-[14px] font-bold leading-snug text-navy-900", fixed && "line-through")}>{findingTitle(f)}</div>
        {f.location && <div className="text-[12px] text-navy-500">{f.location}</div>}
      </button>
      {!readOnly && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className={clsx("btn py-2 text-[13px]", fixed ? "bg-emerald-600 text-white" : "border border-navy-100 bg-white text-navy-700")} onClick={() => onSet("fixed")}>
            ✓ ראיתי שתוקן
          </button>
          <button className={clsx("btn py-2 text-[13px]", !fixed ? "bg-danger-500 text-white" : "border border-navy-100 bg-white text-navy-700")} onClick={() => onSet("open")}>
            עדיין פתוח
          </button>
        </div>
      )}
    </div>
  );
}

function DetailsForm({
  lv,
  readOnly,
  onChange,
}: {
  lv: NonNullable<ReturnType<typeof useVisitEditor>["lv"]>;
  readOnly: boolean;
  onChange: (patch: Partial<NonNullable<ReturnType<typeof useVisitEditor>["lv"]>["visit"]>) => void;
}) {
  const v = lv.visit;
  const toggleRecipient = (r: string) => onChange({ recipients: v.recipients.includes(r) ? v.recipients.filter((x) => x !== r) : [...v.recipients, r] });
  return (
    <fieldset disabled={readOnly} className="space-y-4">
      <div className="card space-y-3 p-4">
        <Field label="תאריך הביקור">
          <input className="input" type="date" value={v.visitDate} onChange={(e) => onChange({ visitDate: e.target.value })} />
        </Field>
      </div>
      <div className="card space-y-3 p-4">
        <div className="text-[14px] font-extrabold text-navy-800">עורך הדוח</div>
        <Field label="שם">
          <input className="input" value={v.authorName} onChange={(e) => onChange({ authorName: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תפקיד">
            <select className="input" value={v.authorRole} onChange={(e) => onChange({ authorRole: e.target.value })}>
              {AUTHOR_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="מס' רישיון / רישום">
            <input className="input" value={v.authorLicense} onChange={(e) => onChange({ authorLicense: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="card space-y-3 p-4">
        <div className="text-[14px] font-extrabold text-navy-800">נציג מבצע הבנייה שליווה את הביקור</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם">
            <input className="input" value={v.contractorRepName} onChange={(e) => onChange({ contractorRepName: e.target.value })} />
          </Field>
          <Field label="תפקיד">
            <input className="input" value={v.contractorRepRole} onChange={(e) => onChange({ contractorRepRole: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="card p-4">
        <div className="label">הדוח מיועד ל־</div>
        <div className="flex flex-wrap gap-1.5">
          {RECIPIENT_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRecipient(r)}
              className={clsx("chip", v.recipients.includes(r) ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 bg-white text-navy-700")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <Field label="הערות כלליות לדוח">
          <textarea className="input min-h-[110px]" value={v.generalNotes ?? ""} onChange={(e) => onChange({ generalNotes: e.target.value })} />
        </Field>
      </div>
    </fieldset>
  );
}
