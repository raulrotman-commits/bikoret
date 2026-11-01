import raw from "./catalog.json";
import { REGULATIONS, REGULATION_SHORT, sourceLine, type RegulationKey } from "./regulations";

/** פריט במאגר (פורמט דחוס, כפי שנבנה ב-scripts/build_catalog.py) */
export interface CatItem {
  id: number;
  code: number | null;
  cat: string;
  topic: string;
  sub: string;
  title: string;
  /** אינדקס לנוסח הדרישה במערך reqs */
  rq: number;
  reg: RegulationKey | null;
  /** מספר תקנה — רק אם אומת */
  no: string | null;
  v: boolean;
  /** current | amended | outdated */
  st: string;
  tags: string[];
}

export interface CatalogData {
  version: string;
  builtAt: string;
  categories: { key: string; label: string; icon: string; count: number }[];
  reqs: string[];
  items: CatItem[];
}

export const CATALOG = raw as unknown as CatalogData;

const byId = new Map<number, CatItem>(CATALOG.items.map((i) => [i.id, i]));
const catLabel = new Map(CATALOG.categories.map((c) => [c.key, c.label]));

export function catalogItem(id: number | null | undefined): CatItem | undefined {
  return id == null ? undefined : byId.get(id);
}

export function categoryLabel(key: string) {
  return catLabel.get(key) ?? key;
}

export function requirementOf(item: CatItem) {
  return CATALOG.reqs[item.rq] ?? "";
}

/** שורת מקור מלאה לדוח */
export function itemSource(item: CatItem) {
  return sourceLine(item.reg, item.no, item.v);
}

/** מקור קצר לרשימות */
export function itemSourceShort(item: CatItem) {
  if (!item.reg) return "";
  const short = REGULATION_SHORT[item.reg];
  return item.no && item.v ? `${item.reg === "ordinance" ? "סעיף" : "תקנה"} ${item.no} · ${short}` : short;
}

export { REGULATIONS, REGULATION_SHORT };
