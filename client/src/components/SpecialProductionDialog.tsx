import type { SpecialProduction } from "../../../server/firebirdProxy";
import { Layers3 } from "lucide-react";
import { SortableHeader, useGridSort } from "@/components/ProductionPrimitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: SpecialProduction;
  loading?: boolean;
  error?: { message: string } | null;
};

export function SpecialProductionDialog({ open, onOpenChange, data, loading = false, error }: Props) {
  const title = data?.primaryOpCode ? `OPs que compõem a OP: ${data.primaryOpCode}` : "OPs do Conjunto";
  const { sortedItems, sortKey, sortDirection, toggleSort } = useGridSort(data?.components);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onPointerDownOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()} className="!w-[calc(100vw-1.5rem)] !max-w-[1240px] border-2 border-[#d8bd59] bg-[#fffef9] p-0">
      <DialogHeader className="border-b-2 border-[#e7d696] bg-[linear-gradient(100deg,#fff0b8,#fffdf6_55%,#f9e7a4)] px-5 py-4 text-left sm:px-6">
        <DialogTitle className="flex items-center gap-3 text-xl font-black text-[#574212]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a8750d] text-white"><Layers3 className="h-5 w-5" /></span>Conjunto Especial</DialogTitle>
        <DialogDescription className="mt-1 font-bold text-[#816a29]">{title}. Estas OPs são apontadas junto da OP principal.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60dvh] overflow-auto p-4 sm:p-5">
        {loading ? <p className="rounded-xl border border-[#e0c86d] bg-[#fffdf5] px-4 py-3 text-sm font-bold text-[#716024]">Consultando as OPs do conjunto…</p> : error ? <p className="rounded-xl border border-[#dca2a2] bg-[#fff4f4] px-4 py-3 text-sm font-bold text-[#9d3535]">Não foi possível consultar o conjunto: {error.message}</p> : !data?.isSpecial ? <p className="rounded-xl border border-[#e2d8b2] bg-[#fffdf7] px-4 py-3 text-sm font-bold text-[#766535]">Esta OP não possui conjunto especial.</p> : <div className="overflow-x-auto rounded-xl border-2 border-[#e5d69e]"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-[#fff7dc] text-[10px] font-black uppercase tracking-[.1em] text-[#7a6831]"><tr><SortableHeader label="OP" column="opCode" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Produto" column="product" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Revisão" column="revision" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Referencial" column="reference" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Código do produto" column="customerProductCode" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Cliente" column="client" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /></tr></thead><tbody className="divide-y divide-[#eee3ba]">{sortedItems.map((item) => <tr key={`${item.opCode}-${item.mpCode}`} className="bg-white/80"><td className="px-4 py-3 font-mono text-sm font-black text-[#5c4817]">{item.opCode}</td><td className="px-4 py-3 font-bold text-[#3f4f44]">{item.product || item.productCode || "—"}</td><td className="px-4 py-3 font-mono font-bold text-[#4a5d51]">{item.revision ?? "—"}</td><td className="px-4 py-3 font-medium text-[#596755]">{item.reference || "—"}</td><td className="px-4 py-3 font-mono font-bold text-[#4a5d51]">{item.customerProductCode || "—"}</td><td className="px-4 py-3 font-semibold text-[#4b594e]">{item.client || "—"}</td></tr>)}</tbody></table></div>}
      </div>
      <div className="border-t border-[#eadcaa] bg-[#fffdf6] px-5 py-4 text-right"><Button onClick={() => onOpenChange(false)} className="h-11 bg-[#b52828] px-6 font-black text-white hover:bg-[#951a1a]">Fechar</Button></div>
    </DialogContent>
  </Dialog>;
}
