import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getLocalCompanies, loginLocalOperator } from "../firebirdProxy";
import { createLocalSession, getLocalSessionCookieOptions, LOCAL_SESSION_COOKIE } from "../localSession";
import { publicProcedure, router } from "../_core/trpc";

function permissionRules() {
  return {
    programming: process.env.PRODUCTION_MENU_PERMISSION_PROGRAMMING?.trim() || null,
    orders: process.env.PRODUCTION_MENU_PERMISSION_ORDERS?.trim() || null,
    products: process.env.PRODUCTION_MENU_PERMISSION_PRODUCTS?.trim() || null,
    stock: process.env.PRODUCTION_MENU_PERMISSION_STOCK?.trim() || null,
    packages: process.env.PRODUCTION_MENU_PERMISSION_PACKAGES?.trim() || null,
    requests: process.env.PRODUCTION_MENU_PERMISSION_REQUESTS?.trim() || null,
    traceability: process.env.PRODUCTION_MENU_PERMISSION_TRACEABILITY?.trim() || null,
    statusUpdate: process.env.PRODUCTION_STATUS_PERMISSION?.trim() || "PRODUCAO_STATUS_UPDATE",
    startProcess: process.env.PRODUCTION_OPERATOR_START_PERMISSION?.trim() || null,
  } as const;
}

function withRules<T extends Record<string, unknown>>(operator: T) {
  return { ...operator, permissionRules: permissionRules() };
}

export const localAuthRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.localUser ? withRules(ctx.localUser) : null),
  companies: publicProcedure.query(() => getLocalCompanies()),
  login: publicProcedure
    .input(z.object({ login: z.string().trim().min(1).max(120), password: z.string().min(1).max(256), companyCode: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const operator = await loginLocalOperator(input.login, input.password);
        const selectedOperator = { ...operator, companyCode: input.companyCode ?? operator.companyCode };
        const token = await createLocalSession(selectedOperator);
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, getLocalSessionCookieOptions(ctx.req));
        return withRules(selectedOperator);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
      }
    }),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, getLocalSessionCookieOptions(ctx.req));
    return { success: true } as const;
  }),
});
