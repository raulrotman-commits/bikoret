import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { accessFor, checkPassword, clearSession, hashPassword, publicUser, setSession } from "../auth";
import { env } from "../env";
import { resetEmailHtml, sendEmail } from "../email";
import { AUTHOR_ROLES } from "../../shared/roles";

const email = z.string().trim().toLowerCase().email("כתובת מייל לא תקינה");
const password = z.string().min(8, "סיסמה של 8 תווים לפחות");

export const accountRouter = router({
  me: publicProcedure.query(async ({ ctx }) => (ctx.user ? publicUser(ctx.user, await accessFor(ctx.user)) : null)),

  signup: publicProcedure
    .input(z.object({ email, password, fullName: z.string().trim().min(2, "שם מלא").max(120) }))
    .mutation(async ({ input, ctx }) => {
      const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "כבר קיים חשבון עם המייל הזה. אפשר להתחבר או לאפס סיסמה." });
      const now = new Date();
      const trialEnds = new Date(now.getTime() + env.TRIAL_DAYS * 86400000);
      const [res] = await db.insert(schema.users).values({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        trialEndsAt: trialEnds,
        isAdmin: Boolean(env.OWNER_EMAIL) && input.email === env.OWNER_EMAIL,
        createdAt: now,
      });
      setSession(ctx.res, Number(res.insertId));
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, Number(res.insertId))).limit(1);
      return { me: publicUser(u, await accessFor(u, true)) };
    }),

  login: publicProcedure.input(z.object({ email, password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
    if (!u || !(await checkPassword(input.password, u.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "מייל או סיסמה שגויים" });
    }
    setSession(ctx.res, u.id);
    return { me: publicUser(u, await accessFor(u, true)) };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSession(ctx.res);
    return { ok: true };
  }),

  requestReset: publicProcedure.input(z.object({ email })).mutation(async ({ input }) => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
    if (u) {
      const token = nanoid(40);
      await db.insert(schema.passwordResets).values({ token, userId: u.id, expiresAt: new Date(Date.now() + 3600 * 1000) });
      await sendEmail(u.email, "קביעת סיסמה — ביקורת שטח", resetEmailHtml(`${env.APP_URL}/reset/${token}`));
    }
    // תשובה זהה גם כשאין חשבון, כדי לא לחשוף אילו מיילים רשומים
    return { ok: true };
  }),

  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20), password })).mutation(async ({ input, ctx }) => {
    const [r] = await db
      .select()
      .from(schema.passwordResets)
      .where(and(eq(schema.passwordResets.token, input.token), gt(schema.passwordResets.expiresAt, new Date()), isNull(schema.passwordResets.usedAt)))
      .limit(1);
    if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "הקישור פג תוקף או כבר נוצל. אפשר לבקש קישור חדש." });
    await db.update(schema.users).set({ passwordHash: await hashPassword(input.password) }).where(eq(schema.users.id, r.userId));
    await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.token, input.token));
    setSession(ctx.res, r.userId);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
    return { me: publicUser(u, await accessFor(u, true)) };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40),
        authorRole: z.enum(AUTHOR_ROLES),
        licenseNo: z.string().trim().max(60),
        companyName: z.string().trim().max(160),
        companyPhone: z.string().trim().max(40),
        companyEmail: z.string().trim().max(160),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "צבע לא תקין"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.update(schema.users).set(input).where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),

  removeLogo: protectedProcedure.mutation(async ({ ctx }) => {
    await db.update(schema.users).set({ logoKey: null }).where(eq(schema.users.id, ctx.user.id));
    return { ok: true };
  }),
});
