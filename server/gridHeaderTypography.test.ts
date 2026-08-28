import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tipografia dos títulos de grid", () => {
  it("centraliza tamanho, peso, espaçamento e altura de cabeçalho para os dois temas", () => {
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const primitives = readFileSync(resolve(process.cwd(), "client/src/components/ProductionPrimitives.tsx"), "utf8");

    expect(styles).toContain("--grid-header-font-size: 0.92rem");
    expect(styles).toContain("--grid-header-font-weight: 800");
    expect(styles).toContain("--grid-header-letter-spacing: 0.045em");
    expect(styles).toContain("table thead :is(th, td)");
    expect(styles).toContain("table thead th > button");
    expect(styles).toContain(':root[data-brand-theme="xsti"] table thead');
    expect(primitives).toContain('className={`h-4 w-4 shrink-0');
  });
});
