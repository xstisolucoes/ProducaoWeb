import { router, publicProcedure } from "./_core/trpc";

export const participantsRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),
});