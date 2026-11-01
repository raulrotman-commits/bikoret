import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { vanilla } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { saveLocal, type LocalVisit } from "../lib/visitStore";
import { todayIso, uuid } from "../lib/format";
import { DEFAULT_RECIPIENTS } from "@shared/roles";
import { Spinner } from "../components/ui";

/** יוצר ביקור חדש במכשיר (גם בלי קליטה). אם יש ביקור קודם באתר — הממצאים הפתוחים בו עוברים לביקור הזה. */
export default function NewVisitPage() {
  const siteId = Number(new URLSearchParams(useSearch()).get("site"));
  const { me } = useAuth();
  const [, nav] = useLocation();
  const started = useRef(false);

  useEffect(() => {
    if (!me || !siteId || started.current) return;
    started.current = true;
    (async () => {
      const id = uuid();
      const date = todayIso();
      const lv: LocalVisit = {
        visit: {
          id,
          siteId,
          visitDate: date,
          authorName: me.fullName,
          authorRole: me.authorRole,
          authorLicense: me.licenseNo,
          contractorRepName: "",
          contractorRepRole: "מנהל העבודה",
          recipients: DEFAULT_RECIPIENTS[me.authorRole] ?? [],
          generalNotes: "",
          previousVisitId: null,
          status: "draft",
        },
        findings: [],
        rev: 1,
        syncedRev: 0,
      };
      if (navigator.onLine) {
        try {
          const base = await vanilla.visits.followUpBase.query({ siteId, date });
          if (base) {
            lv.visit.previousVisitId = base.previousVisitId;
            lv.findings = base.open.map((f, i) => ({
              id: uuid(),
              catalogId: f.catalogId,
              customTitle: f.customTitle,
              customReg: f.customReg,
              customRegNo: f.customRegNo,
              location: f.location ?? "",
              note: f.note ?? "",
              likelihood: f.likelihood,
              severity: f.severity,
              workStopped: false,
              stopReason: null,
              regulatorNotifiedAt: null,
              deadlineDays: null,
              carriedFromId: f.id,
              followStatus: "open",
              sortOrder: i,
              photoIds: [],
            }));
          }
        } catch {
          /* בלי קליטה ממשיכים בלי העברת ממצאים */
        }
      }
      await saveLocal(lv);
      nav(`/visit/${id}`, { replace: true });
    })();
  }, [me, siteId, nav]);

  return <Spinner />;
}
