import { Router } from "express";

export function registerOAuthRoutes(app: any) {
  const router = Router();

  app.use("/api/oauth", router);

  router.get("/callback", (_req, res) => {
    res.status(400).json({ error: "OAuth callback not implemented" });
  });
}