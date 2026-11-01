import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { accessLabel } from "../lib/access";
import { Page, Spinner, TopBar } from "../components/ui";

/** אין תשלום נפרד: ביקורת שטח כלולה במנוי רוטמן בטיחות, לפי אותו מייל */
export function BillingPage() {
  const { me, refresh } = useAuth();
  const info = trpc.billing.info.useQuery();
  const status = trpc.billing.status.useQuery(undefined, { enabled: false });
  const a = status.data ?? me?.access;

  const recheck = async () => {
    await status.refetch();
    refresh();
  };

  return (
    <>
      <TopBar title="מנוי" back="/" />
      <Page>
        <div className="card mb-4 p-4">
          <div className="text-[14px] font-bold text-navy-500">המצב שלך</div>
          <div className={a?.active ? "text-[18px] font-extrabold text-navy-800" : "text-[18px] font-extrabold text-danger-700"}>{accessLabel(a)}</div>
        </div>

        <div className="card p-5">
          <div className="text-[17px] font-extrabold text-navy-800">ביקורת שטח כלולה במנוי רוטמן בטיחות</div>
          <p className="mt-2 text-[14px] leading-relaxed text-navy-700">
            אין תשלום נפרד. מי שיש לו מנוי פעיל באתר רוטמן בטיחות מקבל גישה מלאה לביקורת שטח — בתנאי שהמנוי רשום על אותו מייל:
          </p>
          <div className="mt-2 rounded-xl bg-navy-50 px-3 py-2 text-center text-[15px] font-bold text-navy-800" dir="ltr">
            {me?.email}
          </div>

          {a?.via !== "subscription" && a?.via !== "admin" && (
            <a className="btn-gold mt-4 w-full py-3.5" href={info.data?.subscribeUrl ?? "https://www.rotman-safety.com/pricing"} target="_blank" rel="noopener">
              למנוי באתר רוטמן בטיחות
            </a>
          )}
          <button className="btn-ghost mt-2 w-full" disabled={status.isFetching} onClick={recheck}>
            {status.isFetching ? <Spinner /> : "כבר יש לי מנוי — לבדוק שוב"}
          </button>
          {status.data && !status.data.active && (
            <p className="mt-2 text-[13px] text-danger-700">
              לא נמצא מנוי פעיל על המייל הזה. אם המנוי רשום על מייל אחר, פתחו כאן חשבון עם המייל של המנוי, או פנו אלינו.
            </p>
          )}
          {a && !a.rsChecked && (
            <p className="mt-2 text-[13px] text-navy-500">הבדיקה מול אתר רוטמן בטיחות לא זמינה כרגע. נסו שוב בעוד כמה דקות.</p>
          )}
        </div>

        <p className="mt-4 text-center text-[13px] text-navy-500">
          שאלות על המנוי? וואטסאפ{" "}
          <a className="font-bold underline" href="https://wa.me/972542017006" dir="ltr">
            054-2017006
          </a>
        </p>
      </Page>
    </>
  );
}
