import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import type { ProcessLabel } from "./firebirdProxy";

const require = createRequire(import.meta.url);
type JsreportInstance = { init: () => Promise<unknown>; render: (request: Record<string, unknown>) => Promise<{ content: NodeJS.ReadableStream }> };
const jsreport = require("jsreport") as (configuration: Record<string, unknown>) => JsreportInstance;
const QRCode = require("qrcode") as { toDataURL: (text: string, options: Record<string, unknown>) => Promise<string> };

let jsreportInstance: JsreportInstance | null = null;

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
  const qrPayload = `OP${label.operationCode}`;
  const qrCode = await QRCode.toDataURL(qrPayload, { margin: 0, width: 330, errorCorrectionLevel: "M" });
  const logo = label.companyLogoDataUri ? `<img class="logo" src="${label.companyLogoDataUri}" alt="Logo" />` : `<strong class="company-brand">${safe(label.companyName)}</strong>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: 145mm 210mm; margin: 0; }
    * { box-sizing: border-box; } html,body { margin:0; width:145mm; height:210mm; background:#fff; color:#000; font-family:Arial,Helvetica,sans-serif; }
    .page { position:relative; width:145mm; height:210mm; padding:40mm 5mm 5mm; overflow:hidden; }
    .fold { position:absolute; top:37.5mm; left:5mm; right:5mm; border-top:.35mm solid #000; text-align:center; height:0; } .fold span { position:relative; top:-2.5mm; display:inline-block; padding:0 2mm; background:#fff; font:7pt Arial,Helvetica,sans-serif; }
    .page-number { position:absolute; top:205.5mm; right:5mm; font:7pt Arial,Helvetica,sans-serif; }
    .label { height:165mm; overflow:hidden; border:0.35mm solid #000; display:grid; grid-template-rows:15mm 13mm 14mm 15mm 16mm 14mm 23mm 12mm 43mm; break-inside:avoid; page-break-inside:avoid; }
    .top { display:grid; grid-template-columns:42mm 1fr 35mm; align-items:center; padding:2mm 3mm; border-bottom:0.35mm solid #000; }
    .logo { max-width:39mm; max-height:10mm; object-fit:contain; object-position:left center; } .company-brand { font-family:"Arial Black",Arial,sans-serif; font-size:16pt; }
    .top-center { text-align:center; font-family:"Arial Black",Arial,sans-serif; font-size:12pt; } .date { text-align:right; font-family:"Arial Black",Arial,sans-serif; font-size:9pt; line-height:1.25; }
    .title { margin:0; min-height:0; background:#000; color:#fff; text-align:center; padding:3mm; font-family:"Arial Black",Arial,sans-serif; font-size:20pt; letter-spacing:.4mm; }
    .box { min-height:0; padding:2.1mm; overflow:hidden; border-top:.35mm solid #000; } .three { display:grid; grid-template-columns:1.05fr .85fr 1fr; } .three .box:not(:last-child){border-right:.35mm solid #000;}
    .caption { margin:0; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:8pt; } .value { margin:1.2mm 0 0; font-family:Arial,Helvetica,sans-serif; font-size:15pt; line-height:1.12; font-weight:400; } .value.strong { font-family:"Arial Black",Arial,sans-serif; font-weight:900; }
    .reference,.process,.operator { min-height:0; } .pallet { font-family:"Arial Black",Arial,sans-serif; font-size:18pt; padding:2.5mm; overflow:hidden; border-top:.35mm solid #000; }
    .bottom { min-height:0; display:grid; grid-template-columns:1fr 35mm; border-top:.35mm solid #000; } .op { display:flex; align-items:flex-end; gap:3mm; padding:3mm; } .op-label { margin-bottom:3mm; font-size:11pt; font-weight:700; } .op-number { font-family:"Arial Black",Arial,sans-serif; font-size:43pt; font-weight:900; letter-spacing:-1mm; line-height:.92; }
    .qr { border-left:.35mm solid #000; display:flex; align-items:center; justify-content:center; padding:2.5mm; } .qr img { width:29mm; height:29mm; object-fit:contain; }
  </style></head><body><main class="page"><div class="fold"><span>Dobre aqui</span></div><section class="label"><header class="top"><div>${logo}</div><div class="top-center">${safe(label.currentProcess)}</div><div class="date">Data: ${safe(formatDateTime())}</div></header><h1 class="title">MATERIAL EM PROCESSO</h1>
  <section class="box"><p class="caption">Cliente:</p><p class="value">${safe(label.customerName)}</p></section>
  <section class="three"><div class="box"><p class="caption">Produto:</p><p class="value">${safe(label.productCode)} - ${safe(label.revision)}</p></div><div class="box"><p class="caption">Junta Fechamento / LAP:</p><p class="value strong">${safe(label.jointPosition)}</p></div><div class="box"><p class="caption">Resina:</p><p class="value strong">${safe(label.resin)}</p></div></section>
  <section class="box reference"><p class="caption">Cód. Prod. Cliente / Referência:</p><p class="value">${safe(label.reference)}</p></section>
  <section class="box process"><p class="caption">Processo Atual:</p><p class="value strong">${safe(label.currentProcess)}</p></section>
  <section class="box operator"><p class="caption">Operador:</p><p class="value">${safe(label.operatorName)}</p><p class="caption" style="margin-top:3mm">Próximo Processo:</p><p class="value">${safe(label.nextProcess)}</p></section>
  <section class="pallet">Quantidade por Palete: <span style="font-family:Arial,Helvetica,sans-serif;font-weight:400">${input.quantityPerPallet}</span></section>
  <section class="bottom"><div class="op"><span class="op-label">OP. (Lote):</span><span class="op-number">${safe(label.operationCode)}</span></div><div class="qr"><img src="${qrCode}" alt="${qrPayload}" /></div></section>
  </section><div class="page-number">Página 01</div></main></body></html>`;
  const report = await (await getJsreport()).render({ template: { recipe: "chrome-pdf", engine: "none", content: html }, options: { preview: false } });
  if (Buffer.isBuffer(report.content)) return report.content;
  if (report.content instanceof Uint8Array) return Buffer.from(report.content);

  const chunks: Buffer[] = [];
  for await (const chunk of report.content) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
