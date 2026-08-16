import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("modal de finalização", () => {
  it("mantém os campos e resultados em uma coluna até haver largura operacional suficiente", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(source).toContain("overflow-x-hidden overflow-y-auto");
    expect(source).toContain("grid grid-cols-1 gap-4 min-[780px]:grid-cols-2");
    expect(source).toContain("grid grid-cols-1 gap-3 min-[780px]:grid-cols-3");
    expect(source).toContain("w-full min-w-0");
  });
});
