import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("seleção persistida de estação", () => {
  it("mantém a empresa oculta e exige autorização administrativa para configurar a estação", () => {
    const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");
    const authRouter = readFileSync(resolve(process.cwd(), "server/routers/localAuth.ts"), "utf8");
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programming = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const binding = readFileSync(resolve(process.cwd(), "server/stationBinding.ts"), "utf8");
    expect(login).toContain('production-station-machine-code');
    expect(login).toContain('window.location.assign("/")');
    expect(login).toContain('aria-busy={submitting || signIn.isPending}');
    expect(login).toContain('machineCode');
    expect(login).toContain('className="hidden"');
    expect(login).toContain('O Primeiro Acesso');
    expect(login).toContain('PCP, Programador ou Administrador');
    expect(login).not.toContain('id="station"');
    expect(authRouter).toContain('stations: publicProcedure.query');
    expect(authRouter).toContain('machineCode: z.number().int().positive().nullable()');
    expect(authRouter).toContain('Esta estação ainda não está configurada');
    expect(authRouter).toContain('persistStation: publicProcedure');
    expect(authRouter).toContain('getStationBinding(ctx.req)');
    expect(proxy).toContain('app.get("/v1/stations"');
    expect(proxy).toContain('function canConfigureStation');
    expect(proxy).toContain('PRODUCTION_STATION_CONFIGURATOR_GROUPS');
    expect(proxy).toContain('Esta estação ainda não está configurada. Solicite ao PCP, Programador ou Administrador');
    expect(programming).toContain('canConfigureStation === true');
    expect(programming).toContain('Configurar Máquina/Processo deste Posto');
    expect(binding).toContain('production-station-bindings.json');
    expect(binding).toContain('STATION_COOKIE');
  });
});
