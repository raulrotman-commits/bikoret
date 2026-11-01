import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { env, isProd } from "./env";
import type { User } from "./schema";
import { rsStatus, type RsStatus } from "./rs";

const COOKIE = "bk_session";
const MAX_AGE_DAYS = 60;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function setSession(res: Response, userId: number) {
  const token = jwt.sign({ uid: userId }, env.JWT_SECRET, { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: MAX_AGE_DAYS * 24 * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export async function userFromRequest(req: Request): Promise<User | null> {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { uid: number };
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, payload.uid)).limit(1);
    return u ?? null;
  } catch {
    return null;
  }
}

export type Access = {
  admin: boolean;
  /** מותר ליצור ולערוך דוחות */
  active: boolean;
  /** מקור הגישה: מנהל, מנוי רוטמן בטיחות, הארכה ידנית, ניסיון, או אין */
  via: "admin" | "subscription" | "manual" | "trial" | "none";
  /** עד מתי הגישה בתוקף (למנהל: null) */
  until: string | null;
  /** ימי ניסיון שנותרו (הגבוה מבין הניסיון כאן והניסיון באתר הראשי) */
  trialLeft: number;
  /** האם הבדיקה מול האתר הראשי הצליחה */
  rsChecked: boolean;
};

const isOwner = (u: User) => Boolean(env.OWNER_EMAIL) && u.email.toLowerCase() === env.OWNER_EMAIL;

/** מנהל המערכת (ניהול לקוחות) — רק לפי החשבון כאן */
export const isAdminUser = (u: User) => u.isAdmin || isOwner(u);

/**
 * הגישה ליצירת דוחות: ביקורת שטח כלולה במנוי רוטמן בטיחות.
 * מנוי פעיל באתר הראשי עם אותו מייל פותח גישה. בנוסף: מנהל, הארכה ידנית מהמנהל, או ניסיון.
 */
export function accessOf(u: User, rs: RsStatus): Access {
  const now = Date.now();
  const days = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86400000)) : 0);
  const localTrial = u.trialEndsAt ? new Date(u.trialEndsAt).toISOString() : null;
  const manual = u.paidUntil && new Date(u.paidUntil).getTime() > now ? new Date(u.paidUntil).toISOString() : null;
  const rsTrial = rs.kind === "trial" ? rs.until : null;
  const trialUntil = [localTrial, rsTrial].filter((d): d is string => Boolean(d) && new Date(d!).getTime() > now).sort().pop() ?? null;
  const trialLeft = days(trialUntil);
  const base = { trialLeft, rsChecked: rs.checked };

  if (isAdminUser(u) || rs.kind === "admin") return { ...base, admin: isAdminUser(u), active: true, via: "admin", until: null };
  const sub = rs.kind === "subscription" ? rs.until : null;
  if (sub || manual) {
    // אם יש גם מנוי וגם הארכה ידנית — מציגים את המאוחר מביניהם
    const viaSub = Boolean(sub) && (!manual || sub! >= manual);
    return { ...base, admin: false, active: true, via: viaSub ? "subscription" : "manual", until: viaSub ? sub : manual };
  }
  if (trialLeft > 0) return { ...base, admin: false, active: true, via: "trial", until: trialUntil };
  return { ...base, admin: false, active: false, via: "none", until: null };
}

export async function accessFor(u: User, fresh = false): Promise<Access> {
  // למנהל אין צורך לפנות לאתר הראשי
  const rs = isAdminUser(u) ? ({ kind: "none", until: null, checked: true } as RsStatus) : await rsStatus(u.email, fresh);
  return accessOf(u, rs);
}

export function publicUser(u: User, access: Access) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    authorRole: u.authorRole,
    licenseNo: u.licenseNo,
    companyName: u.companyName,
    companyPhone: u.companyPhone,
    companyEmail: u.companyEmail,
    brandColor: u.brandColor,
    hasLogo: Boolean(u.logoKey),
    logoVersion: u.logoKey ? u.logoKey.split("/").pop() : null,
    access,
  };
}
