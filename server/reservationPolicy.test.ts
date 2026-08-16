import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reservePolicy, selectApplicableReservations } from "../local-firebird-proxy/reservationPolicy.mjs";

describe("política de reservas do apontamento", () => {
  it("replica os tipos usados pelo legado nos grupos de máquina 1, 2 e 3", () => {
    expect(reservePolicy(1, "Riscador", {})).toMatchObject({ applies: true, types: ["ABERTA", "REVINCADA"], label: "Aberta ou Revincada" });
    expect(reservePolicy(2, "Corte e Vinco", {})).toMatchObject({ applies: true, types: ["CORTADA/VINCADA", ""], label: "Cortada/Vincada" });
    expect(reservePolicy(3, "Impressora", {})).toMatchObject({ applies: true, types: ["CORTADA/VINCADA", "APROVEITAMENTO"], label: "Cortada/Vincada ou Aproveitamento" });
  });

  it("permite configurar grupos fora da numeração padrão do legado", () => {
    expect(reservePolicy(44, "Máquina especial", { FIREBIRD_RESERVE_RISCADOR_GROUPS: "44" }).types).toEqual(["ABERTA", "REVINCADA"]);
    expect(reservePolicy(55, "Máquina especial", { FIREBIRD_RESERVE_CORTADA_GROUPS: "55" }).types).toEqual(["CORTADA/VINCADA", "APROVEITAMENTO"]);
  });

  it("reconhece a única reserva aberta de uma impressora quando o tipo gravado diverge", () => {
    const printerPolicy = reservePolicy(null, "Impressoras · Imp. Nilgraf 0900 x 1800", {});

    expect(printerPolicy.acceptsSingleOpenFallback).toBe(true);
    expect(selectApplicableReservations([{ type: "ESTOQUE", reserveCode: 1 }], printerPolicy)).toEqual([{ type: "ESTOQUE", reserveCode: 1 }]);
    expect(selectApplicableReservations([{ type: "ESTOQUE", reserveCode: 1 }, { type: "OUTRO", reserveCode: 2 }], printerPolicy)).toEqual([]);
  });

  it("é a mesma política importada pelo proxy que consulta estoque_reservado", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain('import { reservePolicy, selectApplicableReservations } from "./reservationPolicy.mjs"');
    expect(proxySource).toContain("const policy = reservePolicy(");
    expect(proxySource).toContain("const applicableRows = selectApplicableReservations(normalized, policy)");
    expect(proxySource).not.toContain("gmq_descricao");
    expect(proxySource).toContain("mq.mqp_descricao as machine_description");
  });

  it("usa o saldo geral apenas quando não existe reserva aplicável à finalização", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const pointingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(proxySource).toContain("if (!reservation.applies && netQuantity > currentBalance)");
    expect(proxySource).toContain("const nextBalance = reservation.applies ? Math.max(0, currentBalance - netQuantity) : currentBalance - netQuantity");
    expect(pointingSource).toContain("Com reserva vinculada, a finalização considera o saldo reservado");
    expect(pointingSource).toContain("será usado o saldo geral do processo");
  });
});
