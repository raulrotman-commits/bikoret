import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { accessFor, accessOf, isAdminUser } from "../auth";
import { env } from "../env";
import { rsStatusMany } from "../rs";

/**
 * אין כאן תשלום נפרד: ביקורת שטח כלולה במנוי רוטמן בטיחות.
 * הלקוח רוכש מנוי באתר הראשי, ונכנס לכאן עם אותו מייל.
 */
export const billingRouter = router({
  info: publicProcedure.query(() => ({
    trialDays: env.TRIAL_DAYS,
    siteUrl: env.RS_SITE_URL,
    subscribeUrl: `${env.RS_SITE_URL}${env.RS_SUBSCRIBE_PATH}`,
  })),

  /** בדיקה מחדש מול האתר הראשי, בלי מטמון (למשל מיד אחרי רכישת מנוי) */
  status: protectedProcedure.query(({ ctx }) => accessFor(ctx.user, true)),
});

export const adminRouter = router({
  users: adminProcedure.query(async () => {
    const rows = await db
      .select({
        u: schema.users,
        visits: sql<number>`(select count(*) from bk_visits v where v.user_id = bk_users.id)`,
        sites: sql<number>`(select count(*) from bk_sites s where s.user_id = bk_users.id)`,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(500);
    const rs = await rsStatusMany(rows.filter(({ u }) => !isAdminUser(u)).map(({ u }) => u.email));
    const none = { kind: "none" as const, until: null, checked: true };
    return rows.map(({ u, visits, sites }) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      companyName: u.companyName,
      authorRole: u.authorRole,
      createdAt: u.createdAt.toISOString(),
      access: accessOf(u, rs.get(u.email.toLowerCase()) ?? none),
      visits: Number(visits),
      sites: Number(sites),
    }));
  }),

  /** גישה ידנית בלי מנוי (למשל לקוח בתקופת הדגמה) */
  extend: adminProcedure.input(z.object({ userId: z.number().int(), months: z.number().int().min(1).max(36) })).mutation(async ({ input }) => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, input.userId)).limit(1);
    if (!u) throw new TRPCError({ code: "NOT_FOUND" });
    const from = u.paidUntil && new Date(u.paidUntil) > new Date() ? new Date(u.paidUntil) : new Date();
    const until = new Date(from);
    until.setMonth(until.getMonth() + input.months);
    await db.update(schema.users).set({ paidUntil: until, plan: "manual" }).where(eq(schema.users.id, u.id));
    return { ok: true, paidUntil: until.toISOString() };
  }),
});
