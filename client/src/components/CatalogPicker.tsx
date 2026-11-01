import { useMemo, useRef, useState } from "react";
import { CATALOG, FOCUS_TOPICS_LIST, itemSourceShort, type CatItem } from "../lib/catalogClient";
import { searchCatalog, suggestFromNotes } from "../lib/search";
import { Sheet } from "./ui";
import { clsx } from "../lib/format";

type SR = { new (): { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void } };

/** בחירת ליקוי מהמאגר: חיפוש, תחומים, נושאי מיקוד והצעות מהערות שטח */
export function CatalogPicker({
  open,
  onClose,
  addedIds,
  onPick,
  onCustom,
}: {
  open: boolean;
  onClose: () => void;
  addedIds: Set<number>;
  onPick: (item: CatItem) => void;
  onCustom: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"search" | "notes">("search");
  const [listening, setListening] = useState(false);
  const recRef = useRef<InstanceType<SR> | null>(null);

  const results = useMemo(() => {
    if (!q.trim() && !cat && !tag) return [];
    return searchCatalog(q, { cat: cat || undefined, tag: tag || undefined, limit: 150 });
  }, [q, cat, tag]);
  const suggestions = useMemo(() => (notes.trim().length > 2 ? suggestFromNotes(notes) : []), [notes]);

  const SpeechRec = (window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition;

  const dictate = () => {
    if (!SpeechRec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = new SpeechRec();
    r.lang = "he-IL";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
      setNotes((n) => (n ? n + ", " : "") + text);
      setMode("notes");
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };

  const list = mode === "notes" ? suggestions : results;

  return (
    <Sheet open={open} onClose={onClose} title="הוספת ממצא">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1">
        {(["search", "notes"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx("rounded-lg py-2 text-[14px] font-bold", mode === m ? "bg-white text-navy-800 shadow-sm" : "text-navy-500")}
          >
            {m === "search" ? "חיפוש במאגר" : "מהערות שטח"}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <>
          <input className="input mb-3" type="search" autoFocus placeholder="למשל: מעקה, פיגום, לוח חשמל, פנקס הדרכה" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
            <button className={clsx("chip", !cat ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 bg-white text-navy-700")} onClick={() => setCat("")}>
              הכל
            </button>
            {CATALOG.categories.map((c) => (
              <button
                key={c.key}
                className={clsx("chip", cat === c.key ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 bg-white text-navy-700")}
                onClick={() => setCat(cat === c.key ? "" : c.key)}
              >
                {c.icon} {c.label} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {FOCUS_TOPICS_LIST.map((t) => (
              <button
                key={t.tag}
                className={clsx("chip", tag === t.tag ? "border-gold-600 bg-gold-500 text-navy-900" : "border-gold-300 bg-gold-50 text-navy-800")}
                onClick={() => {
                  setTag(tag === t.tag ? "" : t.tag);
                  setQ("");
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mb-3">
          <div className="flex gap-2">
            <textarea
              className="input min-h-[84px] flex-1"
              placeholder="כתוב או הכתב מה ראית, למשל: אין מעקה בקומה 4, אין פנקס הדרכה, לוח חשמל פתוח"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {SpeechRec && (
              <button type="button" onClick={dictate} aria-label="הכתבה" className={clsx("w-12 shrink-0 rounded-xl text-xl", listening ? "animate-pulse bg-danger-500 text-white" : "bg-navy-800 text-white")}>
                🎤
              </button>
            )}
          </div>
          <p className="mt-1 text-[12px] text-navy-400">המערכת מחפשת במאגר ליקויים שמתאימים לכל חלק בהערה. בוחרים מה להוסיף.</p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((it) => {
          const added = addedIds.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onPick(it)}
              className={clsx("card flex w-full items-start gap-3 px-3 py-2.5 text-right", added && "border-emerald-500/50 bg-emerald-50")}
            >
              <span className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold", added ? "bg-emerald-600 text-white" : "bg-navy-800 text-white")}>
                {added ? "✓" : "+"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-snug text-navy-900">{it.title}</span>
                <span className="mt-0.5 block text-[11px] text-navy-500">
                  {it.topic} · {itemSourceShort(it)}
                </span>
              </span>
            </button>
          );
        })}
        {mode === "search" && (q.trim() || cat || tag) && results.length === 0 && <p className="py-6 text-center text-[14px] text-navy-500">לא נמצא ליקוי מתאים במאגר.</p>}
        {mode === "search" && !q.trim() && !cat && !tag && <p className="py-4 text-center text-[13px] text-navy-400">מחפשים במילים, או בוחרים תחום או נושא.</p>}
      </div>

      <button type="button" className="btn-ghost mt-4 w-full" onClick={onCustom}>
        + ממצא שלא מופיע במאגר
      </button>
    </Sheet>
  );
}
