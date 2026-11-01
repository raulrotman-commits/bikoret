import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc, errMsg } from "../lib/trpc";
import { ErrorBox, Field, Page, Spinner, TopBar } from "../components/ui";
import { DEFAULT_THRESHOLDS, describeThresholds, normalizeThresholds } from "@shared/risk";

const EMPTY = {
  name: "",
  address: "",
  client: "",
  contractor: "",
  workManager: "",
  siteManager: "",
  safetyOfficer: "",
  unacceptableFrom: DEFAULT_THRESHOLDS.unacceptableFrom,
  approvalFrom: DEFAULT_THRESHOLDS.approvalFrom,
  notes: "",
};

export default function SiteFormPage({ id }: { id?: number }) {
  const [form, setForm] = useState(EMPTY);
  const existing = trpc.sites.get.useQuery({ id: id ?? 0 }, { enabled: Boolean(id) });
  const utils = trpc.useUtils();
  const then = new URLSearchParams(useSearch()).get("then");
  const [, nav] = useLocation();

  useEffect(() => {
    if (existing.data) {
      const { id: _i, userId: _u, createdAt: _c, updatedAt: _up, archived: _a, ...rest } = existing.data;
      setForm({ ...EMPTY, ...rest, notes: rest.notes ?? "" });
    }
  }, [existing.data]);

  const create = trpc.sites.create.useMutation({
    onSuccess: async (r) => {
      await utils.sites.list.invalidate();
      nav(then === "visit" ? `/visit/new?site=${r.id}` : `/sites/${r.id}`, { replace: true });
    },
  });
  const update = trpc.sites.update.useMutation({
    onSuccess: async () => {
      await utils.sites.invalidate();
      nav(`/sites/${id}`, { replace: true });
    },
  });
  const err = create.error || update.error;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const t = normalizeThresholds(form);

  if (id && existing.isLoading) return <Spinner />;

  return (
    <>
      <TopBar title={id ? "עריכת אתר" : "אתר חדש"} back />
      <Page>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = { ...form, ...t };
            if (id) update.mutate({ ...payload, id });
            else create.mutate(payload);
          }}
        >
          <div className="card space-y-3 p-4">
            <Field label="שם האתר">
              <input className="input" value={form.name} onChange={set("name")} placeholder="למשל: מגדלי הים, בניין B" required />
            </Field>
            <Field label="כתובת">
              <input className="input" value={form.address} onChange={set("address")} />
            </Field>
          </div>
          <div className="card space-y-3 p-4">
            <div className="text-[14px] font-extrabold text-navy-800">בעלי התפקידים באתר</div>
            <Field label="המזמין">
              <input className="input" value={form.client} onChange={set("client")} />
            </Field>
            <Field label="מבצע הבנייה">
              <input className="input" value={form.contractor} onChange={set("contractor")} />
            </Field>
            <Field label="מנהל העבודה">
              <input className="input" value={form.workManager} onChange={set("workManager")} />
            </Field>
            <Field label="מנהל האתר" hint="חובה באתר ששטחו 15,000 מ״ר לפחות">
              <input className="input" value={form.siteManager} onChange={set("siteManager")} />
            </Field>
            <Field label="ממונה הבטיחות">
              <input className="input" value={form.safetyOfficer} onChange={set("safetyOfficer")} />
            </Field>
          </div>
          <div className="card space-y-3 p-4">
            <div className="text-[14px] font-extrabold text-navy-800">רמת הסיכון הקביל באתר</div>
            <p className="text-[13px] text-navy-500">
              לפי מה שנקבע בתכנית הבטיחות של האתר. ציון הסיכון הוא סבירות × חומרה (1 עד 4).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="סיכון שאינו קביל — מציון">
                <input className="input" type="number" min={2} max={16} value={form.unacceptableFrom} onChange={(e) => setForm({ ...form, unacceptableFrom: Number(e.target.value) })} />
              </Field>
              <Field label="דורש אישור בעל הסמכות — מציון">
                <input className="input" type="number" min={1} max={16} value={form.approvalFrom} onChange={(e) => setForm({ ...form, approvalFrom: Number(e.target.value) })} />
              </Field>
            </div>
            <p className="rounded-xl bg-navy-50 px-3 py-2 text-[12px] text-navy-700">{describeThresholds(t)}</p>
          </div>
          <div className="card p-4">
            <Field label="הערות">
              <textarea className="input min-h-[80px]" value={form.notes} onChange={set("notes")} />
            </Field>
          </div>
          <ErrorBox>{err && errMsg(err)}</ErrorBox>
          <button className="btn-primary w-full py-3.5" disabled={create.isPending || update.isPending}>
            {id ? "שמירה" : then === "visit" ? "שמירה והתחלת ביקור" : "שמירת האתר"}
          </button>
        </form>
      </Page>
    </>
  );
}
