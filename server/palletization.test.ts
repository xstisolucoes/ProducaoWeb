import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Pacotes / Paletização", () => {
  it("prioriza a configuração específica do cliente sobre a configuração padrão", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxy).toContain('/v1/pointing/:opCodigo/:mpCodigo/palletization');
    expect(proxy).toContain("pvp.pes_codigo = mp.pes_codigo");
    expect(proxy).toContain("pvp.pes_codigo = 0 and not exists");
    expect(proxy).toContain("case when pvp.pes_codigo = mp.pes_codigo then 0 else 1 end");
    expect(proxy).toContain("las.lastro_json as layer_image_path");
    expect(proxy).toContain('const palletImagePath = String(field("pallet_image_path") ?? "").trim();');
    expect(proxy).toContain('const layerImagePath = String(field("layer_image_path") ?? "").trim();');
    expect(proxy).toContain("const palletImage = await readImageDataUri(palletImagePath, \"o palete\");");
    expect(proxy).toContain("const layerImage = await readImageDataUri(layerImagePath, \"o lastro de amarração\");");
    expect(proxy).toContain("pvp.palete_codigo as pallet_code");
    expect(proxy).toContain("const palletized = yes(\"palletized\") || palletDetailsAvailable");
    expect(proxy).toContain("palletImageDataUri: palletImage.dataUri");
    expect(proxy).toContain("layerImageDataUri: layerImage.dataUri");
  });

  it("mantém os recursos de palete condicionados a PVP_PALETIZADO", () => {
    const client = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/ProductVisualDialogs.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");

    expect(router).toContain("palletization: operatorProcedure.input(processInput)");
    expect(client).toContain("Pacotes / Paletização");
    expect(client).toContain("palletization.data.palletized ?");
    expect(client).toContain("Não cadastrado.");
    expect(client).toContain("PalletizationImage");
    expect(client).toContain("!w-[calc(100vw-1.25rem)] !max-w-[1440px]");
    expect(client).toContain("Lastro de Amarração");
    expect(client).toContain("palletization.data.layerImageDataUri");
    expect(client).not.toContain('title="Desenho do Palete"');
    expect(dialog).toContain("Lastro de Amarração");
    expect(dialog).not.toContain('title="Desenho do Palete"');
  });

  it("organiza os dados no formato operacional da referência Delphi", () => {
    const client = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(client).toContain("Tipo do Palete:");
    expect(client).toContain("Altura Máxima do Palete:");
    expect(client).toContain("Qtde de Pacotes na Altura:");
    expect(client).toContain("Fitas no Palete: L:");
    expect(client).toContain("Observação");
    expect(client).toContain('value={palletization.data.palletWidth}');
    expect(client).toContain('value={palletization.data.palletLength}');
    expect(client).toContain('value={palletization.data.packagesPerLayer}');
    expect(client).toContain('value={palletization.data.totalProducts}');
  });
});
