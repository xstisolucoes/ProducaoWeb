import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("visualização de layout de impressão", () => {
  it("consulta layout, clichês, facas e cores pelo produto e revisão do processo", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const pointingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(proxySource).toContain('app.get("/v1/pointing/:opCodigo/:mpCodigo/print-layout"');
    expect(proxySource).toContain("pv.pv_caminho_desenho as layout_path");
    expect(proxySource).toContain("left join ferramental_cliche fc on fc.fc_codigo = pv.fc_codigo");
    expect(proxySource).toContain("left join ferramental_faca ff on ff.ff_codigo = pv.ff_codigo");
    expect(proxySource).toContain("from prod_vendas_cores pvc inner join cores cor on cor.cor_codigo = pvc.cor_codigo");
    expect(proxySource).toContain('path.extname(layoutPath).toLowerCase() !== ".svg"');
    expect(proxySource).toContain("data:image/svg+xml;base64");
    expect(proxySource).not.toContain("layoutPath, svgDataUri");
    expect(routerSource).toContain("printLayout: operatorProcedure.input(processInput)");
    expect(pointingSource).toContain("Visualizar layout");
    expect(pointingSource).toContain("Layout de impressão");
  });
});
