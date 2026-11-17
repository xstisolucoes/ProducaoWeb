import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";

/**
 * Verifica se a porta está disponível, permitindo reuse do socket
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        console.error(
          `[PORT CHECK] Erro ao verificar porta ${port}:`,
          err.message
        );
        resolve(false);
      }
    });
    // Habilita SO_REUSEADDR para evitar TIME_WAIT
    server.listen({ port, host: "0.0.0.0", reuseAddress: true });
  });
}

/**
 * Encontra uma porta disponível a partir do porta inicial especificada
 * Tenta até 20 portas consecutivas
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      console.log(`[PORT CHECK] Porta ${port} está disponível`);
      return port;
    } else {
      console.log(
        `[PORT CHECK] Porta ${port} está em uso, tentando a próxima...`
      );
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  console.log(`[${new Date().toISOString()}] [DEBUG] Iniciando startServer...`);
  console.log(
    `[${new Date().toISOString()}] [DEBUG] NODE_ENV:`,
    process.env.NODE_ENV || "development"
  );
  console.log(`[${new Date().toISOString()}] [DEBUG] PID:`, process.pid);

  const app = express();
  const server = createServer(app);
  console.log(`[${new Date().toISOString()}] [DEBUG] Servidor HTTP criado`);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  console.log(`[${new Date().toISOString()}] [DEBUG] Body parser configurado`);

  registerStorageProxy(app);
  console.log(`[${new Date().toISOString()}] [DEBUG] Storage proxy registrado`);

  registerOAuthRoutes(app);
  console.log(`[${new Date().toISOString()}] [DEBUG] OAuth routes registradas`);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  console.log(`[${new Date().toISOString()}] [DEBUG] TRPC router configurado`);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    // Importação dinâmica para Vite apenas em desenvolvimento
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log(`[${new Date().toISOString()}] [DEBUG] Vite setup concluído`);
  } else {
    serveStatic(app, express);
    console.log(
      `[${new Date().toISOString()}] [DEBUG] Static serving configurado`
    );
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const host = process.env.PRODUCTION_HOST?.trim() || "0.0.0.0";
  const port = await findAvailablePort(preferredPort);

  // Handler de shutdown graceful
  let shutdownStarted = false;
  const shutdown = (signal: string) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    console.log(
      `[${new Date().toISOString()}] Recebido sinal ${signal} - iniciando shutdown graceful...`
    );

    server.close(() => {
      console.log(`[${new Date().toISOString()}] Servidor HTTP fechado`);
      process.exit(0);
    });

    // Force shutdown após 10 segundos
    setTimeout(() => {
      console.error(
        `[${new Date().toISOString()}] Timeout de shutdown - forçando saída`
      );
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGQUIT", () => shutdown("SIGQUIT"));

  server.listen(port, host, () => {
    console.log(
      `[${new Date().toISOString()}] Server running on http://${host}:${port}/`
    );
  });
}

startServer().catch(err => {
  console.error(`[${new Date().toISOString()}] FATAL ERROR:`, err);
  process.exit(1);
});
