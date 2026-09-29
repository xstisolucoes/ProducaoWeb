import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("faixa de situação do apontamento", () => {
  it("apresenta apenas o primeiro nome do operador", () => {
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    expect(pointing).toMatch(/String\(user\?\.name \|\| "—"\)[\s\S]{0,100}\.split\(\/\\s\+\/\)\[0\]/);
  });
});
