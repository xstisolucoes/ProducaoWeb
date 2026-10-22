import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import {
  buildProcessLabelHtml,
  buildProductFinishedLabelHtml,
} from "@shared/labelHtml";
import type { ProcessLabel, ProductFinishedLabel } from "./firebirdProxy";

const require = createRequire(import.meta.url);
type JsreportInstance = { init: () => Promise<unknown>; render: (request: Record<string, unknown>) => Promise<{ content: NodeJS.ReadableStream }> };
const jsreport = require("jsreport") as (configuration: Record<string, unknown>) => JsreportInstance;
const QRCode = require("qrcode") as { toDataURL: (text: string, options: Record<string, unknown>) => Promise<string> };

let jsreportInstance: JsreportInstance | null = null;
let pdfRenderingPromise: Promise<void | unknown> = Promise.resolve();

async function enqueuePdfRendering<T>(task: () => Promise<T>): Promise<T> {
  const taskPromise = pdfRenderingPromise.then(async () => {
    try {
      return await task();
    } catch (e) {
      throw e;
    }
  });
  pdfRenderingPromise = taskPromise.catch(() => {}) as Promise<void | unknown>;
  return taskPromise;
}

function resolveChromiumExecutable() {
  const programFiles = process.env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    process.env.PRODUCTION_CHROMIUM_PATH,
    process.env.CHROME_PATH,
    `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
    localAppData ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate));
}

async function getJsreport() {
  if (!jsreportInstance) {
    const executablePath = resolveChromiumExecutable();
    const instance = jsreport({
      extensions: { express: { enabled: false } },
      chrome: { launchOptions: executablePath ? { executablePath } : undefined },
    });
    await instance.init();
    jsreportInstance = instance;
  }
  return jsreportInstance;
}

function safe(value: string | number | null | undefined) {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function formatDateTime() {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date()).replace(",", " -");
}

export async function renderProcessLabelPdf(label: ProcessLabel, input: { quantityPerPallet: number }) {
  return enqueuePdfRendering(async () => {
    const qrPayload = `OP${label.operationCode}`;
    const qrCode = await QRCode.toDataURL(qrPayload, { margin: 0, width: 330, errorCorrectionLevel: "M" });
    const html = buildProcessLabelHtml(label, input.quantityPerPallet, qrCode);
    const report = await (await getJsreport()).render({ template: { recipe: "chrome-pdf", engine: "none", content: html }, options: { preview: false } });
    if (Buffer.isBuffer(report.content)) return report.content;
    if (report.content instanceof Uint8Array) return Buffer.from(report.content);

    const chunks: Buffer[] = [];
    for await (const chunk of report.content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  });
}

export async function renderProductFinishedLabelPdf(label: ProductFinishedLabel, input: { palletQuantity: number }) {
  return enqueuePdfRendering(async () => {
    const qrPayload = String(label.productCode);
    const qrCode = await QRCode.toDataURL(qrPayload, { margin: 0, width: 320, errorCorrectionLevel: "M" });
    const html = buildProductFinishedLabelHtml(label, input.palletQuantity, qrCode);
    const report = await (await getJsreport()).render({ template: { recipe: "chrome-pdf", engine: "none", content: html, chrome: { printBackground: true, preferCSSPageSize: true } }, options: { preview: false } });
    if (Buffer.isBuffer(report.content)) return report.content;
    if (report.content instanceof Uint8Array) return Buffer.from(report.content);
    const chunks: Buffer[] = [];
    for await (const chunk of report.content) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  });
}
