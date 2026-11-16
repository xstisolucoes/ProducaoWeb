import express from "express";
import { createServer } from "http";
import net from "net";

// Configuração básica
const app = express();
const server = createServer(app);

// Endpoint de teste
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed,
    handles: process._getActiveHandles?.length ?? "N/A",
    requests: process._getActiveRequests?.length ?? "N/A"
  });
});

// Endpoint de teste de conexão
app.get("/test", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Server is running"
  });
});

// Função para diagnosticar handles
function diagnoseHandles() {
  const handles = process._getActiveHandles();
  const requestHandles = process._getActiveRequests();
  

  console.log("=== DIAGNOSTICO DE HANDLES ===");
  console.log(`Tempo de execução: ${Math.round(process.uptime())} segundos`);
  console.log(`Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log(`Handles ativos: ${handles.length}`);
  console.log(`Handles de request: ${requestHandles.length}`);

  if (handles.length > 100) {
    console.log("⚠️  ALERTA: Muitos handles ativos - possivelmente vazamento de recursos");
  }

  if (requestHandles.length > 50) {
    console.log("⚠️  ALERTA: Muitos requests pendentes - possivelmente sem resposta");
  }

  console.log("=== FIM DIAGNOSTICO ===");
}

// Diagnóstico inicial
diagnoseHandles();

// Log de heartbeat a cada 10 segundos
setInterval(diagnoseHandles, 10000);

// Simular requisições para manter o server ativo
setInterval(() => {
  console.log("[" + new Date().toISOString() + "] Requisição de teste");
}, 15000);

console.log("Servidor de diagnóstico iniciado. Pressione Ctrl+C para parar.");

// Simular requisições reais para manter o server ativo
setInterval(() => {
  require('http').get('http://localhost:9999/health', (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log("[" + new Date().toISOString() + "] Health check OK");
    });
  });
}, 30000);