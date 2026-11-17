import { router, publicProcedure } from "./_core/trpc";

export const localAuthRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),
});