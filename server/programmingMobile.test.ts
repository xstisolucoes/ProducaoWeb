import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Programação móvel do PCP e Programador", () => {
  it("substitui a grade extensa por cartões operacionais no celular e preserva a tabela no desktop", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(page).toContain("const renderProgrammerMobileCard");
    expect(page).toContain("programming-mobile-carousel");
    expect(page).toContain("Carrossel de ordens");
    expect(page).toContain("Os ajustes abaixo acompanham o cartão selecionado.");
    expect(page).toContain("ChevronLeft");
    expect(page).toContain("ChevronRight");
    expect(page).toContain("mobile-command-button");
    expect(page).toContain("mobile-command-label");
    expect(page).toContain('aria-label={label}');
    expect(page).toContain("Ver Situação e Solicitação");
    expect(page).toContain("Alterar Processo");
    expect(page).toContain('programmer ? "hidden min-h-[388px] md:block"');
    expect(page).toContain('programmer ? <div className="md:hidden">');
    expect(page).toContain('programmer ? "programming-programmer"');
    expect(css).toContain(".theme-toolbar > div { display: grid !important;");
    expect(css).toContain(".programming-mobile-carousel { scrollbar-width: none;");
    expect(css).toContain(".theme-toolbar .mobile-command-button");
    expect(css).toContain(".theme-toolbar .mobile-command-label");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain("min-height: 2.35rem");
    expect(css).toContain(".theme-toolbar { overflow: hidden !important; }");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });
});
