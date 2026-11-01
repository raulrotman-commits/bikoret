import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { heDate } from "./format";

export type Access = NonNullable<inferRouterOutputs<AppRouter>["account"]["me"]>["access"];

/** תיאור קצר של מצב הגישה */
export function accessLabel(a: Access | undefined, short = false) {
  if (!a) return "";
  switch (a.via) {
    case "admin":
      return short ? "מנהל" : "חשבון מנהל — ללא הגבלה";
    case "subscription":
      return short ? `מנוי עד ${heDate(a.until)}` : `מנוי רוטמן בטיחות בתוקף עד ${heDate(a.until)}`;
    case "manual":
      return short ? `גישה עד ${heDate(a.until)}` : `גישה בתוקף עד ${heDate(a.until)}`;
    case "trial":
      return short ? `ניסיון ${a.trialLeft} ימים` : `תקופת ניסיון — נותרו ${a.trialLeft} ימים`;
    default:
      return "אין מנוי פעיל";
  }
}
