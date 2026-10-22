export type ProcessLabelData = {
  operationCode: number;
  productCode: number;
  revision: number;
  customerName: string | null;
  orderedQuantity: number | null;
  reference: string | null;
  currentProcess: string | null;
  nextProcess: string | null;
  operatorName: string | null;
  jointPosition: string | null;
  resin: string | null;
  companyName: string | null;
  companyLogoDataUri: string | null;
};

export type ProductFinishedLabelData = {
  stockCode: number;
  operationCode: number;
  productCode: number;
  revision: number;
  customerLegalName: string | null;
  customerName: string | null;
  reference: string | null;
  stockQuantity: number;
  lot: string | null;
  manufacturingDate: string | null;
  internalMeasures: string | null;
  quantityPerPallet: number | null;
  companyName: string | null;
  companyLogoDataUri: string | null;
};

export function safeHtml(value: string | number | null | undefined): string {
  return String(value ?? "—").replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!
  );
}

export function formatProcessDateTime(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date())
    .replace(",", " -");
}

export function formatLabelDate(value: string | null): string {
  if (!value) return "—";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(parsed);
}

export function formatQuantity(value: number | null | undefined): string {
  const quantity = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    Number.isFinite(quantity) ? quantity : 0
  );
}

export function buildProcessLabelHtml(
  label: ProcessLabelData,
  quantityPerPallet: number,
  qrCodeDataUri: string
): string {
  const qrPayload = `OP${label.operationCode}`;
  const logo = label.companyLogoDataUri
    ? `<img class="logo" src="${label.companyLogoDataUri}" alt="Logo" />`
    : `<strong class="company-brand">${safeHtml(label.companyName)}</strong>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Etiqueta de Processo OP ${safeHtml(label.operationCode)}</title><style>
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
  </style></head><body><main class="page"><div class="fold"><span>Dobre aqui</span></div><section class="label"><header class="top"><div>${logo}</div><div class="top-center">${safeHtml(label.currentProcess)}</div><div class="date">Data: ${safeHtml(formatProcessDateTime())}</div></header><h1 class="title">MATERIAL EM PROCESSO</h1>
  <section class="box"><p class="caption">Cliente:</p><p class="value">${safeHtml(label.customerName)}</p></section>
  <section class="three"><div class="box"><p class="caption">Produto:</p><p class="value">${safeHtml(label.productCode)} - ${safeHtml(label.revision)}</p></div><div class="box"><p class="caption">Junta Fechamento / LAP:</p><p class="value strong">${safeHtml(label.jointPosition)}</p></div><div class="box"><p class="caption">Resina:</p><p class="value strong">${safeHtml(label.resin)}</p></div></section>
  <section class="box reference"><p class="caption">Cód. Prod. Cliente / Referência:</p><p class="value">${safeHtml(label.reference)}</p></section>
  <section class="box process"><p class="caption">Processo Atual:</p><p class="value strong">${safeHtml(label.currentProcess)}</p></section>
  <section class="box operator"><p class="caption">Operador:</p><p class="value">${safeHtml(label.operatorName)}</p><p class="caption" style="margin-top:3mm">Próximo Processo:</p><p class="value">${safeHtml(label.nextProcess)}</p></section>
  <section class="pallet">Quantidade por Palete: <span style="font-family:Arial,Helvetica,sans-serif;font-weight:400">${quantityPerPallet}</span></section>
  <section class="bottom"><div class="op"><span class="op-label">OP. (Lote):</span><span class="op-number">${safeHtml(label.operationCode)}</span></div><div class="qr"><img src="${qrCodeDataUri}" alt="${qrPayload}" /></div></section>
  </section><div class="page-number">Página 01</div></main></body></html>`;
}

