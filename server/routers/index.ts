import { router } from "../trpc";
import { accountRouter } from "./account";
import { sitesRouter } from "./sites";
import { visitsRouter, shareRouter } from "./visits";
import { billingRouter, adminRouter } from "./billing";

export const appRouter = router({
  account: accountRouter,
  sites: sitesRouter,
  visits: visitsRouter,
  share: shareRouter,
  billing: billingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
