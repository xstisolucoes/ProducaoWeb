import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("seleção persistida de estação", () => {
  it("oferece estações no login e transmite a seleção ao proxy central", () => {
    const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");
    const authRouter = readFileSync(resolve(process.cwd(), "server/routers/localAuth.ts"), "utf8");
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(login).toContain('production-station-machine-code');
    expect(login).toContain('Estação de trabalho');
    expect(login).toContain('machineCode');
    expect(authRouter).toContain('stations: publicProcedure.query');
    expect(authRouter).toContain('machineCode: z.number().int().positive().nullable()');
    expect(proxy).toContain('app.get("/v1/stations"');
    expect(proxy).toContain('findMachineForOperator(Number(user.usu_codigo), req.body?.machineCode)');
  });
});