export function buildProductFinishedLabelHtml(
  label: ProductFinishedLabelData,
  palletQuantity: number,
  qrCodeDataUri: string
): string {
  const totalPallets = Math.max(1, Math.min(999, Math.floor(palletQuantity)));
  const qrPayload = String(label.productCode);
  const logo = label.companyLogoDataUri
    ? `<img class="logo" src="${label.companyLogoDataUri}" alt="Logo" />`
    : `<strong class="company-brand">${safeHtml(label.companyName)}</strong>`;

  const pages = Array.from({ length: totalPallets }, (_, index) => {
    const pallet = index + 1;
    return `<main class="product-page"><section class="label"><header class="top"><div class="logo-wrap">${logo}</div><h1>Identificação de Produto</h1></header>
      <section class="field legal"><p class="caption">Razão Social:</p><p class="value medium">${safeHtml(label.customerLegalName)}</p></section>
      <section class="field client"><p class="caption">Cliente:</p><p class="value large">${safeHtml(label.customerName)}</p></section>
      <section class="field reference"><p class="caption">Cód. Prod. Cliente / Referência:</p><p class="value reference-value">${safeHtml(label.reference)}</p></section>
      <section class="stats"><div class="field"><p class="caption">Produto:</p><p class="value stat-value">${safeHtml(label.productCode)}-${safeHtml(label.revision)}</p></div><div class="field"><p class="caption">Quantidade do Estoque:</p><p class="value stock-value">${safeHtml(formatQuantity(label.stockQuantity))}</p></div><div class="field"><p class="caption">Quantidade por Palete:</p><p class="value stock-value">${safeHtml(label.quantityPerPallet == null || label.quantityPerPallet <= 0 ? "—" : formatQuantity(label.quantityPerPallet))}</p></div><div class="field pallet"><p class="caption">Palete:</p><p class="value pallet-value">${pallet}/${totalPallets}</p></div></section>
      <section class="details"><p><strong>Validade:</strong> 03 Anos</p><p><strong>Condições de Armazenamento:</strong> Em ambiente seco, ao abrigo de contato com água, em local ventilado, com proteção contra danos e insetos, com controle de pragas.</p></section>
      <section class="inspection"><p class="caption inspection-title">Inspeção do Controle<br/>da Qualidade:</p><span class="check"></span><span class="check-label">Aprovado</span><span class="check"></span><span class="check-label">Quarentena</span><span class="check"></span><span class="check-label">Reprovado</span><span class="signature"></span><span class="signature-label">Responsável</span><img class="qr" src="${qrCodeDataUri}" alt="${safeHtml(qrPayload)}" /></section>
      <section class="stock-out"><strong>Baixa do Estoque:</strong></section>
      <section class="stock-fields"><div><strong>Data:</strong></div><div><strong>Quantidade:</strong></div><div><strong>Saldo:</strong></div></section>
      <section class="bottom"><div><p class="caption">OP / (Lote):</p><p class="op-value">${safeHtml(label.lot || label.operationCode)}</p></div><div><p class="caption">Fabricação:</p><p class="date-value">${safeHtml(formatLabelDate(label.manufacturingDate))}</p></div></section>
      <footer><span>${safeHtml(label.internalMeasures)}</span><span>FOR-394 Rev: 01</span><span>Página ${String(pallet).padStart(2, "0")}</span></footer>
    </section></main>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Identificação de Produto - OP ${safeHtml(label.operationCode)}</title><style>
    @page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; } html, body { margin: 0; background: #fff; color:#000; font-family: Arial, Helvetica, sans-serif; }
    .product-page { width:210mm; height:297mm; padding:55mm 5mm 5mm; page-break-after:always; overflow:hidden; } .product-page:last-child { page-break-after:auto; }
    .label { width:200mm; height:226mm; border:.35mm solid #000; display:grid; grid-template-rows:18mm 16mm 23mm 31mm 27mm 20mm 18mm 6mm 21mm 40mm 6mm; overflow:hidden; }
    .top { display:grid; grid-template-columns:48mm 1fr; align-items:center; border-bottom:.35mm solid #000; padding:2mm 3mm; } .logo-wrap { display:flex; align-items:center; } .logo { max-height:12mm; max-width:42mm; object-fit:contain; object-position:left center; } .company-brand { font:700 14pt Arial,Helvetica,sans-serif; } h1 { margin:0; text-align:center; font:900 26pt "Arial Black",Arial,sans-serif; line-height:1; }
    .field { min-width:0; overflow:hidden; padding:1.1mm 1.4mm; border-bottom:.35mm solid #000; } .caption { margin:0; font-size:10pt; font-weight:700; line-height:1.05; } .value { margin:1mm 0 0; font-weight:700; line-height:1.03; overflow-wrap:anywhere; } .medium { font-size:24pt; } .large { font-size:42pt; } .reference-value { font-size:48pt; white-space:nowrap; } .stats { display:grid; grid-template-columns:1.2fr 1.15fr 1.05fr .72fr; } .stats .field { border-right:.35mm solid #000; border-bottom:.35mm solid #000; } .stats .field:last-child { border-right:0; } .stat-value { font:900 28pt/1 "Arial Black",Arial,sans-serif; text-align:center; white-space:nowrap; } .stock-value { font:900 48pt/.92 "Arial Black",Arial,sans-serif; text-align:center; white-space:nowrap; } .pallet-value { font:900 36pt/.95 "Arial Black",Arial,sans-serif; text-align:center; }
    .details { border-bottom:.35mm solid #000; padding:1.3mm; font-size:10pt; line-height:1.08; } .details p { margin:.25mm 0; } .inspection { position:relative; display:grid; grid-template-columns:32mm 5mm 27mm 5mm 27mm 5mm 27mm 1fr; align-items:center; gap:1mm; padding:1mm 1.4mm; border-bottom:.35mm solid #000; } .inspection-title { font-size:10pt; } .check { height:4mm; width:4mm; border:.35mm solid #000; } .check-label { font-size:10pt; font-weight:700; } .signature { position:absolute; left:135mm; right:23mm; bottom:4mm; border-bottom:.35mm solid #000; } .signature-label { position:absolute; right:22mm; bottom:1mm; width:40mm; text-align:center; font-size:8pt; font-weight:700; } .qr { position:absolute; right:1mm; top:1mm; width:18mm; height:18mm; }
    .stock-out { padding:1mm 1.4mm; border-bottom:.35mm solid #000; font-size:10pt; } .stock-fields { display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:.35mm solid #000; } .stock-fields div { padding:1.5mm; border-right:.35mm solid #000; font-size:10pt; } .stock-fields div:last-child { border-right:0; } .bottom { display:grid; grid-template-columns:1fr 1.15fr; } .bottom div { padding:1.5mm; border-right:.35mm solid #000; overflow:hidden; } .bottom div:last-child { border-right:0; } .op-value { margin:2mm 0 0; font:900 68pt/.9 "Arial Black",Arial,sans-serif; letter-spacing:-1mm; } .date-value { margin:5mm 0 0; font:900 50pt/.92 "Arial Black",Arial,sans-serif; white-space:nowrap; } footer { display:flex; justify-content:space-between; align-items:center; padding:0 2mm; border-top:.25mm solid #000; font-size:5.5pt; color:#333; }
  </style></head><body>${pages}</body></html>`;
}
