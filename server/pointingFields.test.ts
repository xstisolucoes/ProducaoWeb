import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("campos técnicos do apontamento", () => {
  it("distingue produto interno, CPC, cliente e composição no contrato e na tela", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contract = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

    expect(proxy).toContain("mp.pv_codigo as product_code");
    expect(proxy).toContain("pv.pv_cod_prod_cli as customer_product_code");
    expect(proxy).toContain("cint.cint_descricao as internal_composition");
    expect(proxy).toContain("p.pes_fantasia as client_fantasy");
    expect(proxy).toContain("cint.cint_descricao as internal_composition");
    expect(proxy).toContain("pv.pv_fechamento as closing");
    expect(proxy).toContain("pv.posicao_junta as lap_closing");
    expect(proxy).toContain("pv.pv_chapa_cortada_larg as cut_sheet_width");
    expect(proxy).toContain("pv.pv_chapa_cortada_comp as cut_sheet_length");
    expect(contract).toContain("productCode: number | null");
    expect(contract).toContain("internalComposition: string | null");
    expect(contract).toContain("cutSheetWidth: string | null");
    expect(contract).toContain("cutSheetLength: string | null");
    expect(contract).toContain("lapClosing: string | null");
    expect(page).toContain('Info label="Produto" value={item.productCode}');
    expect(page).toContain('Info label="CPC" value={item.customerProductCode}');
    expect(page).toContain('Info label="Cliente" value={item.clientFantasy || item.client}');
    expect(page).toContain('Info label="Papelão ondulado" value={item.internalComposition}');
    expect(page).toContain('Info label="Fechamento" value={item.closing}');
    expect(page).toContain('Info label="Fechamento do LAP" value={item.lapClosing}');
    expect(page).toContain('MeasureWithComplement label="Ajuste da largura" value={item.adjustmentWidth} complement={item.cutSheetWidth}');
    expect(page).toContain('MeasureWithComplement label="Ajuste do comprimento" value={item.adjustmentLength} complement={item.cutSheetLength}');
    expect(page).toContain("grid-cols-[minmax(0,1fr)_180px]");
    expect(page).toContain("sm:grid-cols-[minmax(0,1fr)_210px]");
    expect(page).toContain("min-h-24");
    expect(page).toContain("sm:text-6xl");
    expect(page).toContain("palletization.data.layerImageDataUri");
    expect(page).toContain('productionStarted ? "EM PRODUÇÃO"');
    expect(page).toContain("Reserva de matéria-prima vinculada a esta OP");
    expect(page).toContain('if (event.key === "F5")');
    expect(page).toContain("Visualizar layout");
    expect(page).not.toContain("Voltar à fila");
    expect(app).toContain('<Route path={"/apontamento/:opCodigo/:mpCodigo"}><Pointing /></Route>');
  });
});
