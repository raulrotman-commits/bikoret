import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  date,
  boolean,
  tinyint,
  mysqlEnum,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "bk_users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    authorRole: varchar("author_role", { length: 40 }).notNull().default("ממונה בטיחות"),
    licenseNo: varchar("license_no", { length: 60 }).notNull().default(""),
    companyName: varchar("company_name", { length: 160 }).notNull().default(""),
    companyPhone: varchar("company_phone", { length: 40 }).notNull().default(""),
    companyEmail: varchar("company_email", { length: 160 }).notNull().default(""),
    brandColor: varchar("brand_color", { length: 9 }).notNull().default("#0D2153"),
    logoKey: varchar("logo_key", { length: 255 }),
    trialEndsAt: datetime("trial_ends_at").notNull(),
    paidUntil: datetime("paid_until"),
    plan: varchar("plan", { length: 20 }),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => ({ emailIdx: uniqueIndex("bk_users_email").on(t.email) }),
);

export const sites = mysqlTable(
  "bk_sites",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    address: varchar("address", { length: 255 }).notNull().default(""),
    client: varchar("client", { length: 200 }).notNull().default(""),
    contractor: varchar("contractor", { length: 200 }).notNull().default(""),
    workManager: varchar("work_manager", { length: 120 }).notNull().default(""),
    siteManager: varchar("site_manager", { length: 120 }).notNull().default(""),
    safetyOfficer: varchar("safety_officer", { length: 120 }).notNull().default(""),
    unacceptableFrom: tinyint("unacceptable_from").notNull().default(12),
    approvalFrom: tinyint("approval_from").notNull().default(4),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => ({ userIdx: index("bk_sites_user").on(t.userId) }),
);

export const visits = mysqlTable(
  "bk_visits",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("user_id").notNull(),
    siteId: int("site_id").notNull(),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
    authorName: varchar("author_name", { length: 120 }).notNull().default(""),
    authorRole: varchar("author_role", { length: 40 }).notNull().default(""),
    authorLicense: varchar("author_license", { length: 60 }).notNull().default(""),
    contractorRepName: varchar("contractor_rep_name", { length: 120 }).notNull().default(""),
    contractorRepRole: varchar("contractor_rep_role", { length: 80 }).notNull().default(""),
    recipients: text("recipients"),
    generalNotes: text("general_notes"),
    status: mysqlEnum("status", ["draft", "final"]).notNull().default("draft"),
    shareToken: varchar("share_token", { length: 40 }),
    previousVisitId: varchar("previous_visit_id", { length: 36 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
    finalizedAt: datetime("finalized_at"),
  },
  (t) => ({
    userIdx: index("bk_visits_user").on(t.userId),
    siteIdx: index("bk_visits_site").on(t.siteId),
    shareIdx: uniqueIndex("bk_visits_share").on(t.shareToken),
  }),
);

export const findings = mysqlTable(
  "bk_findings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    visitId: varchar("visit_id", { length: 36 }).notNull(),
    userId: int("user_id").notNull(),
    catalogId: int("catalog_id"),
    customTitle: text("custom_title"),
    customReg: varchar("custom_reg", { length: 40 }),
    customRegNo: varchar("custom_reg_no", { length: 40 }),
    location: varchar("location", { length: 200 }).notNull().default(""),
    note: text("note"),
    likelihood: tinyint("likelihood"),
    severity: tinyint("severity"),
    workStopped: boolean("work_stopped").notNull().default(false),
    /** סיבת הפסקת העבודה לפי התוספת הראשונה (1–11), כשממונה הבטיחות הורה על הפסקה */
    stopReason: tinyint("stop_reason"),
    /** מתי סומן שנשלחה הודעה למפקח העבודה האזורי (ISO) */
    regulatorNotifiedAt: varchar("regulator_notified_at", { length: 32 }),
    deadlineDays: int("deadline_days"),
    carriedFromId: varchar("carried_from_id", { length: 36 }),
    recurring: boolean("recurring").notNull().default(false),
    followStatus: mysqlEnum("follow_status", ["open", "fixed"]),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => ({ visitIdx: index("bk_findings_visit").on(t.visitId) }),
);

export const photos = mysqlTable(
  "bk_photos",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    findingId: varchar("finding_id", { length: 36 }).notNull(),
    visitId: varchar("visit_id", { length: 36 }).notNull(),
    userId: int("user_id").notNull(),
    storageKey: varchar("storage_key", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 60 }).notNull().default("image/jpeg"),
    bytes: int("bytes").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => ({ findingIdx: index("bk_photos_finding").on(t.findingId), visitIdx: index("bk_photos_visit").on(t.visitId) }),
);

export const payments = mysqlTable(
  "bk_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    lowProfileId: varchar("low_profile_id", { length: 64 }).notNull(),
    plan: varchar("plan", { length: 20 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "paid", "failed"]).notNull().default("pending"),
    raw: text("raw"),
    createdAt: datetime("created_at").notNull(),
    paidAt: datetime("paid_at"),
  },
  (t) => ({ lpIdx: uniqueIndex("bk_payments_lp").on(t.lowProfileId) }),
);

export const passwordResets = mysqlTable("bk_password_resets", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: int("user_id").notNull(),
  expiresAt: datetime("expires_at").notNull(),
  usedAt: datetime("used_at"),
});

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Photo = typeof photos.$inferSelect;
