import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("cores operacionais dos resultados de apontamento", () => {
  it("mantém Atendido verde, A concluir laranja e Parcial azul em todos os temas", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const manual = readFileSync(resolve(process.cwd(), "client/src/pages/ManualPointing.tsx"), "utf8");
    const release = readFileSync(resolve(process.cwd(), "client/src/pages/ProductReleasePointing.tsx"), "utf8");

    expect(css).toContain(".outcome-attended-action");
    expect(css).toContain("#178d55");
    expect(css).toContain(".outcome-to-conclude-action");
    expect(css).toContain("#d68a16");
    expect(css).toContain(".outcome-partial-action");
    expect(css).toContain("#2379d6");
    expect(css).not.toContain(':root[data-brand-theme="xsti"] .manual-partial-action');
    expect(pointing).toContain('partial: "outcome-partial-action"');
    expect(pointing).toContain('to_conclude: "outcome-to-conclude-action"');
    expect(manual).toContain("outcome-attended-action");
    expect(manual).toContain("outcome-partial-action");
    expect(release).toContain("outcome-attended-action");
    expect(release).toContain("outcome-partial-action");
    expect(pointing).not.toContain("Concluir produção");
    expect(pointing).not.toContain("Manter produção pendente");
    expect(pointing).not.toContain("Registrar produção parcial");
    expect(pointing).not.toContain("Abrir checklist");
    expect(pointing).not.toContain("Manter setup pendente");
    expect(pointing).not.toContain("Cancelar setup");
  });
});
