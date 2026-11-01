import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc, errMsg } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { ErrorBox, Field, Page, TopBar } from "../components/ui";
import { AUTHOR_ROLES } from "@shared/roles";

const SWATCHES = ["#0D2153", "#13286A", "#1F4E79", "#0F5132", "#7A1F1F", "#3B3B3B", "#8A6500"];

export default function SettingsPage() {
  const { me, refresh } = useAuth();
  const welcome = new URLSearchParams(useSearch()).get("welcome") === "1";
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    authorRole: "ממונה בטיחות" as (typeof AUTHOR_ROLES)[number],
    licenseNo: "",
    companyName: "",
    companyPhone: "",
    companyEmail: "",
    brandColor: "#0D2153",
  });
  const [saved, setSaved] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const [logoVer, setLogoVer] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const [, nav] = useLocation();

  useEffect(() => {
    if (me)
      setForm({
        fullName: me.fullName,
        phone: me.phone,
        authorRole: (AUTHOR_ROLES as readonly string[]).includes(me.authorRole) ? (me.authorRole as (typeof AUTHOR_ROLES)[number]) : "אחר",
        licenseNo: me.licenseNo,
        companyName: me.companyName,
        companyPhone: me.companyPhone,
        companyEmail: me.companyEmail,
        brandColor: me.brandColor,
      });
  }, [me]);

  const save = trpc.account.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      refresh();
      if (welcome) nav("/");
    },
  });
  const removeLogo = trpc.account.removeLogo.useMutation({ onSuccess: () => refresh() });
  const logout = trpc.account.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem("bk_me");
      utils.account.me.setData(undefined, null);
      nav("/login");
    },
  });

  const uploadLogo = async (f: File | undefined) => {
    if (!f) return;
    setLogoErr("");
    setLogoBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/logo", { method: "POST", body: fd, credentials: "include" });
    setLogoBusy(false);
    if (!res.ok) setLogoErr((await res.json().catch(() => ({})))?.error ?? "ההעלאה נכשלה");
    else {
      setLogoVer(Date.now());
      refresh();
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setForm({ ...form, [k]: e.target.value });
  };

  return (
    <>
      <TopBar title={welcome ? "ברוך הבא — מיתוג הדוחות שלך" : "הגדרות ומיתוג"} back={welcome ? undefined : "/"} />
      <Page>
        {welcome && (
          <p className="mb-4 rounded-2xl bg-gold-50 px-4 py-3 text-[14px] text-navy-800 ring-1 ring-gold-300">
            הפרטים כאן יופיעו בראש כל דוח שתפיק: הלוגו, שם החברה ופרטי עורך הדוח. אפשר לשנות בכל רגע.
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <div className="card space-y-3 p-4">
            <div className="text-[14px] font-extrabold text-navy-800">עורך הדוח</div>
            <Field label="שם מלא">
              <input className="input" value={form.fullName} onChange={set("fullName")} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="תפקיד">
                <select className="input" value={form.authorRole} onChange={set("authorRole")}>
                  {AUTHOR_ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="מס' רישיון / רישום">
                <input className="input" value={form.licenseNo} onChange={set("licenseNo")} />
              </Field>
            </div>
            <Field label="טלפון נייד">
              <input className="input" dir="ltr" value={form.phone} onChange={set("phone")} />
            </Field>
          </div>

          <div className="card space-y-3 p-4">
            <div className="text-[14px] font-extrabold text-navy-800">מיתוג הדוח</div>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-navy-200 bg-navy-50">
                {me?.hasLogo ? (
                  <img src={`/api/logo/${me.id}?v=${me.logoVersion}-${logoVer}`} alt="לוגו" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[12px] text-navy-400">אין לוגו</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" className="btn-ghost py-2" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
                  {logoBusy ? "מעלה…" : me?.hasLogo ? "החלפת לוגו" : "העלאת לוגו"}
                </button>
                {me?.hasLogo && (
                  <button type="button" className="text-[13px] font-bold text-danger-700" onClick={() => removeLogo.mutate()}>
                    הסרה
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
            </div>
            <ErrorBox>{logoErr}</ErrorBox>
            <Field label="שם החברה">
              <input className="input" value={form.companyName} onChange={set("companyName")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="טלפון החברה">
                <input className="input" dir="ltr" value={form.companyPhone} onChange={set("companyPhone")} />
              </Field>
              <Field label="מייל החברה">
                <input className="input" dir="ltr" value={form.companyEmail} onChange={set("companyEmail")} />
              </Field>
            </div>
            <div>
              <div className="label">צבע ראשי בדוח</div>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={s}
                    onClick={() => setForm({ ...form, brandColor: s })}
                    className="h-9 w-9 rounded-full ring-offset-2"
                    style={{ background: s, boxShadow: form.brandColor.toLowerCase() === s.toLowerCase() ? "0 0 0 3px #D4A018" : undefined }}
                  />
                ))}
                <input type="color" value={form.brandColor} onChange={set("brandColor")} className="h-9 w-12 cursor-pointer rounded-lg border border-navy-100" />
              </div>
            </div>
          </div>

          <ErrorBox>{save.error && errMsg(save.error)}</ErrorBox>
          <button className="btn-primary w-full py-3.5" disabled={save.isPending}>
            {saved ? "נשמר ✓" : welcome ? "שמירה והתחלה" : "שמירה"}
          </button>
        </form>

        {!welcome && (
          <div className="mt-6 space-y-2">
            <Link href="/billing" className="card flex items-center justify-between px-4 py-3">
              <span className="font-bold text-navy-800">מנוי ותשלום</span>
              <span className="text-[13px] text-navy-500">
                {me?.access.admin ? "מנהל" : me?.access.paid ? `בתוקף עד ${new Date(me.access.paidUntil!).toLocaleDateString("he-IL")}` : `ניסיון: ${me?.access.trialLeft} ימים`}
              </span>
            </Link>
            <button className="btn-ghost w-full text-danger-700" onClick={() => logout.mutate()}>
              יציאה מהחשבון
            </button>
            <p className="pt-2 text-center text-[12px] text-navy-400">{me?.email}</p>
          </div>
        )}
      </Page>
    </>
  );
}
