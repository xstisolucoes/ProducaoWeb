import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getLocalCompanies, getLoginStations, loginLocalOperator } from "../firebirdProxy";
import { createLocalSession, getLocalSessionCookieOptions, LOCAL_SESSION_COOKIE } from "../localSession";
import { publicProcedure, router } from "../_core/trpc";
import { getStationBinding, readStationCookie, saveStationBinding, STATION_COOKIE, stationCookieOptions } from "../stationBinding";

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
  stations: publicProcedure.query(() => getLoginStations()),
  station: publicProcedure.query(async ({ ctx }) => {
    const binding = await getStationBinding(ctx.req);
    const cookieMachineCode = readStationCookie(ctx.req);
    return { machineCode: binding?.machineCode ?? cookieMachineCode, source: binding ? "lan" : cookieMachineCode ? "browser" : null } as const;
  }),
  login: publicProcedure
    .input(z.object({ login: z.string().trim().min(1).max(120), password: z.string().min(1).max(256), companyCode: z.number().int().positive().nullable(), machineCode: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const binding = await getStationBinding(ctx.req);
        const persistedMachineCode = binding?.machineCode ?? readStationCookie(ctx.req);
        const operator = await loginLocalOperator(input.login, input.password, persistedMachineCode ?? input.machineCode);
        const selectedOperator = { ...operator, companyCode: input.companyCode ?? operator.companyCode };
        const token = await createLocalSession(selectedOperator);
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, getLocalSessionCookieOptions(ctx.req));
        return withRules(selectedOperator);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const stationAccessDenied = message.includes("máquina Apontamento") || message.includes("usuário Apontador") || message.includes("Processo Manual") || message.includes("Esta estação ainda não está configurada");
        throw new TRPCError({ code: stationAccessDenied ? "FORBIDDEN" : "UNAUTHORIZED", message: stationAccessDenied ? message : "Usuário ou senha inválidos." });
      }
    }),
  persistStation: publicProcedure
    .input(z.object({ machineCode: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.localUser?.canConfigureStation) throw new TRPCError({ code: "FORBIDDEN", message: "Somente PCP, Programador ou Administrador pode configurar esta estação." });
      const station = await saveStationBinding(ctx.req, input.machineCode);
      ctx.res.cookie(STATION_COOKIE, String(input.machineCode), stationCookieOptions(ctx.req));
      return station;
    }),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, getLocalSessionCookieOptions(ctx.req));
    return { success: true } as const;
  }),
});
