import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("motivos de parada por máquina", () => {
  it("inclui motivos ativos globais e do GMQ_CODIGO da máquina atual", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain('app.get("/v1/pointing/pause-reasons"');
    expect(proxy).toContain("mo.mo_todas_maquinas = 'S'");
    expect(proxy).toContain("mo.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos");
    expect(proxy).toContain("mo.mo_tipo = 'Paradas de Maquina'");
    expect(proxy).toContain("_WIN1252 x'50726F6475E7E36F'");
    expect(proxy).not.toContain("pauseProcessFieldRows");
    expect(proxy).toContain("and mph_codigo = ? and hpar_situacao = 'A'");
  });
});
