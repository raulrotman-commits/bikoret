import { createContext, useContext, type ReactNode } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "./trpc";
import type { AppRouter } from "../../../server/routers";

type Me = NonNullable<inferRouterOutputs<AppRouter>["account"]["me"]>;

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => void }>({ me: null, loading: true, refresh: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const q = trpc.account.me.useQuery(undefined, { staleTime: 60_000 });
  // במצב לא מקוון שומרים את המשתמש האחרון שנטען, כדי שאפשר יהיה לעבוד בשטח
  let me = q.data ?? null;
  if (q.data) localStorage.setItem("bk_me", JSON.stringify(q.data));
  else if (q.isError || (!navigator.onLine && !q.data)) {
    try {
      me = JSON.parse(localStorage.getItem("bk_me") || "null");
    } catch {
      me = null;
    }
  }
  if (q.data === null) localStorage.removeItem("bk_me");
  return <Ctx.Provider value={{ me, loading: (q.isLoading || (q.isFetching && !me)) && navigator.onLine, refresh: () => void q.refetch() }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  const utils = trpc.useUtils();
  const me = ctx.me ?? utils.account.me.getData() ?? null;
  return { ...ctx, me };
}
