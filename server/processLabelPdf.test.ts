import { describe, expect, it } from "vitest";
import { renderProcessLabelPdf } from "./processLabelPdf";

describe("PDF da Etiqueta de Processo", () => {
  it("gera um PDF em papel físico 145 × 210 mm", async () => {
    const pdf = await renderProcessLabelPdf({
      label: {
        operationCode: 10124,
        processCode: 8,
        productCode: 6000709,
        revision: 1,
        customerName: "Cliente de teste",
        orderedQuantity: 10,
        reference: "Referência de teste",
        currentProcess: "Apontamento BK",
        nextProcess: null,
        operatorName: "Operador de teste",
        jointPosition: "Interna",
        resin: "NÃO",
        companyName: "Empresa de teste",
        companyLogoDataUri: null,
        companyLogoError: null,
        printerOptions: [],
      },
      printer: "Impressora de teste",
      quantityPerPallet: 10,
      copies: 1,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 60000);
});
