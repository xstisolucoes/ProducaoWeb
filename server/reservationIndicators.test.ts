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
    expect(pointing).toContain('reservation.data?.applicable && reservation.data.indicatorQuantity != null');
    expect(pointing).toContain('Pacotes / Paletização');
    expect(pointing).toContain("function QuantityToPointNotice");
    expect(pointing).toContain('enabled: Boolean(pointing.data) && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo)');
    expect(pointing).toContain("const noApplicableReservation = reservation.data !== undefined && !hasReservation");
    expect(pointing).toContain("{noApplicableReservation ? <QuantityToPointNotice processName={previousProcessName} quantity={quantityToPoint} compact /> : null}");
    expect(pointing).toContain("const mustAttendWhenCovered = noApplicableReservation");
    expect(pointing).toContain('reservation.data?.indicatorQuantity != null ? <QuantityToPointNotice processName={reservation.data.previousProcessDescription ?? "processo anterior"} quantity={reservation.data.indicatorQuantity} />');
    expect(pointing).toContain("const insufficientToAttendWithoutReservation = noApplicableReservation");
    expect(pointing).toContain("disabled={invalidQuantity || mustAttendWhenCovered || finishProduction.isPending}");
    expect(pointing).toContain('onPointerDownOutside={(event) => event.preventDefault()}');
    expect(pointing).toContain('onEscapeKeyDown={(event) => event.preventDefault()}');
  });
});
