import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc, errMsg } from "../lib/trpc";
import { APP_NAME, BrandMark, ErrorBox, Field } from "../components/ui";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-800 to-navy-900 px-4 py-10" style={{ paddingTop: "max(40px, env(safe-area-inset-top))" }}>
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <BrandMark size={64} />
          <div className="mt-3 text-[26px] font-extrabold">{APP_NAME}</div>
          <div className="text-[14px] text-gold-300">רוטמן בטיחות · דוח ביקור בטיחות באתר בנייה</div>
        </div>
        <div className="card p-5">
          <h1 className="mb-4 text-[19px] font-extrabold text-navy-800">{title}</h1>
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-navy-200">מי שלא עוסק בבטיחות — בטיחות תעסיק אותו</p>
      </div>
    </div>
  );
}

function useNext() {
  const search = useSearch();
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const next = useNext();
  const [, nav] = useLocation();
  const m = trpc.account.login.useMutation({
    onSuccess: (r) => {
      utils.account.me.setData(undefined, r.me);
      nav(next);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({ email, password });
  };
  return (
    <Shell title="כניסה">
      <form onSubmit={submit} className="space-y-3">
        <Field label="מייל">
          <input className="input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="סיסמה">
          <input className="input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox>{m.error && errMsg(m.error)}</ErrorBox>
        <button className="btn-primary w-full" disabled={m.isPending}>
          {m.isPending ? "נכנס…" : "כניסה"}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-[14px] font-bold">
        <Link href="/forgot" className="text-navy-500">שכחתי סיסמה</Link>
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-gold-700">פתיחת חשבון</Link>
      </div>
    </Shell>
  );
}

export function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const plans = trpc.billing.plans.useQuery();
  const next = useNext();
  const [, nav] = useLocation();
  const m = trpc.account.signup.useMutation({
    onSuccess: (r) => {
      utils.account.me.setData(undefined, r.me);
      nav(next === "/" ? "/settings?welcome=1" : next);
    },
  });
  return (
    <Shell title="פתיחת חשבון">
      <p className="mb-4 text-[14px] text-navy-600">
        {plans.data?.trialDays ?? 14} ימי ניסיון בלי התחייבות. אחר כך ממשיכים במנוי.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ fullName, email, password });
        }}
        className="space-y-3"
      >
        <Field label="שם מלא">
          <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="מייל">
          <input className="input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="סיסמה" hint="8 תווים לפחות">
          <input className="input" type="password" dir="ltr" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox>{m.error && errMsg(m.error)}</ErrorBox>
        <button className="btn-gold w-full" disabled={m.isPending}>
          {m.isPending ? "פותח חשבון…" : "פתיחת חשבון"}
        </button>
      </form>
      <div className="mt-4 text-center text-[14px] font-bold">
        <Link href="/login" className="text-navy-500">כבר יש לי חשבון</Link>
      </div>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const m = trpc.account.requestReset.useMutation();
  return (
    <Shell title="קביעת סיסמה חדשה">
      {m.isSuccess ? (
        <p className="text-[15px] text-navy-700">אם קיים חשבון עם המייל הזה, נשלח אליו קישור לקביעת סיסמה. הקישור תקף לשעה.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ email });
          }}
          className="space-y-3"
        >
          <Field label="מייל">
            <input className="input" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <ErrorBox>{m.error && errMsg(m.error)}</ErrorBox>
          <button className="btn-primary w-full" disabled={m.isPending}>שליחת קישור</button>
        </form>
      )}
      <div className="mt-4 text-center text-[14px] font-bold">
        <Link href="/login" className="text-navy-500">חזרה לכניסה</Link>
      </div>
    </Shell>
  );
}

export function ResetPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const [, nav] = useLocation();
  const m = trpc.account.resetPassword.useMutation({
    onSuccess: (r) => {
      utils.account.me.setData(undefined, r.me);
      nav("/");
    },
  });
  return (
    <Shell title="סיסמה חדשה">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ token, password });
        }}
        className="space-y-3"
      >
        <Field label="סיסמה חדשה" hint="8 תווים לפחות">
          <input className="input" type="password" dir="ltr" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox>{m.error && errMsg(m.error)}</ErrorBox>
        <button className="btn-primary w-full" disabled={m.isPending}>שמירה וכניסה</button>
      </form>
    </Shell>
  );
}
