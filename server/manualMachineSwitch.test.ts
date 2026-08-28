import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("troca de Máquina/Processo do grupo Manual", () => {
  it("restringe a lista a Processo Manual, encerra a sessão e exige novo login", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const localAuth = readFileSync(resolve(process.cwd(), "server/routers/localAuth.ts"), "utf8");
    const programming = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");

    expect(proxy).toContain('app.get("/v1/manual-machines"');
    expect(proxy).toContain("mqp_processo_manual");
    expect(proxy).toContain('"LIBERACAO DE PRODUTO"');
    expect(proxy).toContain('"APONTAMENTO"');
    expect(localAuth).toContain("manualMachines");
    expect(localAuth).toContain("switchManualMachine");
    expect(localAuth).toContain('operationalProfile !== "manual-production"');
    expect(localAuth).toContain("input.machineCode ?? persistedMachineCode");
    expect(localAuth).toContain("return { machine };");
    expect(programming).toContain("Trocar Máquina/Processo");
    expect(programming).toContain("Trocar Máquina/Processo Manual");
    expect(programming).toContain("manualMachines.data");
    expect(programming).toContain("switchManualMachine.mutate");
    expect(programming).toContain("production-manual-machine-code");
    expect(programming).toContain("await logout()");
    expect(programming).toContain('setLocation("/")');
    expect(login).toContain("manualMachineCode ?? persistedStation.data?.machineCode ?? machineCode");
    expect(login).toContain("removeItem(manualMachineStorageKey)");
  });
});
