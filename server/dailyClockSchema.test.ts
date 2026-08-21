import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("estrutura confirmada do contador diário", () => {
  it("documenta os campos locais e os utiliza ao abrir ou encerrar o período", () => {
    const documentation = readFileSync(resolve(process.cwd(), "docs/contador-diario-confirmado.md"), "utf8");
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    for (const field of ["CDP_CODIGO", "MQP_CODIGO", "CDP_DATA", "CDP_INICIO", "CDP_FIM", "CDP_CRONOMETRO", "CDP_STATUS"]) {
      expect(documentation).toContain(field);
    }
    expect(proxySource).toContain("cdp_data = current_date");
    expect(proxySource).toContain("cdp_inicio, cdp_cronometro, cdp_status");
    expect(proxySource).toContain("cdp_fim = coalesce(cdp_cronometro, current_timestamp)");
    expect(proxySource).toContain("select current_timestamp as clock_value from rdb$database");
    expect(proxySource).toContain("set cdp_cronometro = ? where cdp_codigo = ?");
    expect(proxySource).toContain("return currentClock;");
    expect(proxySource).toContain("mp_fim = ?");
    expect(proxySource).toContain("mph_fim = ?");
  });
});
