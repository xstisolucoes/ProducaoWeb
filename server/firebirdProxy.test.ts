import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirebirdProxyConfiguration, getRawMaterialTrace } from "./firebirdProxy";

const runIntegration = process.env.FIREBIRD_PROXY_INTEGRATION_TEST === "true";
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.FIREBIRD_PROXY_URL;
  delete process.env.FIREBIRD_PROXY_TOKEN;
});

describe("proxy Firebird", () => {
  it("rejeita credenciais ou URL de proxy ausentes e malformadas", () => {
    expect(() => getFirebirdProxyConfiguration({})).toThrow("FIREBIRD_PROXY_URL");
    expect(() =>
      getFirebirdProxyConfiguration({
        FIREBIRD_PROXY_URL: "producao.interna",
        FIREBIRD_PROXY_TOKEN: "token",
      }),
    ).toThrow("http:// ou https://");
  });

  it.skipIf(!runIntegration)("valida o endpoint local /health com o token configurado", async () => {
    const { firebirdProxyHealthCheck } = await import("./firebirdProxy");
    await expect(firebirdProxyHealthCheck()).resolves.toMatchObject({
      status: "ok",
      database: "reachable",
    });
  });

  it("consulta matérias-primas pela rota exclusiva da estrutura da ordem", async () => {
    process.env.FIREBIRD_PROXY_URL = "http://127.0.0.1:8787";
    process.env.FIREBIRD_PROXY_TOKEN = "token-de-teste";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(getRawMaterialTrace({ opCodigo: 11343, mpCodigo: 1, machineCode: 4 })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/v1/order-structure/11343/raw-materials?mpCodigo=1&machineCode=4",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer token-de-teste" }) }),
    );
  });

  it("baixa a reserva com a mesma procedure do legado e sinal negativo de saída", () => {
    const localProxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(localProxySource).toContain("execute procedure movimenta_estoque");
    expect(localProxySource).toContain("[reserve.productCode, reserve.supplierCode, -allocation");
  });

  it("aplica os tipos de reserva do legado e usa o fornecedor gravado na reserva", () => {
    const localProxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const policySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/reservationPolicy.mjs"), "utf8");

    expect(policySource).toContain('normalizedGroup === 1');
    expect(policySource).toContain('["ABERTA", "REVINCADA"]');
    expect(policySource).toContain('normalizedGroup === 3');
    expect(policySource).toContain('["CORTADA/VINCADA", "APROVEITAMENTO"]');
    expect(localProxySource).toContain("pcf.pcf_codigo = er.pcf_codigo");
  });

  it("permite configurar a codificação do Firebird legado e usa Windows-1252 como padrão", () => {
    const localProxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(localProxySource).toContain('const firebirdEncoding = process.env.FIREBIRD_ENCODING?.trim() || "WIN1252"');
    expect(localProxySource).toContain("encoding: firebirdEncoding");
  });
});
