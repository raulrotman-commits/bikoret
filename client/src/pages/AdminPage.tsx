import { trpc } from "../lib/trpc";
import { Page, Spinner, TopBar } from "../components/ui";
import { heDate } from "../lib/format";

export default function AdminPage() {
  const users = trpc.admin.users.useQuery();
  const extend = trpc.admin.extend.useMutation({ onSuccess: () => users.refetch() });
  return (
    <>
      <TopBar title="ניהול לקוחות" back="/" />
      <Page>
        {users.isLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            {users.data?.map((u) => (
              <div key={u.id} className="card px-4 py-3">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold text-navy-800">{u.fullName || u.email}</div>
                    <div className="truncate text-[12px] text-navy-500" dir="ltr">{u.email}</div>
                    <div className="text-[12px] text-navy-500">
                      {[u.companyName, u.authorRole].filter(Boolean).join(" · ")} · נרשם {heDate(u.createdAt)}
                    </div>
                  </div>
                  <div className="text-left text-[12px]">
                    <div className="font-bold text-navy-700">{u.sites} אתרים · {u.visits} ביקורים</div>
                    <div className={u.access.active ? "font-bold text-emerald-700" : "font-bold text-danger-700"}>
                      {u.access.admin ? "מנהל" : u.access.paid ? `עד ${heDate(u.access.paidUntil)}` : u.access.trialLeft ? `ניסיון ${u.access.trialLeft} ימים` : "לא פעיל"}
                    </div>
                  </div>
                </div>
                {!u.access.admin && (
                  <div className="mt-2 flex gap-2">
                    {[1, 12].map((m) => (
                      <button key={m} className="btn-ghost py-1.5 text-[12px]" disabled={extend.isPending} onClick={() => extend.mutate({ userId: u.id, months: m })}>
                        + {m === 1 ? "חודש" : "שנה"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}
