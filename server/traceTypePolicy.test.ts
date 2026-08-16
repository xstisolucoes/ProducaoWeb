import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("filtro de rastreio por grupo da máquina", () => {
  it("exige que a estrutura use o mesmo GMQ_CODIGO da máquina do processo", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const clientSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");

    expect(proxySource).toContain("mq.gmq_codigo as group_code");
    expect(proxySource).toContain("const groupCode = Number(processRows[0].group_code");
    expect(proxySource).toContain("where ope.op_codigo = ? and pvet.gmq_codigo = ?");
    expect(proxySource).not.toContain("function traceTypeFilterForMachine");
    expect(clientSource).toContain("raw-materials?mpCodigo=${input.mpCodigo}&machineCode=${input.machineCode}");
  });
});
