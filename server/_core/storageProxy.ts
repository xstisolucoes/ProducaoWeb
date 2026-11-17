import { Router } from "express";

export function registerStorageProxy(app: any) {
  const router = Router();

  app.use("/manus-storage", router);

  router.get("/*", (_req, res) => {
    res.status(501).json({ error: "Storage proxy not implemented" });
  });
}