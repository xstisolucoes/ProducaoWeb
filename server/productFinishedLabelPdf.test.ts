import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Etiqueta de Produto Acabado", () => {
  const source = readFileSync(resolve(process.cwd(), "server/processLabelPdf.ts"), "utf8");

  it("preserva a escala tipográfica e a hierarquia do modelo de referência", () => {
    expect(source).toContain('font:900 26pt "Arial Black",Arial,sans-serif');
    expect(source).toContain(".medium { font-size:24pt; }");
    expect(source).toContain(".large { font-size:42pt; }");
    expect(source).toContain(".reference-value { font-size:48pt;");
    expect(source).toContain('font:900 48pt/.92 "Arial Black",Arial,sans-serif');
    expect(source).toContain('font:900 68pt/.9 "Arial Black",Arial,sans-serif');
    expect(source).toContain('font:900 50pt/.92 "Arial Black",Arial,sans-serif');
    expect(source).toContain("const qrPayload = String(label.productCode);");
    expect(source).toContain("left:135mm; right:23mm; bottom:4mm");
    expect(source).toContain("width:40mm; text-align:center");
  });
});
