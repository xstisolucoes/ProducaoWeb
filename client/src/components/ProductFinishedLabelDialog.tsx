import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { ProductFinishedLabel } from "../../../server/firebirdProxy";
import { Printer, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type LocalPrinter = { name: string; isDefault: boolean; offline: boolean };
type PrintParameters = { printer: string; palletQuantity: string; copies: string };

export function ProductFinishedLabelDialog({ open, onOpenChange, data, loading, error, printers, printerSource, opCodigo, mpCodigo }: { open: boolean; onOpenChange: (open: boolean) => void; data?: ProductFinishedLabel; loading: boolean; error: { message: string } | null; printers: LocalPrinter[]; printerSource?: "windows" | "unsupported"; opCodigo: number; mpCodigo: number }) {
  const [preview, setPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [parameters, setParameters] = useState<PrintParameters>({ printer: "", palletQuantity: "1", copies: "1" });
  const previewPdf = trpc.production.pointing.previewProductFinishedLabel.useMutation();
  const directPrint = trpc.production.pointing.printProductFinishedLabel.useMutation();
  const availablePrinters = useMemo(() => [...printers].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name, "pt-BR")), [printers]);

  useEffect(() => {
    if (!open) { setPreview(false); setPreviewPdfUrl(""); setParameters({ printer: "", palletQuantity: "1", copies: "1" }); }
  }, [open]);

  useEffect(() => {
    if (parameters.printer) return;
    const selected = availablePrinters.find((printer) => printer.isDefault && !printer.offline)?.name ?? availablePrinters.find((printer) => !printer.offline)?.name ?? data?.printerOptions[0] ?? "";
    if (selected) setParameters((current) => ({ ...current, printer: selected }));
  }, [availablePrinters, data?.printerOptions, parameters.printer]);

  const palletQuantity = Number(parameters.palletQuantity);
  const copies = Number(parameters.copies);
  const valid = Boolean(parameters.printer.trim()) && Number.isInteger(palletQuantity) && palletQuantity > 0 && palletQuantity <= 999 && Number.isInteger(copies) && copies > 0 && copies <= 99;
  const close = () => onOpenChange(false);
  const openPreview = async () => {
    if (!valid) return toast.error("Informe a impressora, os paletes e as cópias.");
    try {
      const result = await previewPdf.mutateAsync({ opCodigo, mpCodigo, palletQuantity });
      setPreviewPdfUrl(result.pdfDataUrl);
      setPreview(true);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Não foi possível gerar a prévia PDF."); }
  };
  const print = async () => {
    if (!valid) return;
    try {
      await directPrint.mutateAsync({ opCodigo, mpCodigo, printer: parameters.printer, copies, palletQuantity });
      toast.success("Etiqueta PA enviada à impressora", { description: `${palletQuantity} palete(s) × ${copies} cópia(s) para ${parameters.printer}.` });
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Não foi possível enviar a etiqueta à impressora."); }
  };

  return <>
    <Dialog open={open && !preview} onOpenChange={(next) => !next && close()}>
      <DialogContent className="!w-[calc(100vw-1rem)] !max-w-3xl overflow-hidden border-2 border-[#d6e0d9] bg-[#fbfdfb] p-0 sm:!w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-[#e2eae4] bg-gradient-to-r from-[#f0f8f2] via-white to-[#fff8df] px-6 py-5"><DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#183e30]"><Tag className="h-6 w-6 text-[#177458]" />Etiqueta de Produto Acabado</DialogTitle><DialogDescription className="text-sm font-medium text-[#63756b]">Identificação de Produto conforme o modelo legado, com uma página para cada palete informado.</DialogDescription></DialogHeader>
        <div className="space-y-5 px-6 py-5">
          {loading ? <p className="rounded-xl border border-[#d7e3d9] bg-white p-5 text-base font-bold text-[#476152]">Consultando o estoque acabado da OP…</p> : error ? <p className="rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-5 text-base font-bold text-[#9b2525]">{error.message}</p> : data ? <><div className="grid gap-3 rounded-xl border border-[#d9e6dc] bg-white p-4 md:grid-cols-[1fr_auto]"><div><p className="font-mono text-[10px] font-black uppercase tracking-[.15em] text-[#718277]">Estoque acabado selecionado</p><p className="mt-1 text-xl font-black text-[#214534]">OP {data.operationCode} · Produto {data.productCode}-{data.revision}</p><p className="mt-1 text-sm font-bold text-[#64756b]">{data.customerName || "Cliente não informado"} · {data.reference || "Referência não informada"}</p></div><div className="rounded-lg bg-[#edf8f0] px-4 py-3 text-right"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-[#537564]">Saldo em estoque</span><strong className="mt-1 block font-mono text-2xl text-[#1b704d]">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(data.stockQuantity)}</strong><span className="mt-1 block text-xs font-bold text-[#5c7568]">Por palete: {data.quantityPerPallet ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(data.quantityPerPallet) : "não informado"}</span></div></div>
            <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_112px_90px]"><label className="grid min-w-0 gap-2 text-sm font-black text-[#40564a]"><span>Impressora <b className="text-[#bb3434]">*</b></span>{availablePrinters.length ? <select value={parameters.printer} onChange={(event) => setParameters((current) => ({ ...current, printer: event.target.value }))} className="h-12 w-full rounded-md border-2 border-[#dbe5de] bg-white px-3 text-base font-bold text-[#294438] outline-none focus:border-[#177458]"><option value="">Selecione a impressora</option>{availablePrinters.map((printer) => <option key={printer.name} value={printer.name} disabled={printer.offline}>{printer.name}{printer.isDefault ? " (padrão)" : ""}{printer.offline ? " (offline)" : ""}</option>)}</select> : <Input list="product-finished-label-printers" value={parameters.printer} onChange={(event) => setParameters((current) => ({ ...current, printer: event.target.value }))} placeholder="Digite a impressora" className="h-12 border-2 border-[#dbe5de] bg-white text-base font-bold" />}<datalist id="product-finished-label-printers">{data.printerOptions.map((printer) => <option key={printer} value={printer} />)}</datalist><span className="text-xs font-medium leading-4 text-[#748178]">{printerSource === "windows" ? "A etiqueta será enviada diretamente à impressora Windows selecionada." : "Não foi encontrada uma impressora Windows disponível nesta Máquina/Processo."}</span></label><label className="grid min-w-0 gap-2 text-xs font-black text-[#40564a]"><span>Paletes <b className="text-[#bb3434]">*</b></span><Input inputMode="numeric" maxLength={3} value={parameters.palletQuantity} onChange={(event) => setParameters((current) => ({ ...current, palletQuantity: event.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="1" className="h-12 w-full border-2 border-[#dbe5de] bg-white text-center font-mono text-lg font-black" /></label><label className="grid min-w-0 gap-2 text-xs font-black text-[#40564a]"><span>Cópias <b className="text-[#bb3434]">*</b></span><Input inputMode="numeric" maxLength={2} value={parameters.copies} onChange={(event) => setParameters((current) => ({ ...current, copies: event.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="1" className="h-12 w-full border-2 border-[#dbe5de] bg-white text-center font-mono text-lg font-black" /></label></div></> : <p className="rounded-xl border border-[#d7e3d9] bg-white p-5 text-base font-bold text-[#476152]">Não foram encontrados dados para a Etiqueta PA.</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e2eae4] pt-5"><Button disabled={loading || Boolean(error) || !data || !valid || previewPdf.isPending} onClick={openPreview} className="h-12 bg-[#177458] px-5 text-base font-black hover:bg-[#105f45]"><Tag className="mr-2 h-5 w-5" />{previewPdf.isPending ? "Gerando PDF…" : "Visualizar etiqueta"}</Button><Button variant="outline" onClick={close} className="h-12 border-2 border-[#cf3f3f] bg-[#cf3f3f] px-5 text-base font-black text-white hover:bg-[#ad2e2e] hover:text-white">Fechar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={open && preview} onOpenChange={(next) => !next && setPreview(false)}>
      <DialogContent className="!flex !max-h-[96dvh] !w-[calc(100vw-1rem)] !max-w-[960px] !flex-col overflow-hidden border-2 border-[#1a4938] bg-[#f5f8f5] p-0 sm:!w-[calc(100vw-2rem)]"><DialogHeader className="border-b border-[#cbd9ce] bg-white px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><DialogTitle className="flex items-center gap-2 text-xl font-black text-[#183e30]"><Tag className="h-5 w-5 text-[#177458]" />Prévia da Etiqueta de Produto Acabado</DialogTitle><DialogDescription className="mt-1 text-xs font-bold text-[#62756a]">PDF final · Papel A4 · {palletQuantity} palete(s)</DialogDescription></div><div className="flex gap-2"><Button onClick={() => setPreview(false)} variant="outline" className="h-10 border-[#b4c6b9] bg-white font-black text-[#315743]">Voltar</Button><Button disabled={directPrint.isPending || !valid} onClick={print} className="h-10 bg-[#177458] font-black hover:bg-[#105f45]"><Printer className="mr-1.5 h-4 w-4" />{directPrint.isPending ? "Enviando…" : "Imprimir"}</Button></div></div></DialogHeader><div className="min-h-0 flex-1 overflow-auto bg-[#e7ede8] p-5">{previewPdfUrl ? <iframe title="Prévia PDF da Etiqueta de Produto Acabado" src={previewPdfUrl} className="mx-auto h-[78dvh] w-full max-w-[820px] border-0 bg-white shadow-xl" /> : null}</div></DialogContent>
    </Dialog>
  </>;
}
