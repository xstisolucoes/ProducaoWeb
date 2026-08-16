import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("visualizador de layout em tela inteira", () => {
  it("mantém zoom por botões e roda, arraste, ajuste e fechamento visíveis ao operador", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(source).toContain("!fixed !inset-0 !h-dvh !w-screen");
    expect(source).toContain("function changeLayoutZoom(delta: number)");
    expect(source).toContain("onWheel={(event)");
    expect(source).toContain("onPointerDown={(event)");
    expect(source).toContain("onPointerMove={(event)");
    expect(source).toContain("Ajustar");
    expect(source).toContain("Fechar");
    expect(source).toContain("bg-white\" onWheel");
    expect(source).toContain("backgroundColor: safeColor(color.hexWhite)");
    expect(source).toContain('text-xs font-black uppercase tracking-wide text-[#356d4a]">Produto');
    expect(source).toContain("Clichê {cliche.code}");
    expect(source).toContain("text-sm font-black text-white shadow-sm");
    expect(source).not.toContain("Branco: {color.hexWhite ||");
    expect(source).toContain("bg-[#d9f2df]");
    expect(source).toContain("border-[#92c7a3]");
    expect(source).toContain("text-[#185d3b]");
    expect(source).not.toContain("showPrintDetails");
    expect(source).not.toContain("LayoutResource");
  });
});
