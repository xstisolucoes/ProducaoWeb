import { describe, expect, it } from "vitest";
import { colorChipContrastTone, colorChipStyle } from "../client/src/lib/colorContrast";

describe("contraste dos chips de tinta", () => {
  it("preserva a tinta preta e usa rótulo branco", () => {
    expect(colorChipStyle("#000000")).toEqual({ backgroundColor: "#000000", borderColor: "#ffffff", color: "#ffffff" });
    expect(colorChipContrastTone("#000000")).toBe("light");
  });

  it("mantém tintas claras com rótulo preto e trata valor ausente", () => {
    expect(colorChipStyle("#f6df65").color).toBe("#111111");
    expect(colorChipStyle(null)).toMatchObject({ backgroundColor: "#dce8ef", color: "#111111" });
    expect(colorChipContrastTone("#f6df65")).toBe("dark");
  });
});
