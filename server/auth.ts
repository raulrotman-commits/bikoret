import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { env, isProd } from "./env";
import type { User } from "./schema";

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

/** האם למשתמש יש גישה ליצירת דוחות חדשים (ניסיון, מנוי בתוקף, או מנהל) */
export function accessOf(u: User) {
  const now = Date.now();
  const owner = Boolean(env.OWNER_EMAIL) && u.email.toLowerCase() === env.OWNER_EMAIL;
  const admin = u.isAdmin || owner;
  const trialLeft = Math.max(0, Math.ceil((new Date(u.trialEndsAt).getTime() - now) / 86400000));
  const paid = u.paidUntil ? new Date(u.paidUntil).getTime() > now : false;
  const active = admin || paid || trialLeft > 0;
  return {
    admin,
    active,
    paid,
    trialLeft,
    paidUntil: u.paidUntil ? new Date(u.paidUntil).toISOString() : null,
    plan: u.plan,
  };
}

export function publicUser(u: User) {
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
    access: accessOf(u),
  };
}
