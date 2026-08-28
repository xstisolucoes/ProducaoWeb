import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_TYPOGRAPHY_SETTINGS,
  FONT_FAMILY_CSS,
  TYPOGRAPHY_STORAGE_KEY,
  normalizeTypographySettings,
} from "../client/src/contexts/ThemeContext";

describe("tipografia configurável por tema", () => {
  it("inicia os temas Verde e XSTI em Tahoma 15px negrito", () => {
    expect(DEFAULT_TYPOGRAPHY_SETTINGS).toEqual({
      verde: { fontFamily: "tahoma", fontSize: 15, fontWeight: "bold", fontStyle: "normal" },
      xsti: { fontFamily: "tahoma", fontSize: 15, fontWeight: "bold", fontStyle: "normal" },
    });
    expect(FONT_FAMILY_CSS.tahoma).toContain("Tahoma");
    expect(TYPOGRAPHY_STORAGE_KEY).toBe("production-theme-typography-v2");
  });

  it("normaliza e mantém preferências independentes para cada tema", () => {
    const settings = normalizeTypographySettings({
      verde: { fontFamily: "verdana", fontSize: 18, fontWeight: "bold", fontStyle: "italic" },
      xsti: { fontFamily: "tahoma", fontSize: 14, fontWeight: "normal", fontStyle: "normal" },
    });

    expect(settings.verde).toEqual({ fontFamily: "verdana", fontSize: 18, fontWeight: "bold", fontStyle: "italic" });
    expect(settings.xsti).toEqual({ fontFamily: "tahoma", fontSize: 14, fontWeight: "normal", fontStyle: "normal" });
  });

  it("descarta configurações inválidas e restaura o padrão de Tahoma", () => {
    const settings = normalizeTypographySettings({
      verde: { fontFamily: "papyrus", fontSize: 72, fontWeight: "heavy", fontStyle: "oblique" },
      xsti: null,
    });

    expect(settings).toEqual(DEFAULT_TYPOGRAPHY_SETTINGS);
  });

  it("sobrepõe as famílias Tailwind fixas, incluindo font-mono, pela escolha do Tema", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(css).toContain("font-mono, font-sans e font-serif");
    expect(css).toContain("body *::before");
    expect(css).toContain("body *::after");
    expect(css).toContain("font-family: var(--app-font-family) !important");
    expect(css).toContain("font-weight: var(--app-font-weight) !important");
    expect(css).toContain("font-style: var(--app-font-style) !important");
  });
});
