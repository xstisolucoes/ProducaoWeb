import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProcessLabel } from "../../../server/firebirdProxy";
import { Printer, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PrintParameters = { printer: string; quantityPerPallet: string; copies: string };
type LocalPrinter = { name: string; isDefault: boolean; offline: boolean };

function brDateTime() {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date()).replace(",", " -");
}

export function ProcessLabelDialog({ open, onOpenChange, data, loading, error, printers, printerSource }: { open: boolean; onOpenChange: (open: boolean) => void; data?: ProcessLabel; loading: boolean; error: { message: string } | null; printers: LocalPrinter[]; printerSource?: "windows" | "unsupported" }) {
  const [preview, setPreview] = useState(false);
  const [parameters, setParameters] = useState<PrintParameters>({ printer: "", quantityPerPallet: "", copies: "1" });
  const labelPayload = data ? compactLabelPayload(data) : "";
  const availablePrinters = [...printers].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name, "pt-BR"));

  useEffect(() => {
    if (!open) { setPreview(false); setParameters({ printer: "", quantityPerPallet: "", copies: "1" }); }
  }, [open]);
  useEffect(() => {
    if (parameters.printer) return;
    const selected = availablePrinters.find((printer) => printer.isDefault && !printer.offline)?.name ?? availablePrinters.find((printer) => !printer.offline)?.name ?? data?.printerOptions[0] ?? "";
    if (selected) setParameters((current) => ({ ...current, printer: selected }));
  }, [availablePrinters, data?.printerOptions, parameters.printer]);

  const valid = Boolean(parameters.printer.trim()) && Number(parameters.quantityPerPallet) > 0 && Number(parameters.copies) > 0;
  const close = () => onOpenChange(false);
  const openPreview = () => { if (!valid) return toast.error("Informe a impressora, a quantidade por palete e as cópias."); setPreview(true); };
  const print = () => { window.print(); toast.success("Prévia enviada ao diálogo de impressão", { description: `Selecione ${parameters.printer} e confirme ${parameters.copies} cópia(s) no navegador.` }); };

  return <>
    <Dialog open={open && !preview} onOpenChange={(next) => !next && close()}>
      <DialogContent className="!w-[calc(100vw-1rem)] !max-w-3xl overflow-hidden border-2 border-[#d6e0d9] bg-[#fbfdfb] p-0 sm:!w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-[#e2eae4] bg-gradient-to-r from-[#f0f8f2] via-white to-[#fff8df] px-6 py-5"><DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#183e30]"><Tag className="h-6 w-6 text-[#177458]" />Etiqueta de Processo</DialogTitle><DialogDescription className="text-sm font-medium text-[#63756b]">Informe os parâmetros antes de gerar a etiqueta vertical do processo.</DialogDescription></DialogHeader>
        <div className="space-y-5 px-6 py-5">
          {loading ? <p className="rounded-xl border border-[#d7e3d9] bg-white p-5 text-base font-bold text-[#476152]">Carregando os dados da etiqueta…</p> : error ? <p className="rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-5 text-base font-bold text-[#9b2525]">{error.message}</p> : data ? <><div className="rounded-xl border border-[#d9e6dc] bg-white p-4"><p className="font-mono text-[10px] font-black uppercase tracking-[.15em] text-[#718277]">Processo selecionado</p><p className="mt-1 text-xl font-black text-[#214534]">OP {data.operationCode} · {data.currentProcess || "Processo não informado"}</p><p className="mt-1 text-sm font-bold text-[#64756b]">{data.customerName || "Cliente não informado"} · {data.reference || "Referência não informada"}</p></div>
            <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_145px_90px]"><label className="grid min-w-0 gap-2 text-sm font-black text-[#40564a]"><span>Impressora <b className="text-[#bb3434]">*</b></span>{availablePrinters.length ? <select value={parameters.printer} onChange={(event) => setParameters((current) => ({ ...current, printer: event.target.value }))} className="h-12 w-full rounded-md border-2 border-[#dbe5de] bg-white px-3 text-base font-bold text-[#294438] outline-none focus:border-[#177458]"><option value="">Selecione a impressora</option>{availablePrinters.map((printer) => <option key={printer.name} value={printer.name} disabled={printer.offline}>{printer.name}{printer.isDefault ? " (padrão)" : ""}{printer.offline ? " (offline)" : ""}</option>)}</select> : <Input list="process-label-printers" value={parameters.printer} onChange={(event) => setParameters((current) => ({ ...current, printer: event.target.value }))} placeholder="Digite a impressora" className="h-12 border-2 border-[#dbe5de] bg-white text-base font-bold" />}<datalist id="process-label-printers">{data.printerOptions.map((printer) => <option key={printer} value={printer} />)}</datalist><span className="text-xs font-medium leading-4 text-[#748178]">{printerSource === "windows" ? "Lista obtida das impressoras instaladas no Windows desta estação." : "A escolha será confirmada no diálogo do navegador."}</span></label><label className="grid min-w-0 gap-2 text-xs font-black text-[#40564a]"><span className="whitespace-nowrap">Qtde. por Palete <b className="text-[#bb3434]">*</b></span><Input inputMode="numeric" maxLength={5} value={parameters.quantityPerPallet} onChange={(event) => setParameters((current) => ({ ...current, quantityPerPallet: event.target.value.replace(/\D/g, "").slice(0, 5) }))} placeholder="0" className="h-12 w-full border-2 border-[#dbe5de] bg-white text-center font-mono text-lg font-black" /></label><label className="grid min-w-0 gap-2 text-xs font-black text-[#40564a]"><span>Cópias <b className="text-[#bb3434]">*</b></span><Input inputMode="numeric" maxLength={5} value={parameters.copies} onChange={(event) => setParameters((current) => ({ ...current, copies: event.target.value.replace(/\D/g, "").slice(0, 5) }))} placeholder="1" className="h-12 w-full border-2 border-[#dbe5de] bg-white text-center font-mono text-lg font-black" /></label></div></> : <p className="rounded-xl border border-[#d7e3d9] bg-white p-5 text-base font-bold text-[#476152]">Não foram encontrados dados para esta etiqueta.</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e2eae4] pt-5"><Button disabled={loading || Boolean(error) || !data || !valid} onClick={openPreview} className="h-12 bg-[#177458] px-5 text-base font-black hover:bg-[#105f45]"><Tag className="mr-2 h-5 w-5" />Visualizar etiqueta</Button><Button variant="outline" onClick={close} className="h-12 border-2 border-[#cf3f3f] bg-[#cf3f3f] px-5 text-base font-black text-white hover:bg-[#ad2e2e] hover:text-white">Fechar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={open && preview} onOpenChange={(next) => !next && setPreview(false)}>
      <DialogContent className="!flex !max-h-[96dvh] !w-[calc(100vw-1rem)] !max-w-[900px] !flex-col overflow-hidden border-2 border-[#1a4938] bg-[#f5f8f5] p-0 sm:!w-[calc(100vw-2rem)]"><DialogHeader className="border-b border-[#cbd9ce] bg-white px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><DialogTitle className="flex items-center gap-2 text-xl font-black text-[#183e30]"><Tag className="h-5 w-5 text-[#177458]" />Prévia da Etiqueta de Processo</DialogTitle><DialogDescription className="mt-1 text-xs font-bold text-[#62756a]">Papel 14,5 × 21 cm · Impressora: {parameters.printer} · Cópias: {parameters.copies}</DialogDescription></div><div className="flex gap-2"><Button onClick={() => setPreview(false)} variant="outline" className="h-10 border-[#b4c6b9] bg-white font-black text-[#315743]">Voltar</Button><Button onClick={print} className="h-10 bg-[#177458] font-black hover:bg-[#105f45]"><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button></div></div></DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-[#e7ede8] p-5"><style>{`@media print { @page { size: 145mm 210mm; margin: 42mm 5mm 5mm; } body * { visibility: hidden !important; } #process-label-print, #process-label-print * { visibility: visible !important; } #process-label-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 135mm !important; min-height: 163mm !important; box-shadow: none !important; } }`}</style>{data ? <ProcessLabelSheet data={data} parameters={parameters} qrPayload={labelPayload} /> : null}</div>
      </DialogContent>
    </Dialog>
  </>;
}

function ProcessLabelSheet({ data, parameters, qrPayload }: { data: ProcessLabel; parameters: PrintParameters; qrPayload: string }) {
  return <article id="process-label-print" className="mx-auto grid w-[135mm] min-h-[163mm] grid-rows-[auto_auto_auto_auto_auto_auto_auto_1fr] overflow-hidden bg-white font-sans text-black shadow-xl print:shadow-none"><header className="grid grid-cols-[42mm_1fr_34mm] items-center border border-black px-3 py-2"><div className="min-h-9">{data.companyLogoDataUri ? <img src={data.companyLogoDataUri} alt={data.companyName || "Logomarca da empresa"} className="max-h-9 max-w-[40mm] object-contain object-left" /> : <strong className="text-xl font-black italic text-[#124b36]">{data.companyName || "Empresa"}</strong>}</div><span className="text-center text-sm font-bold">{data.companyName || ""}</span><span className="text-right text-sm font-bold">Data: {brDateTime()}</span></header><h1 className="border-x border-b border-black bg-black px-3 py-2 text-center text-[26px] font-black tracking-wide text-white">MATERIAL EM PROCESSO</h1><section className="border-x border-b border-black p-2"><LabelCaption title="Cliente" value={data.customerName} className="text-2xl" /></section><section className="grid grid-cols-[1.05fr_.85fr_1fr] border-x border-b border-black"><LabelCaption title="Produto" value={`${data.productCode} - ${data.revision}`} className="border-r border-black text-xl" /><LabelCaption title="Junta Fechamento / LAP" value={data.jointPosition} className="border-r border-black text-xl" /><LabelCaption title="Resina" value={data.resin} className="text-2xl font-black" /></section><section className="border-x border-b border-black p-2"><LabelCaption title="Cód. Prod. Cliente / Referência" value={data.reference} className="min-h-16 text-2xl leading-tight" /></section><section className="border-x border-b border-black p-2"><LabelCaption title="Processo Atual" value={data.currentProcess} className="text-2xl font-black" /></section><section className="border-x border-b border-black p-2"><LabelCaption title="Operador" value={data.operatorName} className="text-xl" /><LabelCaption title="Próximo Processo" value={data.nextProcess} className="mt-2 text-xl" /></section><section className="border-x border-b border-black px-3 py-2 text-[25px] font-black">Quantidade por Palete: <span className="font-mono">{parameters.quantityPerPallet}</span></section><section className="grid min-h-[58mm] grid-cols-[1fr_34mm] border-x border-b border-black"><div className="flex items-end gap-3 p-3"><span className="mb-4 text-base font-bold">OP. (Lote):</span><span className="font-mono text-[68px] font-black leading-none tracking-[-.08em]">{data.operationCode}</span></div><div className="flex flex-col items-center justify-center border-l border-black p-2"><LocalQrCode payload={qrPayload} /><span className="mt-1 text-center text-[9px] font-bold">{parameters.printer}</span></div></section></article>;
}

function LabelCaption({ title, value, className = "" }: { title: string; value: string | number | null; className?: string }) { return <div className={`p-2 ${className}`}><p className="text-[11px] font-bold leading-none">{title}:</p><p className="mt-1 break-words font-medium">{value || "—"}</p></div>; }

function compactLabelPayload(data: ProcessLabel) { return `OP${data.operationCode}P${data.productCode}R${data.revision}`.slice(0, 17); }

function LocalQrCode({ payload }: { payload: string }) {
  const matrix = qrVersion1Low(payload);
  return <svg role="img" aria-label="QR Code da etiqueta" viewBox="0 0 21 21" shapeRendering="crispEdges" className="w-full bg-white">{matrix.map((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111" /> : null))}</svg>;
}

function qrVersion1Low(text: string) {
  const size = 21;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));
  const set = (x: number, y: number, value: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) modules[y]![x] = value; };
  const finder = (cx: number, cy: number) => { for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) { const dist = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, dist !== 2 && dist !== 4); } };
  finder(3, 3); finder(17, 3); finder(3, 17);
  for (let i = 8; i < size - 8; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  set(8, 13, true);
  const bytes = Array.from(text).map((character) => character.charCodeAt(0) & 0xFF).slice(0, 17);
  const data = qrDataCodewords(bytes);
  const ecc = qrEcc(data, 7);
  const codewords = [...data, ...ecc];
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const y = upward ? size - 1 - step : step;
      for (let side = 0; side < 2; side += 1) {
        const x = right - side;
        if (modules[y]![x] !== null) continue;
        const bit = bitIndex < codewords.length * 8 ? ((codewords[Math.floor(bitIndex / 8)]! >>> (7 - bitIndex % 8)) & 1) === 1 : false;
        modules[y]![x] = (x + y) % 2 === 0 ? !bit : bit;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  const format = qrFormatBits(1 << 3);
  const formatBit = (index: number) => ((format >>> index) & 1) === 1;
  for (let i = 0; i <= 5; i += 1) set(8, i, formatBit(i));
  set(8, 7, formatBit(6)); set(8, 8, formatBit(7)); set(7, 8, formatBit(8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, formatBit(i));
  return modules.map((row) => row.map(Boolean));
}

function qrDataCodewords(bytes: number[]) {
  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1); };
  push(0b0100, 4); push(bytes.length, 8); bytes.forEach((byte) => push(byte, 8));
  push(0, Math.min(4, 152 - bits.length)); while (bits.length % 8) bits.push(0);
  const words: number[] = []; for (let index = 0; index < bits.length; index += 8) words.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let index = 0; words.length < 19; index += 1) words.push(index % 2 === 0 ? 0xEC : 0x11);
  return words;
}

function qrEcc(data: number[], degree: number) {
  const divisor = qrDivisor(degree); const result = Array<number>(degree).fill(0);
  for (const byte of data) { const factor = byte ^ result.shift()!; result.push(0); for (let index = 0; index < degree; index += 1) result[index] = result[index]! ^ qrMultiply(divisor[index]!, factor); }
  return result;
}

function qrDivisor(degree: number) {
  const result = Array<number>(degree).fill(0); result[degree - 1] = 1; let root = 1;
  for (let index = 0; index < degree; index += 1) { for (let column = 0; column < degree; column += 1) { result[column] = qrMultiply(result[column]!, root); if (column + 1 < degree) result[column] = result[column]! ^ result[column + 1]!; } root = qrMultiply(root, 2); }
  return result;
}

function qrMultiply(left: number, right: number) { let result = 0; for (let factor = left, value = right; value; value >>>= 1) { if (value & 1) result ^= factor; factor = (factor << 1) ^ ((factor >>> 7) * 0x11D); } return result; }
function qrFormatBits(data: number) { let value = data << 10; for (let bit = 14; bit >= 10; bit -= 1) if (((value >>> bit) & 1) !== 0) value ^= 0x537 << (bit - 10); return ((data << 10) | value) ^ 0x5412; }
