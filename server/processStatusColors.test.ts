import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("cores de MOV_PROCESSOS", () => {
  it("centraliza os status operacionais nas cores definidas", () => {
    const primitives = readFileSync(resolve(process.cwd(), "client/src/components/ProductionPrimitives.tsx"), "utf8");
    expect(primitives).toContain('normalized === "em produção"');
    expect(primitives).toContain('normalized === "liberado"');
    expect(primitives).toContain('normalized === "atendido"');
    expect(primitives).toContain('normalized === "cancelado" || normalized === "setup cancelado"');
    expect(primitives).toContain('normalized === "a concluir" || normalized === "setup a concluir"');
  });
});
