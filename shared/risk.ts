/**
 * הערכת סיכון לממצא: סבירות × חומרה (1–4 כל אחד), כמו בסקר הסיכונים שבתכנית הבטיחות.
 *
 * ברירת המחדל לקוחה מהתוכניות לניהול הבטיחות של רוטמן בטיחות:
 *   12 ומעלה — סיכון שאינו קביל, טיפול מיידי
 *   4 עד 9   — דורש אישור בעל הסמכות שנקבע בתכנית
 *   1 עד 3   — קביל
 *
 * המחזיק במקום העבודה הוא שקובע בתכנית מהי רמת הסיכון הקביל, ולכן אפשר להגדיר
 * ספים שונים לכל אתר (לפי תכנית הבטיחות שלו).
 */

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: "נדירה",
  2: "אפשרית",
  3: "סבירה",
  4: "כמעט ודאית",
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: "קלה",
  2: "בינונית",
  3: "חמורה",
  4: "קטסטרופלית",
};

export type RiskLevel = "acceptable" | "approval" | "unacceptable";

export interface RiskThresholds {
  /** ציון שממנו והלאה הסיכון אינו קביל */
  unacceptableFrom: number;
  /** ציון שממנו והלאה נדרש אישור בעל הסמכות */
  approvalFrom: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = { unacceptableFrom: 12, approvalFrom: 4 };

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  unacceptable: "סיכון שאינו קביל",
  approval: "דורש אישור בעל הסמכות",
  acceptable: "קביל",
};

/** יעד תיקון ברירת מחדל בימים, לפי רמת הסיכון. 0 = מיידי */
export const DEFAULT_DEADLINE_DAYS: Record<RiskLevel, number> = {
  unacceptable: 0,
  approval: 7,
  acceptable: 14,
};

export function riskScore(likelihood?: number | null, severity?: number | null): number | null {
  if (!likelihood || !severity) return null;
  return likelihood * severity;
}

export function riskLevel(
  likelihood?: number | null,
  severity?: number | null,
  t: RiskThresholds = DEFAULT_THRESHOLDS,
): RiskLevel | null {
  const s = riskScore(likelihood, severity);
  if (s == null) return null;
  if (s >= t.unacceptableFrom) return "unacceptable";
  if (s >= t.approvalFrom) return "approval";
  return "acceptable";
}

export function normalizeThresholds(t?: Partial<RiskThresholds> | null): RiskThresholds {
  const u = Math.min(16, Math.max(2, Number(t?.unacceptableFrom) || DEFAULT_THRESHOLDS.unacceptableFrom));
  const a = Math.min(u, Math.max(1, Number(t?.approvalFrom) || DEFAULT_THRESHOLDS.approvalFrom));
  return { unacceptableFrom: u, approvalFrom: a };
}

/** תיאור הספים במילים, לכותרת הדוח */
export function describeThresholds(t: RiskThresholds): string {
  return `סבירות × חומרה (1–4). ${t.unacceptableFrom} ומעלה: סיכון שאינו קביל · ${t.approvalFrom}–${t.unacceptableFrom - 1}: דורש אישור בעל הסמכות · עד ${t.approvalFrom - 1}: קביל`;
}
