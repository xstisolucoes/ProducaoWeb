import { router, publicProcedure } from "./_core/trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString()
  })),
  hello: publicProcedure.query(() => "Hello World"),
});