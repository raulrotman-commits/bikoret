/**
 * חיפוש במאגר הליקויים. זה חיפוש מילים רגיל ולא בינה מלאכותית, וכך הוא גם מוצג למשתמש.
 * מנטרל הבדלי כתיב מלא/חסר, תחיליות (ו, ה, ב, ל, מ, ש, כ) ומילים נרדפות מהשטח.
 */
import { CATALOG, requirementOf, type CatItem } from "@shared/catalog";

const NIQQUD = /[֑-ׇ]/g;
const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const PREFIXES = ["וכש", "וה", "שה", "בה", "לה", "מה", "כש", "ו", "ה", "ב", "ל", "מ", "ש", "כ"];
const STOP = new Set(["של", "את", "על", "עם", "או", "אם", "כי", "לא", "אין", "יש", "גם", "רק", "זה", "זו", "כל", "אחד", "באתר", "אתר"]);

/**
 * מילים נרדפות מהשטח → מונחי התקנות. משקל נמוך = מילה רחבה מדי לבדה
 * (למשל "גידור" מופיע גם בגידור חלקי מכונות), שמחזקת התאמה אבל לא מספיקה לבד.
 */
type Syn = string | [string, number];
const SYNONYMS: Record<string, Syn[]> = {
  מעקה: ["מעקה", "אזן יד", "אזן תיכון", "לוח רגל", ["גידור", 0.5], ["ליפול", 0.4], ["נפילה", 0.4], ["משטח עבודה", 0.4]],
  מעקות: ["מעקה", "אזן יד", "אזן תיכון", "לוח רגל", ["גידור", 0.5], ["ליפול", 0.4], ["נפילה", 0.4]],
  גדר: ["גידור"],
  קסדה: ["קסדת מגן", "קסדה"],
  קסדות: ["קסדת מגן", "קסדות"],
  רתמה: ["רתמה", "רתמת", "מערכת למניעת נפילה"],
  חגורה: ["רתמה"],
  חור: ["פתח", "חלל"],
  בור: [["פתח", 0.7], "חפירה", "בור"],
  פיר: ["פיר", "פתח"],
  מנוף: ["עגורן", "מכונת הרמה"],
  מלגזה: ["מלגזה"],
  במה: ["בימה מתרוממת", "במה"],
  סל: ["סל להרמת אדם", "סל"],
  חשמל: ["חשמל"],
  לוח: ["לוח חשמל", "לוח"],
  פחת: ["מפסק מגן", "זרם דלף"],
  כבל: ["כבל", "פתיל"],
  כבלים: ["כבלים", "פתילי"],
  שלט: ["שלט", "שילוט"],
  משקפיים: ["משקפי מגן"],
  כפפות: ["כפפות"],
  נעליים: ["נעלי", "נעליים"],
  תדריך: ["הדרכה"],
  הדרכה: ["הדרכה", "הודרך"],
  מדריך: ["מדריך עבודה בגובה", "בעל מקצוע מתאים"],
  פיגום: ["פיגום"],
  פיגומים: ["פיגום", "פיגומים"],
  סולם: ["סולם"],
  חפירה: ["חפירה", "דיפון"],
  טפסות: ["טפסות", "טפסה"],
  ספיר: ["תומכות", "תמיכות"],
  ספירים: ["תומכות", "תמיכות"],
  תוכנית: ["תכנית", "תוכנית"],
  תכנית: ["תכנית", "תוכנית"],
  פנקס: ["פנקס"],
};

function normChar(t: string) {
  return t
    .replace(NIQQUD, "")
    .replace(/[״"׳']/g, "")
    .replace(/[־\-–—]/g, " ")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c]);
}

/** שלד מילה: בלי ו/י באמצע (כתיב מלא/חסר) */
function skel(w: string) {
  return w.length <= 2 ? w : w[0] + w.slice(1).replace(/[וי]/g, "");
}

function stripPrefix(w: string) {
  for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 3) return w.slice(p.length);
  return w;
}

export function normText(t: string) {
  return normChar(t)
    .replace(/[^א-ת0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => skel(w))
    .join(" ");
}

type Alt = { t: string; w: number };

function queryTokens(q: string): Alt[][] {
  // כל מילה → רשימת חלופות (כולל מילים נרדפות); נדרשת התאמה לכל מילה
  const words = normChar(q).replace(/[^א-ת0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  return words.map((w) => {
    const alts = new Map<string, number>();
    const base = stripPrefix(w);
    alts.set(skel(base), 1);
    for (const syn of SYNONYMS[w] ?? SYNONYMS[base] ?? []) {
      const [term, weight] = typeof syn === "string" ? [syn, 1] : syn;
      const t = normText(term);
      alts.set(t, Math.max(alts.get(t) ?? 0, weight));
    }
    return [...alts].map(([t, w2]) => ({ t, w: w2 }));
  });
}

interface Indexed {
  item: CatItem;
  title: string;
  topic: string;
  req: string;
}

let INDEX: Indexed[] | null = null;
function index() {
  if (!INDEX) {
    INDEX = CATALOG.items.map((item) => ({
      item,
      title: " " + normText(item.title) + " ",
      topic: " " + normText(item.topic + " " + item.sub) + " ",
      req: " " + normText(requirementOf(item)) + " ",
    }));
  }
  return INDEX;
}

function scoreAlt(e: Indexed, alt: string) {
  // התאמה בתחילת מילה (כדי ש"גידור" ימצא גם "הגידור", ולא אותיות באמצע מילה)
  const hit = (hay: string) => hay.includes(" " + alt) || new RegExp(` [והבלמשכ]{1,2}${alt}`).test(hay);
  return (hit(e.title) ? 3 : 0) + (hit(e.topic) ? 2 : 0) + (hit(e.req) ? 1 : 0);
}

export function searchCatalog(q: string, opts: { cat?: string; tag?: string; limit?: number; any?: boolean } = {}) {
  const groups = queryTokens(q);
  let pool = index();
  if (opts.cat) pool = pool.filter((e) => e.item.cat === opts.cat);
  if (opts.tag) pool = pool.filter((e) => e.item.tags.includes(opts.tag!));
  if (!groups.length) return pool.slice(0, opts.limit ?? 500).map((e) => e.item);
  const scored: [number, CatItem][] = [];
  for (const e of pool) {
    let total = 0;
    let matched = 0;
    for (const alts of groups) {
      let g = 0;
      let core = false;
      for (const a of alts) {
        const sc = scoreAlt(e, a.t);
        if (sc > 0) {
          g += sc * a.w;
          if (a.w >= 0.7) core = true;
        }
      }
      if (core) matched++;
      total += g;
    }
    const ok = opts.any ? matched > 0 : matched === groups.length;
    if (ok) scored.push([total + matched * 2, e.item]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, opts.limit ?? 200).map((s) => s[1]);
}

/**
 * הצעות ליקויים מהערות שטח חופשיות, למשל: "אין מעקה בקומה 4, אין פנקס הדרכה".
 * כל קטע בהערה מחופש בנפרד, ומוצעות ההתאמות הטובות ביותר לכל קטע.
 */
export function suggestFromNotes(notes: string, limit = 12) {
  const segments = notes
    .split(/[,;\n.]+|\s+ו(?=(?:אין|חסר|ללא|לא)\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const out: CatItem[] = [];
  const seen = new Set<number>();
  for (const seg of segments) {
    const strict = searchCatalog(seg, { limit: 3 });
    const res = strict.length ? strict : searchCatalog(seg, { limit: 3, any: true });
    for (const it of res) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
