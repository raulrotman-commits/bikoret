import { z } from "zod";

export const findingInput = z.object({
  id: z.string().uuid(),
  catalogId: z.number().int().nullable(),
  customTitle: z.string().max(2000).nullable().optional(),
  customReg: z.string().max(40).nullable().optional(),
  customRegNo: z.string().max(40).nullable().optional(),
  location: z.string().max(200).default(""),
  note: z.string().max(4000).nullable().optional(),
  likelihood: z.number().int().min(1).max(4).nullable().optional(),
  severity: z.number().int().min(1).max(4).nullable().optional(),
  workStopped: z.boolean().default(false),
  stopReason: z.number().int().min(1).max(11).nullable().optional(),
  regulatorNotifiedAt: z.string().max(32).nullable().optional(),
  deadlineDays: z.number().int().min(0).max(365).nullable().optional(),
  carriedFromId: z.string().uuid().nullable().optional(),
  followStatus: z.enum(["open", "fixed"]).nullable().optional(),
  sortOrder: z.number().int().default(0),
  photoIds: z.array(z.string().uuid()).default([]),
});

export const visitInput = z.object({
  id: z.string().uuid(),
  siteId: z.number().int(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  authorName: z.string().max(120).default(""),
  authorRole: z.string().max(40).default(""),
  authorLicense: z.string().max(60).default(""),
  contractorRepName: z.string().max(120).default(""),
  contractorRepRole: z.string().max(80).default(""),
  recipients: z.array(z.string().max(80)).max(12).default([]),
  generalNotes: z.string().max(8000).nullable().optional(),
  previousVisitId: z.string().uuid().nullable().optional(),
});

export const saveVisitInput = z.object({
  visit: visitInput,
  findings: z.array(findingInput).max(400),
});

export type FindingInput = z.infer<typeof findingInput>;
export type VisitInput = z.infer<typeof visitInput>;
export type SaveVisitInput = z.infer<typeof saveVisitInput>;

/** ממצא כפי שהוא מוצג בדוח (אחרי פענוח מהמאגר) */
export interface ReportFinding {
  id: string;
  n: number;
  categoryLabel: string;
  title: string;
  requirement: string;
  source: string;
  location: string;
  note: string;
  likelihood: number | null;
  severity: number | null;
  score: number | null;
  level: "acceptable" | "approval" | "unacceptable" | null;
  workStopped: boolean;
  /** סיבה לפי התוספת הראשונה, אם הממונה על הבטיחות הורה על הפסקת עבודה */
  stopReason: number | null;
  regulatorNotifiedAt: string | null;
  deadline: string | null;
  carried: boolean;
  followStatus: "open" | "fixed" | null;
  recurring: boolean;
  photos: string[];
}

export interface ReportData {
  visit: {
    id: string;
    visitDate: string;
    status: "draft" | "final";
    finalizedAt: string | null;
    authorName: string;
    authorRole: string;
    authorLicense: string;
    contractorRepName: string;
    contractorRepRole: string;
    recipients: string[];
    generalNotes: string;
    shareUrl: string | null;
  };
  site: {
    name: string;
    address: string;
    client: string;
    contractor: string;
    workManager: string;
    siteManager: string;
    safetyOfficer: string;
    unacceptableFrom: number;
    approvalFrom: number;
  };
  brand: {
    companyName: string;
    companyPhone: string;
    companyEmail: string;
    color: string;
    logoUrl: string | null;
  };
  counts: { total: number; unacceptable: number; approval: number; acceptable: number; unscored: number; fixed: number; stillOpen: number };
  findings: ReportFinding[];
  fixedFromPrevious: ReportFinding[];
}
