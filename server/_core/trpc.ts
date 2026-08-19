import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireLocalUser = t.middleware(async opts => {
  if (!opts.ctx.localUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Acesso local não autorizado." });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      localUser: opts.ctx.localUser,
    },
  });
});

export const localProtectedProcedure = t.procedure.use(requireLocalUser);

const requireStatusPermission = t.middleware(async opts => {
  const requiredPermission = process.env.PRODUCTION_STATUS_PERMISSION?.trim() || "PRODUCAO_STATUS_UPDATE";
  if (!opts.ctx.localUser?.permissions.includes(requiredPermission)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O operador não possui permissão para alterar o status da ordem." });
  }
  return opts.next();
});

export const statusUpdateProcedure = localProtectedProcedure.use(requireStatusPermission);

const requireOperationalProfile = (profile: "operator" | "programmer") =>
  t.middleware(async opts => {
    const isOperator = profile === "operator" && ["operator", "manual-pointing", "manual-production", "quality-release"].includes(opts.ctx.localUser?.operationalProfile ?? "");
    if (!opts.ctx.localUser || (!isOperator && opts.ctx.localUser.operationalProfile !== profile)) {
      throw new TRPCError({ code: "FORBIDDEN", message: profile === "operator" ? "Ação disponível apenas para operadores." : "Ação disponível apenas para programadores." });
    }
    return opts.next({ ctx: { ...opts.ctx, localUser: opts.ctx.localUser } });
  });

export const operatorProcedure = localProtectedProcedure.use(requireOperationalProfile("operator"));
export const programmerProcedure = localProtectedProcedure.use(requireOperationalProfile("programmer"));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
