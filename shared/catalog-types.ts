import type { RegulationKey } from "./regulations";

/** פריט במאגר הליקויים */
export interface CatalogItem {
  /** מזהה יציב (מספר) */
  id: number;
  /** קוד הליקוי מהמאגר המקורי, אם יש */
  code: number | null;
  /** תחום ראשי: עבודות בנייה, עבודה בגובה וכו' */
  category: string;
  /** נושא */
  topic: string;
  /** תת־נושא */
  subtopic: string;
  /** נוסח הליקוי, כפי שיופיע בדוח */
  title: string;
  /** הדרישה (נוסח התקנה או תמציתה) */
  requirement: string;
  /** מקור — מזהה התקנות */
  reg: RegulationKey | null;
  /** מספר התקנה/הסעיף, למשל "9(א)". מודפס רק אם verified */
  regNo: string | null;
  /** מספר התקנה אומת מול הנוסח המלא */
  verified: boolean;
  /** תגיות לנושאי מיקוד (אחריות המזמין, מנהל אתר וכו') */
  tags: string[];
}

export interface Catalog {
  version: string;
  builtAt: string;
  categories: { key: string; label: string; icon: string; count: number }[];
  items: CatalogItem[];
}

/** נושאי מיקוד: כפתורי קיצור שמסננים לפי תגית (לא לפי חיפוש טקסט) */
export const FOCUS_TOPICS = [
  { tag: "client", label: "אחריות המזמין", icon: "🏛️" },
  { tag: "site-manager", label: "מנהל אתר", icon: "🧭" },
  { tag: "controller", label: "בקר בטיחות", icon: "🔎" },
  { tag: "work-manager", label: "מינוי ותפקוד מנהל עבודה", icon: "👷" },
  { tag: "eng-plans", label: "תכניות הנדסיות", icon: "📐" },
  { tag: "safety-plan", label: "תכנית הבטיחות", icon: "📋" },
  { tag: "notices", label: "הודעות למפקח העבודה", icon: "📨" },
  { tag: "training-language", label: "הדרכה בשפה המובנת לעובד", icon: "🌐" },
  { tag: "height-instructor", label: "מדריך עבודה בגובה", icon: "🪜" },
] as const;

export type FocusTag = (typeof FOCUS_TOPICS)[number]["tag"];
