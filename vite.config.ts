import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Plugin para coletor de debug
function debugCollectorPlugin() {
  return {
    name: "debug-collector",
    config(config) {
      // Nenhum comportamento especial necessário no dev server
      return {};
    },
    transformIndexHtml(html) {
      return html;
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    jsxLocPlugin(),
    debugCollectorPlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});