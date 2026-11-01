import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { accessOf } from "../auth";
import { env, hasCardcom } from "../env";
import { createPaymentPage, getResult } from "../cardcom";

export const PLANS = {
  monthly: { label: "מנוי חודשי", months: 1 },
  yearly: { label: "מנוי שנתי", months: 12 },
} as const;

function price(plan: keyof typeof PLANS) {
  return plan === "monthly" ? env.PRICE_MONTHLY : env.PRICE_YEARLY;
}

/** הארכת המנוי אחרי תשלום מאומת. נקרא מה-webhook ומבדיקת הסטטוס. אידמפוטנטי. */
export async function confirmPayment(lowProfileId: string) {
  const [p] = await db.select().from(schema.payments).where(eq(schema.payments.lowProfileId, lowProfileId)).limit(1);
  if (!p || p.status === "paid") return p?.status === "paid";
  const r = await getResult(lowProfileId);
  // סכום העסקה חייב להתאים למה שביקשנו
  if (r.ok && r.amount != null && Math.abs(Number(r.amount) - Number(p.amount)) > 0.01) {
    await db.update(schema.payments).set({ status: "failed", raw: JSON.stringify(r.raw) }).where(eq(schema.payments.id, p.id));
    return false;
  }
  if (!r.ok) {
    await db.update(schema.payments).set({ raw: JSON.stringify(r.raw) }).where(eq(schema.payments.id, p.id));
    return false;
  }
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, p.userId)).limit(1);
  if (!u) return false;
  const months = PLANS[p.plan as keyof typeof PLANS]?.months ?? 1;
  const from = u.paidUntil && new Date(u.paidUntil) > new Date() ? new Date(u.paidUntil) : new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + months);
  await db.update(schema.users).set({ paidUntil: until, plan: p.plan }).where(eq(schema.users.id, u.id));
  await db.update(schema.payments).set({ status: "paid", paidAt: new Date(), raw: JSON.stringify(r.raw) }).where(eq(schema.payments.id, p.id));
  return true;
}

export const billingRouter = router({
  plans: publicProcedure.query(() => ({
    enabled: hasCardcom && env.PRICE_MONTHLY > 0,
    trialDays: env.TRIAL_DAYS,
    plans: (Object.keys(PLANS) as (keyof typeof PLANS)[])
      .filter((k) => price(k) > 0)
      .map((k) => ({ key: k, label: PLANS[k].label, price: price(k), months: PLANS[k].months })),
  })),

  status: protectedProcedure.query(({ ctx }) => accessOf(ctx.user)),

  checkout: protectedProcedure.input(z.object({ plan: z.enum(["monthly", "yearly"]) })).mutation(async ({ ctx, input }) => {
    if (!hasCardcom) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "התשלום עדיין לא הופעל. פנה לרוטמן בטיחות." });
    const amount = price(input.plan);
    if (!(amount > 0)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "המחיר טרם הוגדר" });
    const ref = `bk-${ctx.user.id}-${nanoid(8)}`;
    const page = await createPaymentPage({
      amount,
      productName: `ביקורת שטח — ${PLANS[input.plan].label}`,
      returnValue: ref,
      customerName: ctx.user.companyName || ctx.user.fullName,
      customerEmail: ctx.user.email,
    });
    await db.insert(schema.payments).values({
      userId: ctx.user.id,
      lowProfileId: page.lowProfileId,
      plan: input.plan,
      amount: String(amount),
      status: "pending",
      createdAt: new Date(),
    });
    return { url: page.url };
  }),

  /** אחרי חזרה מדף התשלום: מאמתים את העסקאות הפתוחות של המשתמש */
  confirmPending: protectedProcedure.mutation(async ({ ctx }) => {
    const pending = await db
      .select()
      .from(schema.payments)
      .where(sql`${schema.payments.userId} = ${ctx.user.id} and ${schema.payments.status} = 'pending'`)
      .orderBy(desc(schema.payments.createdAt))
      .limit(3);
    let any = false;
    for (const p of pending) any = (await confirmPayment(p.lowProfileId)) || any;
    return { confirmed: any };
  }),
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
    return rows.map(({ u, visits, sites }) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      companyName: u.companyName,
      authorRole: u.authorRole,
      createdAt: u.createdAt.toISOString(),
      access: accessOf(u),
      visits: Number(visits),
      sites: Number(sites),
    }));
  }),

  /** הארכה ידנית (למשל ללקוח שמשלם בהעברה בנקאית) */
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
