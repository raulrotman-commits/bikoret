import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { accessFor, isAdminUser, userFromRequest } from "./auth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const user = await userFromRequest(req);
  return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "יש להתחבר" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** פעולות שדורשות מנוי פעיל או תקופת ניסיון */
export const activeProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await accessFor(ctx.user)).active) {
    throw new TRPCError({ code: "FORBIDDEN", message: "אין מנוי פעיל. ביקורת שטח כלולה במנוי רוטמן בטיחות." });
  }
  return next();
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה" });
  return next();
});
