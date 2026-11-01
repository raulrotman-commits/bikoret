/**
 * חיבור למנוי של רוטמן בטיחות.
 * ביקורת שטח כלולה במנוי של האתר הראשי, ולכן הגישה נקבעת לפי המנוי שם, לפי אותו מייל.
 * קריאה בלבד מהטבלאות users ו-subscriptions של האתר הראשי. לא כותבים לשם כלום.
 */
import mysql from "mysql2/promise";
import { env } from "./env";

export type RsKind = "admin" | "subscription" | "trial" | "none";
export type RsStatus = {
  kind: RsKind;
  /** סוף המנוי או סוף הניסיון באתר הראשי */
  until: string | null;
  /** false כשהחיבור לא מוגדר או שהבדיקה נכשלה ואין תוצאה קודמת */
  checked: boolean;
};

const NONE: RsStatus = { kind: "none", until: null, checked: true };
const UNKNOWN: RsStatus = { kind: "none", until: null, checked: false };
const RANK: Record<RsKind, number> = { none: 0, trial: 1, subscription: 2, admin: 3 };
const TTL_MS = 60_000;

let pool: mysql.Pool | null = null;
function getPool() {
  if (!env.RS_DATABASE_URL) return null;
  pool ??= mysql.createPool({ uri: env.RS_DATABASE_URL, connectionLimit: 3, charset: "utf8mb4", timezone: "Z", connectTimeout: 5000 });
  return pool;
}

export const rsConfigured = () => Boolean(env.RS_DATABASE_URL);

const cache = new Map<string, { at: number; v: RsStatus }>();

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

type Row = { email: string; role: string | null; subUntil: unknown; trialUntil: unknown };

/** הסטטוס הטוב ביותר מבין כל החשבונות באתר הראשי עם אותו מייל */
function best(rows: Row[]): RsStatus {
  let v: RsStatus = NONE;
  for (const r of rows) {
    const cand: RsStatus =
      r.role === "admin"
        ? { kind: "admin", until: null, checked: true }
        : r.subUntil
          ? { kind: "subscription", until: iso(r.subUntil), checked: true }
          : r.trialUntil
            ? { kind: "trial", until: iso(r.trialUntil), checked: true }
            : NONE;
    if (RANK[cand.kind] > RANK[v.kind] || (cand.kind === v.kind && (cand.until ?? "") > (v.until ?? ""))) v = cand;
  }
  return v;
}

async function query(emails: string[]): Promise<Row[]> {
  const p = getPool();
  if (!p || !emails.length) return [];
  const [rows] = await p.query(
    `SELECT LOWER(u.email) AS email, u.role AS role,
            (SELECT MAX(s.endDate) FROM subscriptions s
              WHERE s.userId = u.id AND s.status = 'active' AND s.endDate >= NOW()) AS subUntil,
            CASE WHEN u.trialEndsAt > NOW() THEN u.trialEndsAt END AS trialUntil
       FROM users u
      WHERE LOWER(u.email) IN (?)`,
    [emails],
  );
  return rows as Row[];
}

const norm = (e: string) => e.trim().toLowerCase();

/** סטטוס המנוי של מייל אחד. fresh=true עוקף את המטמון (למשל אחרי שהלקוח רכש מנוי). */
export async function rsStatus(email: string, fresh = false): Promise<RsStatus> {
  if (!rsConfigured()) return UNKNOWN;
  const key = norm(email);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.v;
  try {
    const v = best(await query([key]));
    cache.set(key, { at: Date.now(), v });
    return v;
  } catch (e) {
    console.error("[rs] subscription check failed:", (e as Error).message);
    // תקלה זמנית במסד של האתר הראשי לא אמורה לנעול מנוי משלם: נשענים על התוצאה האחרונה
    return hit?.v ?? UNKNOWN;
  }
}

/** בדיקה מרוכזת לרשימת לקוחות (מסך הניהול) */
export async function rsStatusMany(emails: string[]): Promise<Map<string, RsStatus>> {
  const out = new Map<string, RsStatus>();
  const keys = [...new Set(emails.map(norm))];
  if (!rsConfigured()) {
    for (const k of keys) out.set(k, UNKNOWN);
    return out;
  }
  try {
    const rows = await query(keys);
    const by = new Map<string, Row[]>();
    for (const r of rows) by.set(r.email, [...(by.get(r.email) ?? []), r]);
    for (const k of keys) {
      const v = best(by.get(k) ?? []);
      cache.set(k, { at: Date.now(), v });
      out.set(k, v);
    }
  } catch (e) {
    console.error("[rs] bulk subscription check failed:", (e as Error).message);
    for (const k of keys) out.set(k, cache.get(k)?.v ?? UNKNOWN);
  }
  return out;
}

/** בדיקה בעלייה: האם החיבור למסד של האתר הראשי עובד (לוג בלבד) */
export async function rsSelfCheck() {
  const p = getPool();
  if (!p) {
    console.warn("[rs] RS_DATABASE_URL is not set — access by Rotman Safety subscription is off");
    return;
  }
  try {
    const [rows] = await p.query("SELECT COUNT(*) AS n FROM users");
    const [subs] = await p.query("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND endDate >= NOW()");
    console.log(`[rs] link to main site OK: ${(rows as { n: number }[])[0].n} users, ${(subs as { n: number }[])[0].n} active subscriptions`);
  } catch (e) {
    console.error("[rs] link to main site FAILED:", (e as Error).message);
  }
}
