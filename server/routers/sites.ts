import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { router, protectedProcedure } from "../trpc";
import { normalizeThresholds } from "../../shared/risk";

const siteFields = z.object({
  name: z.string().trim().min(1, "שם האתר").max(200),
  address: z.string().trim().max(255).default(""),
  client: z.string().trim().max(200).default(""),
  contractor: z.string().trim().max(200).default(""),
  workManager: z.string().trim().max(120).default(""),
  siteManager: z.string().trim().max(120).default(""),
  safetyOfficer: z.string().trim().max(120).default(""),
  unacceptableFrom: z.number().int().min(2).max(16).default(12),
  approvalFrom: z.number().int().min(1).max(16).default(4),
  notes: z.string().max(4000).nullable().optional(),
});

export async function ownSite(userId: number, siteId: number) {
  const [s] = await db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.userId, userId)))
    .limit(1);
  if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "האתר לא נמצא" });
  return s;
}

export const sitesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        site: schema.sites,
        visits: sql<number>`(select count(*) from bk_visits v where v.site_id = bk_sites.id)`,
        lastVisit: sql<string | null>`(select max(v.visit_date) from bk_visits v where v.site_id = bk_sites.id)`,
        openFindings: sql<number>`(
          select count(*) from bk_findings f
          join bk_visits v on v.id = f.visit_id
          where v.site_id = bk_sites.id and v.status = 'final'
            and v.visit_date = (select max(v2.visit_date) from bk_visits v2 where v2.site_id = bk_sites.id and v2.status = 'final')
            and (f.follow_status is null or f.follow_status = 'open')
        )`,
      })
      .from(schema.sites)
      .where(and(eq(schema.sites.userId, ctx.user.id), eq(schema.sites.archived, false)))
      .orderBy(desc(schema.sites.updatedAt));
    return rows.map((r) => ({ ...r.site, visits: Number(r.visits), lastVisit: r.lastVisit, openFindings: Number(r.openFindings) }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int() })).query(({ ctx, input }) => ownSite(ctx.user.id, input.id)),

  create: protectedProcedure.input(siteFields).mutation(async ({ ctx, input }) => {
    const t = normalizeThresholds(input);
    const now = new Date();
    const [res] = await db.insert(schema.sites).values({ ...input, ...t, userId: ctx.user.id, createdAt: now, updatedAt: now });
    return { id: Number(res.insertId) };
  }),

  update: protectedProcedure.input(siteFields.extend({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    await ownSite(ctx.user.id, input.id);
    const { id, ...rest } = input;
    const t = normalizeThresholds(rest);
    await db.update(schema.sites).set({ ...rest, ...t, updatedAt: new Date() }).where(eq(schema.sites.id, id));
    return { ok: true };
  }),

  archive: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    await ownSite(ctx.user.id, input.id);
    await db.update(schema.sites).set({ archived: true, updatedAt: new Date() }).where(eq(schema.sites.id, input.id));
    return { ok: true };
  }),
});
