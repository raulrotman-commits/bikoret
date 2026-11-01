import { useEffect } from "react";
import { Link } from "wouter";
import { trpc, errMsg } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { ErrorBox, Page, Spinner, TopBar } from "../components/ui";

export function BillingPage() {
  const { me } = useAuth();
  const plans = trpc.billing.plans.useQuery();
  const checkout = trpc.billing.checkout.useMutation({ onSuccess: (r) => (window.location.href = r.url) });
  const a = me?.access;
  return (
    <>
      <TopBar title="מנוי" back="/" />
      <Page>
        <div className="card mb-4 p-4">
          <div className="text-[14px] font-bold text-navy-500">המצב שלך</div>
          <div className="text-[18px] font-extrabold text-navy-800">
            {a?.admin
              ? "חשבון מנהל — ללא הגבלה"
              : a?.paid
                ? `מנוי בתוקף עד ${new Date(a.paidUntil!).toLocaleDateString("he-IL")}`
                : a?.trialLeft
                  ? `תקופת ניסיון — נותרו ${a.trialLeft} ימים`
                  : "תקופת הניסיון הסתיימה"}
          </div>
        </div>
        {plans.isLoading ? (
          <Spinner />
        ) : !plans.data?.enabled ? (
          <div className="card p-4 text-[14px] text-navy-700">
            התשלום באתר עוד לא הופעל. לחידוש מנוי פנו לרוטמן בטיחות בוואטסאפ:{" "}
            <a className="font-bold underline" href="https://wa.me/972542017006" dir="ltr">
              054-2017006
            </a>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.data.plans.map((p) => (
              <div key={p.key} className="card flex flex-col p-5">
                <div className="text-[16px] font-extrabold text-navy-800">{p.label}</div>
                <div className="my-2 text-[30px] font-extrabold text-navy-900">
                  ₪{p.price}
                  <span className="text-[14px] font-bold text-navy-500"> / {p.months === 1 ? "חודש" : "שנה"}</span>
                </div>
                <button className="btn-gold mt-auto" disabled={checkout.isPending} onClick={() => checkout.mutate({ plan: p.key })}>
                  לתשלום מאובטח
                </button>
              </div>
            ))}
          </div>
        )}
        <ErrorBox>{checkout.error && errMsg(checkout.error)}</ErrorBox>
        <p className="mt-4 text-[12px] text-navy-400">התשלום מתבצע בדף מאובטח של Cardcom. קבלה נשלחת למייל.</p>
      </Page>
    </>
  );
}

export function BillingResultPage({ ok }: { ok: boolean }) {
  const { refresh } = useAuth();
  const confirm = trpc.billing.confirmPending.useMutation({ onSuccess: () => refresh() });
  useEffect(() => {
    if (ok) confirm.mutate();
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <TopBar title={ok ? "תודה!" : "התשלום לא הושלם"} back="/" />
      <Page>
        <div className="card p-6 text-center">
          {ok ? (
            confirm.isPending ? (
              <Spinner />
            ) : confirm.data?.confirmed ? (
              <div className="text-[17px] font-extrabold text-emerald-700">המנוי הופעל ✓</div>
            ) : (
              <div className="text-[15px] text-navy-700">התשלום התקבל ונמצא בבדיקה. המנוי יופעל תוך דקות ספורות.</div>
            )
          ) : (
            <div className="text-[15px] text-navy-700">אפשר לנסות שוב, או לפנות אלינו בוואטסאפ.</div>
          )}
          <Link href="/" className="btn-primary mt-4">
            לדף הבית
          </Link>
        </div>
      </Page>
    </>
  );
}
