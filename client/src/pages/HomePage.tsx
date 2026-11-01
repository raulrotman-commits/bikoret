import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { APP_NAME, Empty, Page, Sheet, Spinner, TopBar } from "../components/ui";
import { heDate } from "../lib/format";
import { isDirty, localVisits, type LocalVisit } from "../lib/visitStore";

export function AccessBanner() {
  const { me } = useAuth();
  if (!me) return null;
  const a = me.access;
  if (!a.active)
    return (
      <div className="mb-4 rounded-2xl bg-danger-500 px-4 py-3 text-white">
        <div className="text-[15px] font-extrabold">תקופת הניסיון הסתיימה</div>
        <div className="text-[13px] opacity-90">הדוחות הקיימים זמינים לצפייה ולשיתוף. כדי ליצור דוחות חדשים יש לחדש מנוי.</div>
        <Link href="/billing" className="btn mt-2 bg-white text-danger-700">לחידוש מנוי</Link>
      </div>
    );
  if (!a.admin && !a.paid)
    return (
      <Link href="/billing" className="mb-4 flex items-center justify-between rounded-2xl bg-gold-50 px-4 py-3 text-navy-800 ring-1 ring-gold-300">
        <span className="text-[14px] font-bold">תקופת ניסיון: נותרו {a.trialLeft} ימים</span>
        <span className="text-[13px] font-extrabold text-gold-700">למנוי ←</span>
      </Link>
    );
  return null;
}

export default function HomePage() {
  const { me } = useAuth();
  const sites = trpc.sites.list.useQuery();
  const visits = trpc.visits.list.useQuery();
  const [picker, setPicker] = useState(false);
  const [local, setLocal] = useState<LocalVisit[]>([]);
  const [, nav] = useLocation();

  useEffect(() => {
    localVisits().then((l) => setLocal(l.filter(isDirty)));
  }, []);

  const startVisit = () => {
    if (!sites.data?.length) nav("/sites/new?then=visit");
    else if (sites.data.length === 1) nav(`/visit/new?site=${sites.data[0].id}`);
    else setPicker(true);
  };

  return (
    <>
      <TopBar
        title={APP_NAME}
        sub="רוטמן בטיחות"
        right={
          <Link href="/settings" aria-label="הגדרות" className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10">
            ⚙️
          </Link>
        }
      />
      <Page>
        <AccessBanner />

        <button onClick={startVisit} disabled={me ? !me.access.active : false} className="btn-gold mb-5 w-full py-4 text-[17px]">
          ＋ ביקור חדש
        </button>

        {local.length > 0 && (
          <div className="mb-5 rounded-2xl bg-gold-50 px-4 py-3 ring-1 ring-gold-300">
            <div className="text-[14px] font-extrabold text-navy-800">שמור במכשיר, ממתין לסנכרון</div>
            {local.map((l) => (
              <Link key={l.visit.id} href={`/visit/${l.visit.id}`} className="mt-1 block text-[14px] text-navy-700 underline">
                ביקור מ-{heDate(l.visit.visitDate)} · {l.findings.length} ממצאים
              </Link>
            ))}
          </div>
        )}

        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-navy-800">האתרים שלי</h2>
            <Link href="/sites/new" className="text-[14px] font-bold text-gold-700">+ אתר חדש</Link>
          </div>
          {sites.isLoading ? (
            <Spinner />
          ) : !sites.data?.length ? (
            <Empty icon="🏗️" title="עוד אין אתרים">
              מתחילים בהוספת אתר: שם, מזמין, מבצע הבנייה ובעלי התפקידים.
            </Empty>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {sites.data.map((s) => (
                <Link key={s.id} href={`/sites/${s.id}`} className="card block px-4 py-3 hover:border-navy-300">
                  <div className="text-[16px] font-extrabold text-navy-800">{s.name}</div>
                  <div className="truncate text-[13px] text-navy-500">{[s.client, s.contractor].filter(Boolean).join(" · ") || s.address}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 font-bold text-navy-700">{s.visits} ביקורים</span>
                    {s.lastVisit && <span className="rounded-full bg-navy-50 px-2 py-0.5 font-bold text-navy-700">אחרון: {heDate(s.lastVisit)}</span>}
                    {s.openFindings > 0 && <span className="rounded-full bg-danger-50 px-2 py-0.5 font-bold text-danger-700">{s.openFindings} ממצאים פתוחים</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[16px] font-extrabold text-navy-800">ביקורים אחרונים</h2>
          {visits.isLoading ? (
            <Spinner />
          ) : !visits.data?.length ? (
            <p className="text-[14px] text-navy-500">עוד אין ביקורים.</p>
          ) : (
            <div className="card divide-y divide-navy-50">
              {visits.data.slice(0, 15).map((v) => (
                <Link key={v.id} href={v.status === "final" ? `/visit/${v.id}/report` : `/visit/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold text-navy-800">{v.siteName}</div>
                    <div className="text-[12px] text-navy-500">
                      {heDate(v.visitDate)} · {v.findings} ממצאים
                      {v.unacceptable > 0 && <span className="font-extrabold text-danger-700"> · {v.unacceptable} שאינם קבילים</span>}
                    </div>
                  </div>
                  <span className={v.status === "final" ? "rounded-full bg-navy-800 px-2.5 py-1 text-[11px] font-bold text-white" : "rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-bold text-gold-700"}>
                    {v.status === "final" ? "דוח הופק" : "טיוטה"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {me?.access.admin && (
          <Link href="/admin" className="mt-6 block text-center text-[13px] font-bold text-navy-400 underline">ניהול לקוחות</Link>
        )}
      </Page>

      <Sheet open={picker} onClose={() => setPicker(false)} title="באיזה אתר הביקור?">
        <div className="space-y-2">
          {sites.data?.map((s) => (
            <button key={s.id} onClick={() => nav(`/visit/new?site=${s.id}`)} className="card block w-full px-4 py-3 text-right hover:border-navy-300">
              <div className="text-[15px] font-extrabold text-navy-800">{s.name}</div>
              <div className="text-[12px] text-navy-500">{s.client}</div>
            </button>
          ))}
          <Link href="/sites/new?then=visit" className="btn-ghost w-full">+ אתר חדש</Link>
        </div>
      </Sheet>
    </>
  );
}
