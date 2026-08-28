import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Produção Especial", () => {
  it("mapeia OP principal e componentes pelo conjunto especial na mesma máquina", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");

    expect(proxySource).toContain("async function getSpecialProductionDetails");
    expect(proxySource).toContain("op.op_especial = ? and coalesce(op.op_principal, 'N') = 'N'");
    expect(proxySource).toContain('if (specialSetMachine) filterParts.push("(coalesce(op.op_especial, 0) = 0 or coalesce(op.op_principal, \'N\') <> \'N\')")');
    expect(proxySource).toContain('app.get("/v1/pointing/:opCodigo/:mpCodigo/special-production"');
    expect(contractSource).toContain("export type SpecialProductionComponent");
    expect(contractSource).toContain("export const getSpecialProduction");
    expect(routerSource).toContain("specialProduction: localProtectedProcedure");
  });

  it("sincroniza todas as OPs componentes dentro da transação da principal", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain("async function synchronizeSpecialProductionComponents");
    expect(proxySource).toContain("for (const component of special.components)");
    expect(proxySource).toContain("update mov_processos set mp_fila = ?");
    expect(proxySource).toContain("insert into mov_processos_horarios");
    expect(proxySource).toContain("async function startSpecialProductionComponents");
    expect(proxySource).toContain("const specialProduction = specialSetMachine ? await synchronizeSpecialProductionComponents(transaction");
    expect(proxySource).toContain("specialSetMachine ? await startSpecialProductionComponents(transaction");
    expect(proxySource).toContain("insertFinishedStock: manualProcess && pointingGroup");
    expect(proxySource).toContain("function isSpecialProductionMachine(machine)");
  });

  it("oculta componentes no grid principal e abre o Conjunto com os campos operacionais", () => {
    const programming = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/SpecialProductionDialog.tsx"), "utf8");
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const manual = readFileSync(resolve(process.cwd(), "client/src/pages/ManualPointing.tsx"), "utf8");
    const release = readFileSync(resolve(process.cwd(), "client/src/pages/ProductReleasePointing.tsx"), "utf8");

    expect(programming).toContain(">Conjunto</button>");
    expect(programming).toContain("<SpecialProductionDialog");
    expect((programming.match(/theme-toolbar sticky bottom-0/g) ?? []).length).toBe(1);
    expect(dialog).toContain("OPs que Compõem a OP:");
    expect(dialog).toContain("Código do Produto");
    expect(dialog).toContain("Referencial");
    expect(pointing).toContain("<SpecialProductionPanel");
    expect(manual).toContain("<SpecialProductionPanel");
    expect(release).toContain("<SpecialProductionPanel");
  });

  it("solicita automaticamente a Etiqueta PA somente no grupo Apontamento", () => {
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const manual = readFileSync(resolve(process.cwd(), "client/src/pages/ManualPointing.tsx"), "utf8");

    expect(pointing).toContain("const isPointingMachineGroup = String(item?.machineGroup");
    expect(pointing).toContain("if (isPointingMachineGroup) setShowProductFinishedLabel(true); else setLocation(\"/\");");
    expect(manual).toContain("const isPointingMachineGroup = String(pointing.data?.machineGroup");
    expect(manual).toContain("if (isPointingMachineGroup) setShowProductFinishedLabel(true);");
    expect(manual).toContain("else setLocation(\"/\");");
  });
});
