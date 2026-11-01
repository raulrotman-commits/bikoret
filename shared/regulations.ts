/**
 * שמות התקנות המלאים, כפי שיודפסו בדוח.
 * key — מזהה קצר ויציב שנשמר במאגר. השם המלא נבדק מול פרסומי מינהל הבטיחות והמוס"ל.
 */
export const REGULATIONS = {
  construction: 'תקנות הבטיחות בעבודה (עבודות בנייה), התשמ"ח-1988',
  height: 'תקנות הבטיחות בעבודה (עבודה בגובה), התשס"ז-2007',
  electricity: 'תקנות הבטיחות בעבודה (חשמל), התש"ן-1990',
  towerCranes: 'תקנות הבטיחות בעבודה (עגורני צריח), התשכ"ז-1966',
  craneOperators: 'תקנות הבטיחות בעבודה (עגורנאים, מפעילי מכונות הרמה אחרות ואתתים), התשנ"ג-1992',
  ppe: 'תקנות הבטיחות בעבודה (ציוד מגן אישי), התשנ"ז-1997',
  training: 'תקנות ארגון הפיקוח על העבודה (מסירת מידע והדרכת עובדים), התשנ"ט-1999',
  safetyOfficers: 'תקנות ארגון הפיקוח על העבודה (ממונים על הבטיחות), התשנ"ו-1996',
  safetyPlan: 'תקנות ארגון הפיקוח על העבודה (תכנית לניהול הבטיחות), התשע"ג-2013',
  ordinance: 'פקודת הבטיחות בעבודה [נוסח חדש], התש"ל-1970',
} as const;

export type RegulationKey = keyof typeof REGULATIONS;

/** שם קצר לתצוגה ברשימות (המלא מופיע בדוח) */
export const REGULATION_SHORT: Record<RegulationKey, string> = {
  construction: "תקנות עבודות בנייה",
  height: "תקנות עבודה בגובה",
  electricity: "תקנות החשמל",
  towerCranes: "תקנות עגורני צריח",
  craneOperators: "תקנות עגורנאים ומפעילי מכונות הרמה",
  ppe: "תקנות ציוד מגן אישי",
  training: "תקנות מסירת מידע והדרכת עובדים",
  safetyOfficers: "תקנות הממונים על הבטיחות",
  safetyPlan: "תקנות תכנית לניהול הבטיחות",
  ordinance: "פקודת הבטיחות בעבודה",
};

/**
 * שורת המקור בדוח. מספר תקנה מודפס רק אם אומת מול הנוסח.
 * דוגמה: "תקנה 9(א) לתקנות הבטיחות בעבודה (עבודות בנייה), התשמ"ח-1988"
 */
export function sourceLine(key: RegulationKey | null | undefined, number?: string | null, verified?: boolean): string {
  if (!key) return "";
  const full = REGULATIONS[key];
  if (number && verified) {
    const isOrdinance = key === "ordinance";
    return `${isOrdinance ? "סעיף" : "תקנה"} ${number} ל${full}`;
  }
  return full;
}
