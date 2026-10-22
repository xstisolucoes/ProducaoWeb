import QRCode from "qrcode";
import {
  buildProcessLabelHtml,
  buildProductFinishedLabelHtml,
  type ProcessLabelData,
  type ProductFinishedLabelData,
} from "@shared/labelHtml";

/**
 * Gera o HTML completo da Etiqueta de Processo no navegador em milissegundos.
 */
export async function generateBrowserProcessLabelHtml(
  label: ProcessLabelData,
  quantityPerPallet: number
): Promise<string> {
  const qrPayload = `OP${label.operationCode}`;
  const qrCodeDataUri = await QRCode.toDataURL(qrPayload, {
    margin: 0,
    width: 330,
    errorCorrectionLevel: "M",
  });
  return buildProcessLabelHtml(label, quantityPerPallet, qrCodeDataUri);
}

/**
 * Gera o HTML completo da Etiqueta de Produto Acabado no navegador em milissegundos.
 */
export async function generateBrowserProductFinishedLabelHtml(
  label: ProductFinishedLabelData,
  palletQuantity: number
): Promise<string> {
  const qrPayload = String(label.productCode);
  const qrCodeDataUri = await QRCode.toDataURL(qrPayload, {
    margin: 0,
    width: 320,
    errorCorrectionLevel: "M",
  });
  return buildProductFinishedLabelHtml(label, palletQuantity, qrCodeDataUri);
}

/**
 * Envia o HTML diretamente para o diálogo de impressão nativo do navegador
 * (seja no Chrome do Windows, Edge ou Chromium do Linux/Raspberry Pi).
 * Não consome recursos de CPU/RAM com geração de PDF no servidor nem no cliente.
 */
export async function printHtmlWithBrowserDialog(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.style.opacity = "0";

      document.body.appendChild(frame);

      const frameDoc = frame.contentWindow?.document;
      if (!frameDoc) {
        frame.remove();
        return reject(new Error("Não foi possível acessar a janela de impressão."));
      }

      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      // Aguarda as imagens (logo e QR code) carregarem no frame antes de imprimir
      const triggerPrint = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          window.setTimeout(() => {
            frame.remove();
          }, 30_000);
        }
      };

      // Se o frame tiver imagens, aguardar brevemente
      window.setTimeout(triggerPrint, 250);
    } catch (e) {
      reject(e);
    }
  });
}
