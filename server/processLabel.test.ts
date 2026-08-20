import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const proxy = readFileSync(resolve(root, "local-firebird-proxy/server.mjs"), "utf8");
const contracts = readFileSync(resolve(root, "server/firebirdProxy.ts"), "utf8");
const router = readFileSync(resolve(root, "server/routers/production.ts"), "utf8");
const pointing = readFileSync(resolve(root, "client/src/pages/Pointing.tsx"), "utf8");
const dialog = readFileSync(resolve(root, "client/src/components/ProcessLabelDialog.tsx"), "utf8");

describe("Etiqueta de Processo", () => {
  it("consulta os campos legados e preserva o isolamento pela máquina atual", () => {
    expect(proxy).toContain('app.get("/v1/pointing/:opCodigo/:mpCodigo/process-label"');
    expect(proxy).toContain("mp.mp_fantasia as customer_name");
    expect(proxy).toContain("mp.mp_qtde_pedido as ordered_quantity");
    expect(proxy).toContain("pv.posicao_junta as joint_position");
    expect(proxy).toContain("mp.mp_processo as current_process");
    expect(proxy).toContain("mp2.mp_codigo = mp.mp_codigo + 1");
    expect(proxy).toContain("mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?");
    expect(proxy.indexOf('/process-label"')).toBeLessThan(proxy.indexOf('app.get("/v1/pointing/:opCodigo/:mpCodigo",'));
  });

  it("expõe contrato protegido, impressoras configuráveis e ação do apontamento", () => {
    expect(proxy).toContain("PRODUCTION_LABEL_PRINTERS");
    expect(contracts).toContain("export type ProcessLabel");
    expect(contracts).toContain("export const getProcessLabel");
    expect(router).toContain("processLabel: localProtectedProcedure");
    expect(router).toContain("companyCode: ctx.localUser.companyCode");
    expect(pointing).toContain("ProcessLabelDialog");
    expect(pointing).toContain("Etiqueta de processo");
    expect(pointing).toContain('event.key === "F10"');
  });

  it("pede os parâmetros de impressão e gera a etiqueta PDF vertical com QR Code", () => {
    expect(dialog).toContain("Qtde. por Palete");
    expect(dialog).toContain("Cópias");
    expect(dialog).toContain("Impressora");
    expect(dialog).toContain("previewProcessLabel");
    expect(dialog).toContain("printProcessLabel");
    expect(dialog).toContain("pdfDataUrl");
    expect(dialog).toContain("PDF final");
    expect(router).toContain("previewProcessLabel: localProtectedProcedure");
    expect(router).toContain("printProcessLabel: localProtectedProcedure");
    expect(proxy).toContain('app.post("/v1/process-label/print"');
    expect(proxy).toContain("printPdfDirectly");
    expect(dialog).toContain("maxLength={5}");
    expect(dialog).toContain('slice(0, 5)');
  });

  it("lista impressoras do Windows no proxy local sem expor comandos ao navegador", () => {
    expect(proxy).toContain('app.get("/v1/system/printers"');
    expect(proxy).toContain("Get-CimInstance -ClassName Win32_Printer");
    expect(proxy).toContain('execFileAsync("powershell.exe"');
    expect(contracts).toContain("export const getLocalPrinters");
    expect(router).toContain("printers: router");
    expect(dialog).toContain("etiqueta será enviada diretamente à impressora Windows selecionada");
  });

  it("obtém a empresa selecionada no login e a logomarca da etiqueta pelo cadastro EMPRESA", () => {
    expect(proxy).toContain('app.get("/v1/companies"');
    expect(proxy).toContain("emp_logo as logo_blob");
    expect(proxy).toContain("readBlobImageDataUri");
    expect(proxy).toContain("from empresa");
    expect(contracts).toContain("export const getLocalCompanies");
    expect(dialog).toContain("Visualizar etiqueta");
    expect(dialog.indexOf("Visualizar etiqueta")).toBeLessThan(dialog.indexOf(">Fechar</Button>"));
    expect(dialog).not.toContain('<X className');
  });
});
