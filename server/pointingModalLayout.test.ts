import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("layout do modal de finalização", () => {
  it("usa compactação vertical e mantém a ação Voltar fixa no rodapé", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(source).toContain("max-h-[92vh]");
    expect(source).toContain("overflow-x-hidden overflow-y-auto");
    expect(source).toContain("sticky bottom-0 z-10");
    expect(source).toContain("min-h-16 h-auto w-full");
  });

  it("amplia a parada em duas colunas e mantém o cancelamento no padrão vermelho", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(source).toContain("!max-w-[1540px]");
    expect(source).toContain("min-[820px]:grid-cols-2");
    expect(source).toContain("[-webkit-line-clamp:2]");
    expect(source).toContain("min-h-[84px]");
    expect(source).toContain("border-[#cf3f3f] bg-[#cf3f3f]");
  });
});
