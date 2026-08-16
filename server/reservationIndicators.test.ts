import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("indicadores operacionais de reserva", () => {
  it("retorna reserva, produção parcial e processo anterior pelo contexto da OP", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain('indicatorLabel = reservedQuantity === balance ? "Quantidade reservada" : "Reserva menos produção parcial"');
    expect(proxy).toContain('Quantidade ${previousProcessDescription ?? "processo anterior"}');
    expect(proxy).toContain('Saldo ${previousProcessDescription ?? "processo anterior"}');
  });

  it("posiciona Solicitações e as consultas operacionais na barra do apontamento", () => {
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    expect(pointing).toContain('setShowRequests(true)');
    expect(pointing).toContain('reservation.data?.indicatorQuantity');
    expect(pointing).toContain('Pacotes / Paletização');
  });
});
