import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { Empty, Page, Spinner, TopBar } from "../components/ui";
import { heDate } from "../lib/format";
import { describeThresholds, normalizeThresholds } from "@shared/risk";

export default function SitePage({ id }: { id: number }) {
  const { me } = useAuth();
  const site = trpc.sites.get.useQuery({ id });
  const visits = trpc.visits.list.useQuery({ siteId: id });
  const [, nav] = useLocation();
  if (site.isLoading) return <Spinner />;
  if (!site.data) return <Empty icon="🔍" title="האתר לא נמצא" />;
  const s = site.data;
  const roles: [string, string][] = [
    ["המזמין", s.client],
    ["מבצע הבנייה", s.contractor],
    ["מנהל העבודה", s.workManager],
    ["מנהל האתר", s.siteManager],
    ["ממונה הבטיחות", s.safetyOfficer],
  ];
  return (
    <>
      <TopBar
        title={s.name}
        sub={s.address}
        back="/"
        right={
          <Link href={`/sites/${id}/edit`} className="rounded-full px-3 py-1.5 text-[13px] font-bold text-gold-300 hover:bg-white/10">
            עריכה
          </Link>
        }
      />
      <Page>
        <button className="btn-gold mb-4 w-full py-4 text-[17px]" disabled={me ? !me.access.active : false} onClick={() => nav(`/visit/new?site=${id}`)}>
          ＋ ביקור חדש באתר
        </button>
        <div className="card mb-4 divide-y divide-navy-50">
          {roles.map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2.5 text-[14px]">
              <span className="font-bold text-navy-500">{k}</span>
              <span className="font-bold text-navy-800">{v || "—"}</span>
            </div>
          ))}
          <div className="px-4 py-2.5 text-[12px] text-navy-500">{describeThresholds(normalizeThresholds(s))}</div>
        </div>
        <h2 className="mb-2 text-[16px] font-extrabold text-navy-800">ביקורים באתר</h2>
        {visits.isLoading ? (
          <Spinner />
        ) : !visits.data?.length ? (
          <p className="text-[14px] text-navy-500">עוד אין ביקורים באתר הזה.</p>
        ) : (
          <div className="card divide-y divide-navy-50">
            {visits.data.map((v) => (
              <Link key={v.id} href={v.status === "final" ? `/visit/${v.id}/report` : `/visit/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50/50">
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-navy-800">{heDate(v.visitDate)}</div>
                  <div className="text-[12px] text-navy-500">
                    {v.findings} ממצאים{v.unacceptable > 0 && <span className="font-extrabold text-danger-700"> · {v.unacceptable} שאינם קבילים</span>}
                  </div>
                </div>
                <span className={v.status === "final" ? "rounded-full bg-navy-800 px-2.5 py-1 text-[11px] font-bold text-white" : "rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-bold text-gold-700"}>
                  {v.status === "final" ? "דוח הופק" : "טיוטה"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}
