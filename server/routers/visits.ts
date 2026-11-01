import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db";
import { router, protectedProcedure, activeProcedure, publicProcedure } from "../trpc";
import { saveVisitInput } from "../../shared/visit-types";
import { ownSite } from "./sites";
import { buildReport } from "../report";
import { deleteObject } from "../storage";

async function ownVisit(userId: number, id: string) {
  const [v] = await db
    .select()
    .from(schema.visits)
    .where(and(eq(schema.visits.id, id), eq(schema.visits.userId, userId)))
    .limit(1);
  if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "הביקור לא נמצא" });
  return v;
}

/** הביקור הסופי האחרון באתר, לפני ביקור נתון */
async function previousFinal(siteId: number, beforeDate: string, excludeId?: string) {
  const conds = [eq(schema.visits.siteId, siteId), eq(schema.visits.status, "final"), sql`${schema.visits.visitDate} <= ${beforeDate}`];
  if (excludeId) conds.push(ne(schema.visits.id, excludeId));
  const [v] = await db
    .select()
    .from(schema.visits)
    .where(and(...conds))
    .orderBy(desc(schema.visits.visitDate), desc(schema.visits.finalizedAt))
    .limit(1);
  return v ?? null;
}

export const visitsRouter = router({
  list: protectedProcedure.input(z.object({ siteId: z.number().int().optional() }).optional()).query(async ({ ctx, input }) => {
    const conds = [eq(schema.visits.userId, ctx.user.id)];
    if (input?.siteId) conds.push(eq(schema.visits.siteId, input.siteId));
    const rows = await db
      .select({
        visit: schema.visits,
        siteName: schema.sites.name,
        findings: sql<number>`(select count(*) from bk_findings f where f.visit_id = bk_visits.id and (f.follow_status is null or f.follow_status = 'open'))`,
        unacceptable: sql<number>`(select count(*) from bk_findings f where f.visit_id = bk_visits.id
            and f.likelihood * f.severity >= bk_sites.unacceptable_from and (f.follow_status is null or f.follow_status = 'open'))`,
      })
      .from(schema.visits)
      .innerJoin(schema.sites, eq(schema.sites.id, schema.visits.siteId))
      .where(and(...conds))
      .orderBy(desc(schema.visits.visitDate), desc(schema.visits.updatedAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.visit.id,
      siteId: r.visit.siteId,
      siteName: r.siteName,
      visitDate: r.visit.visitDate,
      status: r.visit.status,
      findings: Number(r.findings),
      unacceptable: Number(r.unacceptable),
      hasShare: Boolean(r.visit.shareToken),
    }));
  }),

  /** הביקור לעריכה: כל השדות + ממצאים + מזהי תמונות */
  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const v = await ownVisit(ctx.user.id, input.id);
    const fs = await db.select().from(schema.findings).where(eq(schema.findings.visitId, v.id));
    const ps = fs.length ? await db.select().from(schema.photos).where(eq(schema.photos.visitId, v.id)) : [];
    let recipients: string[] = [];
    try {
      recipients = v.recipients ? JSON.parse(v.recipients) : [];
    } catch {
      recipients = [];
    }
    return {
      visit: { ...v, recipients, createdAt: undefined, updatedAt: v.updatedAt.toISOString() },
      findings: fs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => ({
          ...f,
          createdAt: undefined,
          updatedAt: undefined,
          photoIds: ps.filter((p) => p.findingId === f.id).sort((a, b) => +a.createdAt - +b.createdAt).map((p) => p.id),
        })),
    };
  }),

  /** שמירה מלאה של מצב הביקור (סנכרון מהמכשיר). אידמפוטנטי. */
  save: activeProcedure.input(saveVisitInput).mutation(async ({ ctx, input }) => {
    const { visit, findings } = input;
    await ownSite(ctx.user.id, visit.siteId);
    const now = new Date();
    const [existing] = await db.select().from(schema.visits).where(eq(schema.visits.id, visit.id)).limit(1);
    if (existing && existing.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    if (existing?.status === "final") {
      throw new TRPCError({ code: "CONFLICT", message: "הדוח כבר הופק. כדי לערוך, יש לפתוח אותו מחדש." });
    }
    const values = {
      siteId: visit.siteId,
      visitDate: visit.visitDate,
      authorName: visit.authorName,
      authorRole: visit.authorRole,
      authorLicense: visit.authorLicense,
      contractorRepName: visit.contractorRepName,
      contractorRepRole: visit.contractorRepRole,
      recipients: JSON.stringify(visit.recipients ?? []),
      generalNotes: visit.generalNotes ?? null,
      previousVisitId: visit.previousVisitId ?? null,
      updatedAt: now,
    };
    if (existing) await db.update(schema.visits).set(values).where(eq(schema.visits.id, visit.id));
    else await db.insert(schema.visits).values({ ...values, id: visit.id, userId: ctx.user.id, status: "draft", createdAt: now });

    // ליקוי חוזר: אותו ליקוי מהמאגר הופיע בביקור הסופי הקודם באתר
    const prev = await previousFinal(visit.siteId, visit.visitDate, visit.id);
    const prevCatalog = new Set<number>();
    if (prev) {
      const pf = await db.select({ c: schema.findings.catalogId }).from(schema.findings).where(eq(schema.findings.visitId, prev.id));
      pf.forEach((x) => x.c != null && prevCatalog.add(x.c));
    }

    const keepIds = findings.map((f) => f.id);
    if (keepIds.length) {
      // ממצאים שנמחקו במכשיר — נמחקים גם כאן, עם התמונות שלהם
      const gone = await db
        .select({ id: schema.findings.id })
        .from(schema.findings)
        .where(and(eq(schema.findings.visitId, visit.id), notInArray(schema.findings.id, keepIds)));
      if (gone.length) await removeFindings(gone.map((g) => g.id));
    } else {
      const gone = await db.select({ id: schema.findings.id }).from(schema.findings).where(eq(schema.findings.visitId, visit.id));
      if (gone.length) await removeFindings(gone.map((g) => g.id));
    }

    for (const f of findings) {
      const row = {
        visitId: visit.id,
        userId: ctx.user.id,
        catalogId: f.catalogId,
        customTitle: f.customTitle ?? null,
        customReg: f.customReg ?? null,
        customRegNo: f.customRegNo ?? null,
        location: f.location ?? "",
        note: f.note ?? null,
        likelihood: f.likelihood ?? null,
        severity: f.severity ?? null,
        workStopped: f.workStopped,
        deadlineDays: f.deadlineDays ?? null,
        carriedFromId: f.carriedFromId ?? null,
        recurring: !f.carriedFromId && f.catalogId != null && prevCatalog.has(f.catalogId),
        followStatus: f.carriedFromId ? (f.followStatus ?? "open") : null,
        sortOrder: f.sortOrder,
        updatedAt: now,
      };
      await db
        .insert(schema.findings)
        .values({ ...row, id: f.id, createdAt: now })
        .onDuplicateKeyUpdate({ set: row });
      // תמונות שהוסרו מהממצא במכשיר
      const photos = await db.select().from(schema.photos).where(eq(schema.photos.findingId, f.id));
      const stale = photos.filter((p) => !f.photoIds.includes(p.id));
      for (const p of stale) {
        await deleteObject(p.storageKey);
        await db.delete(schema.photos).where(eq(schema.photos.id, p.id));
      }
    }
    return { ok: true, savedAt: now.toISOString() };
  }),

  finalize: activeProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const v = await ownVisit(ctx.user.id, input.id);
    const token = v.shareToken ?? nanoid(24);
    await db
      .update(schema.visits)
      .set({ status: "final", finalizedAt: new Date(), shareToken: token, updatedAt: new Date() })
      .where(eq(schema.visits.id, v.id));
    return { ok: true, shareToken: token };
  }),

  reopen: activeProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const v = await ownVisit(ctx.user.id, input.id);
    await db.update(schema.visits).set({ status: "draft", updatedAt: new Date() }).where(eq(schema.visits.id, v.id));
    return { ok: true };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const v = await ownVisit(ctx.user.id, input.id);
    const fs = await db.select({ id: schema.findings.id }).from(schema.findings).where(eq(schema.findings.visitId, v.id));
    if (fs.length) await removeFindings(fs.map((f) => f.id));
    await db.delete(schema.visits).where(eq(schema.visits.id, v.id));
    return { ok: true };
  }),

  /** נתונים לפתיחת ביקור המשך: הביקור הסופי האחרון באתר והממצאים שעדיין פתוחים בו */
  followUpBase: protectedProcedure.input(z.object({ siteId: z.number().int(), date: z.string() })).query(async ({ ctx, input }) => {
    await ownSite(ctx.user.id, input.siteId);
    const prev = await previousFinal(input.siteId, input.date);
    if (!prev) return null;
    const fs = await db.select().from(schema.findings).where(eq(schema.findings.visitId, prev.id));
    const open = fs.filter((f) => !(f.carriedFromId && f.followStatus === "fixed"));
    return {
      previousVisitId: prev.id,
      previousDate: prev.visitDate,
      open: open
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => ({
          id: f.id,
          catalogId: f.catalogId,
          customTitle: f.customTitle,
          customReg: f.customReg,
          customRegNo: f.customRegNo,
          location: f.location,
          note: f.note,
          likelihood: f.likelihood,
          severity: f.severity,
        })),
    };
  }),

  report: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const v = await ownVisit(ctx.user.id, input.id);
    return buildReport(v);
  }),
});

export const shareRouter = router({
  get: publicProcedure.input(z.object({ token: z.string().min(10).max(40) })).query(async ({ input }) => {
    const [v] = await db.select().from(schema.visits).where(eq(schema.visits.shareToken, input.token)).limit(1);
    if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "הדוח לא נמצא" });
    if (v.status !== "final") return { pending: true as const };
    return { pending: false as const, report: await buildReport(v, { publicToken: input.token }) };
  }),
});

async function removeFindings(ids: string[]) {
  const ps = await db.select().from(schema.photos).where(inArray(schema.photos.findingId, ids));
  for (const p of ps) await deleteObject(p.storageKey);
  if (ps.length) await db.delete(schema.photos).where(inArray(schema.photos.findingId, ids));
  await db.delete(schema.findings).where(inArray(schema.findings.id, ids));
}

// לשימוש פנימי בבדיקות
export const _internal = { previousFinal, lt };
