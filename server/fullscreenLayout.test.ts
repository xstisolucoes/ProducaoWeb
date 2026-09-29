import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("visualizador de layout em tela inteira", () => {
  it("mantém zoom por botões e roda, arraste, ajuste e fechamento visíveis ao operador", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/ProductVisualDialogs.tsx"), "utf8");

    expect(source).toContain("!fixed !inset-0 !h-dvh !w-screen");
    expect(source).toContain("const changeZoom = (delta: number)");
    expect(source).toContain("onWheel={event =>");
    expect(source).toContain("onPointerDown={event =>");
    expect(source).toContain("onPointerMove={event =>");
    expect(source).toContain("Ajustar");
    expect(source).toContain("Fechar");
    expect(source).toContain("overflow-hidden bg-white");
    expect(source).toContain("colorChipStyle(color.hexWhite)");
    expect(source).toContain("colorChipContrastTone(color.hexWhite)");
    expect(source).toContain("layout-meta-card");
    expect(source).toContain('text-[15px]');
    expect(source).toContain('text-[#356d4a]');
    expect(source).toContain('Produto');
    expect(source).toContain("Clichê {cliche.code}");
    expect(source).toContain("layout-color-chip rounded border px-3 py-1");
    expect(source).toContain("font-black shadow-sm");
    expect(source).not.toContain("Branco: {color.hexWhite ||");
    expect(source).toContain("bg-[#d9f2df]");
    expect(source).toContain("border-[#92c7a3]");
    expect(source).toContain("text-[#185d3b]");
    expect(source).not.toContain("showPrintDetails");
    expect(source).not.toContain("LayoutResource");
  });
});
