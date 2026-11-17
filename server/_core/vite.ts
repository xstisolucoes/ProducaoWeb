import path from "path";
import fs from "fs";

// Em produção, não usamos Vite - apenas servimos arquivos estáticos
export function serveStatic(app: any, express: any) {
  // O build do cliente vai para dist/public no diretório raiz
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    console.warn(`[serveStatic] Continuando sem arquivos estáticos...`);
  }

  // Use o express já importado
  if (express && express.static) {
    app.use(express.static(distPath));
    app.use("*", (_req: any, res: any) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    console.warn("[serveStatic] express não está disponível - pulando arquivos estáticos");
  }
}

// Apenas em desenvolvimento - em produção esta função não é chamada
export async function setupVite(app: any, server: any) {
  // Só é executado em desenvolvimento
  if (process.env.NODE_ENV !== "development") {
    console.warn("[Vite] setupVite chamado em produção - ignorando");
    return;
  }

  try {
    const vite = await import("vite");
    const createViteServer = vite.createServer || vite.default || vite;

    if (typeof createViteServer !== "function") {
      console.error("[Vite] createViteServer não encontrado - alternando para serveStatic");
      serveStatic(app, express);
      return;
    }

    // Configuração padrão para desenvolvimento
    const viteConfig = {
      plugins: [],
      resolve: {
        alias: {
          "@": path.resolve("./client/src"),
          "@shared": path.resolve("./shared"),
          "@assets": path.resolve("./attached_assets"),
        }
      },
      envDir: "./",
      root: "./client",
      publicDir: "./client/public",
      build: {
        outDir: "./dist/public",
        emptyOutDir: true,
      },
      server: {
        host: true,
        allowedHosts: ["localhost", "127.0.0.1"],
        fs: {
          strict: true,
          deny: ["**/.*"],
        }
      }
    };

    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true
    };

    const viteServer = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: serverOptions,
      appType: "custom"
    });

    app.use(viteServer.middlewares);

    app.use("*", async (req: any, res: any, next: any) => {
      const url = req.originalUrl;
      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "../..",
          "client",
          "index.html"
        );
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${Math.random().toString(36).slice(2)}"`
        );
        const page = await viteServer.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        viteServer.ssrFixStacktrace(e);
        next(e);
      }
    });
  } catch (error) {
    console.warn("[Vite] Erro ao inicializar Vite, alternando para serveStatic:", error);
    serveStatic(app, express);
  }
}