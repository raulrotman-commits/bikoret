import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
      }),
    ],
  });
}

export function errMsg(e: unknown): string {
  if (!e) return "";
  const m = (e as { message?: string }).message ?? String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "אין חיבור לשרת. הנתונים נשמרו במכשיר.";
  try {
    const parsed = JSON.parse(m);
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
  } catch {
    /* לא JSON */
  }
  return m;
}

import { createTRPCClient } from "@trpc/client";

/** לקוח שאינו תלוי ב-React — לסנכרון ברקע */
export const vanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
    }),
  ],
});
