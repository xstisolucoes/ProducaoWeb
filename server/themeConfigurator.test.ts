import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("configurador de temas operacionais", () => {
  const context = readFileSync(resolve(process.cwd(), "client/src/contexts/ThemeContext.tsx"), "utf8");
  const configurator = readFileSync(resolve(process.cwd(), "client/src/components/ThemeConfigurator.tsx"), "utf8");
  const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
  const programming = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
  const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");

  it("mantém Verde como padrão e persiste a escolha XSTI por estação", () => {
    expect(context).toContain('export type BrandTheme = "verde" | "xsti"');
    expect(context).toContain('localStorage.getItem("production-brand-theme")');
    expect(context).toContain('localStorage.setItem("production-brand-theme", brandTheme)');
    expect(context).toContain('document.documentElement.dataset.brandTheme = brandTheme');
  });

  it("oferece o tema XSTI com a logomarca fornecida", () => {
    expect(configurator).toContain("Verde Produção");
    expect(configurator).toContain("Vermelho XSTI");
    expect(configurator).toContain("/manus-storage/xsti-logo_fe74654b.png");
  });

  it("aplica tokens de marca à Programação, ao Apontamento e aos diálogos", () => {
    expect(css).toContain(':root[data-brand-theme="xsti"]');
    expect(css).toContain(".theme-machine-band");
    expect(css).toContain('[data-slot="dialog-header"]');
    expect(programming).toContain("<ThemeConfigurator />");
    expect(programming).toContain("theme-machine-band");
    expect(login).toContain("<ThemeConfigurator compact />");
    expect(login).toContain('alt="XSTI — Soluções em Tecnologia da Informação"');
  });
});
