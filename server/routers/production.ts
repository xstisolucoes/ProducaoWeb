import { router, publicProcedure } from "./_core/trpc";

export const productionRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),
});