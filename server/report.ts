import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import type { Finding, Site, User, Visit } from "./schema";
import { catalogItem, categoryLabel, itemSource, requirementOf } from "../shared/catalog";
import { sourceLine, type RegulationKey } from "../shared/regulations";
import { DEFAULT_DEADLINE_DAYS, normalizeThresholds, riskLevel, riskScore } from "../shared/risk";
import type { ReportData, ReportFinding } from "../shared/visit-types";
import { env } from "./env";

const LEVEL_ORDER = { unacceptable: 0, approval: 1, acceptable: 2 } as const;

function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function shareUrl(token: string | null) {
  return token ? `${env.APP_URL}/r/${token}` : null;
}

export async function buildReport(visit: Visit, opts: { publicToken?: string } = {}): Promise<ReportData> {
  const [site] = (await db.select().from(schema.sites).where(eq(schema.sites.id, visit.siteId)).limit(1)) as Site[];
  const [user] = (await db.select().from(schema.users).where(eq(schema.users.id, visit.userId)).limit(1)) as User[];
  const rows = (await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.visitId, visit.id))
    .orderBy(asc(schema.findings.sortOrder))) as Finding[];
  const ids = rows.map((r) => r.id);
  const photoRows = ids.length
    ? await db.select().from(schema.photos).where(and(eq(schema.photos.visitId, visit.id), inArray(schema.photos.findingId, ids)))
    : [];
  const photosBy = new Map<string, string[]>();
  for (const p of photoRows.sort((a, b) => +a.createdAt - +b.createdAt)) {
    const url = `/api/photos/${p.id}` + (opts.publicToken ? `?t=${opts.publicToken}` : "");
    photosBy.set(p.findingId, [...(photosBy.get(p.findingId) ?? []), url]);
  }

  const t = normalizeThresholds(site);
  const toReport = (f: Finding): Omit<ReportFinding, "n"> => {
    const item = catalogItem(f.catalogId);
    const level = riskLevel(f.likelihood, f.severity, t);
    let deadline: string | null = null;
    if (f.followStatus !== "fixed") {
      if (level === "unacceptable") deadline = "מיידי";
      else {
        const days = f.deadlineDays ?? (level ? DEFAULT_DEADLINE_DAYS[level] : null);
        if (days === 0) deadline = "מיידי";
        else if (days != null) deadline = addDays(visit.visitDate, days);
      }
    }
    return {
      id: f.id,
      categoryLabel: item ? categoryLabel(item.cat) : "ממצא נוסף",
      title: item ? item.title : (f.customTitle ?? ""),
      requirement: item ? requirementOf(item) : "",
      source: item ? itemSource(item) : sourceLine((f.customReg as RegulationKey) || null, f.customRegNo, true),
      location: f.location ?? "",
      note: f.note ?? "",
      likelihood: f.likelihood ?? null,
      severity: f.severity ?? null,
      score: riskScore(f.likelihood, f.severity),
      level,
      workStopped: f.workStopped,
      stopReason: f.workStopped ? (f.stopReason ?? null) : null,
      regulatorNotifiedAt: f.workStopped && f.stopReason ? (f.regulatorNotifiedAt ?? null) : null,
      deadline,
      carried: Boolean(f.carriedFromId),
      followStatus: (f.followStatus as "open" | "fixed" | null) ?? null,
      recurring: f.recurring,
      photos: photosBy.get(f.id) ?? [],
    };
  };

  const all = rows.map(toReport);
  const fixed = all.filter((f) => f.carried && f.followStatus === "fixed");
  const active = all.filter((f) => !(f.carried && f.followStatus === "fixed"));
  active.sort((a, b) => {
    const la = a.level ? LEVEL_ORDER[a.level] : 3;
    const lb = b.level ? LEVEL_ORDER[b.level] : 3;
    if (la !== lb) return la - lb;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  let recipients: string[] = [];
  try {
    recipients = visit.recipients ? JSON.parse(visit.recipients) : [];
  } catch {
    recipients = [];
  }

  return {
    visit: {
      id: visit.id,
      visitDate: visit.visitDate,
      status: visit.status,
      finalizedAt: visit.finalizedAt ? new Date(visit.finalizedAt).toISOString() : null,
      authorName: visit.authorName,
      authorRole: visit.authorRole,
      authorLicense: visit.authorLicense,
      contractorRepName: visit.contractorRepName,
      contractorRepRole: visit.contractorRepRole,
      recipients,
      generalNotes: visit.generalNotes ?? "",
      shareUrl: shareUrl(visit.shareToken),
    },
    site: {
      name: site?.name ?? "",
      address: site?.address ?? "",
      client: site?.client ?? "",
      contractor: site?.contractor ?? "",
      workManager: site?.workManager ?? "",
      siteManager: site?.siteManager ?? "",
      safetyOfficer: site?.safetyOfficer ?? "",
      unacceptableFrom: t.unacceptableFrom,
      approvalFrom: t.approvalFrom,
    },
    brand: {
      companyName: user?.companyName ?? "",
      companyPhone: user?.companyPhone ?? "",
      companyEmail: user?.companyEmail ?? "",
      color: user?.brandColor ?? "#0D2153",
      logoUrl: user?.logoKey ? `/api/logo/${user.id}?v=${encodeURIComponent(user.logoKey.split("/").pop() ?? "")}` : null,
    },
    counts: {
      total: active.length,
      unacceptable: active.filter((f) => f.level === "unacceptable").length,
      approval: active.filter((f) => f.level === "approval").length,
      acceptable: active.filter((f) => f.level === "acceptable").length,
      unscored: active.filter((f) => !f.level).length,
      fixed: fixed.length,
      stillOpen: active.filter((f) => f.carried).length,
    },
    findings: active.map((f, i) => ({ ...f, n: i + 1 })),
    fixedFromPrevious: fixed.map((f, i) => ({ ...f, n: i + 1 })),
  };
}
