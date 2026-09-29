import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("indicadores operacionais de reserva", () => {
  it("retorna reserva, produção parcial e processo anterior pelo contexto da OP", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain('indicatorLabel = reservedQuantity === balance ? "Quantidade reservada" : "Reserva menos produção parcial"');
    expect(proxy).toContain('Quantidade ${previousProcessDescription ?? "processo anterior"}');
    expect(proxy).toContain('Saldo ${previousProcessDescription ?? "processo anterior"}');
    expect(proxy).toContain('Quantidade a apontar · ${previousProcessDescription}');
    expect(proxy).toContain("const quantityToPoint = previous ? Math.max(0, previousQuantity - currentQuantity) : null");
    expect(proxy).toContain("if (balance <= 0)");
    expect(proxy).toContain("where mv.op_codigo = ? and mv.mp_codigo < ? and coalesce(mv.mp_qtdeapontada, 0) > 0");
    expect(proxy).toContain('A produção de ${netQuantity} cobre o saldo a apontar de ${quantityToPoint}. Finalize o processo como Atendido.');
  });

  it("posiciona Solicitações e as consultas operacionais na barra do apontamento", () => {
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    expect(pointing).toContain('setShowRequests(true)');
    expect(pointing).toContain('reservation.data?.applicable');
    expect(pointing).toContain('reservation.data.indicatorQuantity != null');
    expect(pointing).toContain('Pacotes / Paletização');
    expect(pointing).toContain("function QuantityToPointNotice");
    expect(pointing).toContain('{ enabled: Boolean(pointing.data), retry: false }');
    expect(pointing).toContain("const noApplicableReservation");
    expect(pointing).toContain("reservation.data !== undefined");
    expect(pointing).toContain("!hasReservation");
    expect(pointing).toContain("{noApplicableReservation ? (");
    expect(pointing).toContain("processName={previousProcessName}");
    expect(pointing).toContain("quantity={quantityToPoint}");
    expect(pointing).toContain("compact");
    expect(pointing).toContain("const mustAttendWhenCovered");
    expect(pointing).toContain('reservation.data.previousProcessDescription ??');
    expect(pointing).toContain('"processo anterior"');
    expect(pointing).toContain("const insufficientToAttendWithoutReservation");
    expect(pointing).toContain("invalidQuantity ||");
    expect(pointing).toContain("mustAttendWhenCovered ||");
    expect(pointing).toContain("finishProduction.isPending");
    expect(pointing).toContain('onPointerDownOutside={event => event.preventDefault()}');
    expect(pointing).toContain('onEscapeKeyDown={event => event.preventDefault()}');
  });
});
