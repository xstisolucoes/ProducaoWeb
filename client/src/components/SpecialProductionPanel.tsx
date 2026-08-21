import type { SpecialProduction } from "../../../server/firebirdProxy";
import { Boxes, Layers3 } from "lucide-react";
import { SortableHeader, useGridSort } from "@/components/ProductionPrimitives";

function quantity(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value ?? 0));
}

function statusTone(status: string | null | undefined) {
  const value = String(status ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (value === "ATENDIDO") return "bg-[#dff3e7] text-[#176a42] border-[#8ac9a4]";
  if (value === "EM PRODUCAO") return "bg-[#fff3c9] text-[#8b5b00] border-[#e4bf5e]";
  if (value === "PARCIAL") return "bg-[#e9efff] text-[#315ca5] border-[#a9bee9]";
  if (value.includes("CONCLUIR")) return "bg-[#fff0df] text-[#a05210] border-[#e1b17f]";
  return "bg-[#edf5f0] text-[#456956] border-[#c1d6c8]";
}

export function SpecialProductionPanel({ data, loading = false, error }: { data?: SpecialProduction; loading?: boolean; error?: { message: string } | null }) {
  const { sortedItems, sortKey, sortDirection, toggleSort } = useGridSort(data?.components);
  if (loading) return <section className="rounded-xl border border-[#e0c86d] bg-[#fffdf5] px-4 py-3 text-sm font-bold text-[#716024]">Consultando as OPs da Produção Especial…</section>;
  if (error) return <section className="rounded-xl border border-[#dca2a2] bg-[#fff4f4] px-4 py-3 text-sm font-bold text-[#9d3535]">Não foi possível consultar as OPs da Produção Especial: {error.message}</section>;
  if (!data?.isSpecial) return null;
  return <section className="overflow-hidden rounded-xl border-2 border-[#dfc35b] bg-[#fffdf4] shadow-[0_7px_18px_rgba(114,83,12,.08)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadb9f] bg-[linear-gradient(100deg,#fff0b8,#fffdf6_55%,#f9e7a4)] px-4 py-3">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a8750d] text-white shadow-sm"><Layers3 className="h-5 w-5" /></span><div><h3 className="text-base font-black text-[#574212]">Produção Especial · OP principal {data.primaryOpCode}</h3><p className="mt-0.5 text-xs font-bold text-[#816a29]">As OPs abaixo compõem esta produção e serão atualizadas junto com o apontamento principal.</p></div></div><span className="rounded-full border border-[#c69c2b] bg-white px-3 py-1 text-xs font-black text-[#725719]">Conjunto {data.specialCode ?? "—"} · {data.components.length} OP(s)</span>
    </header>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#fff9e8] text-[10px] font-black uppercase tracking-[.1em] text-[#7a6831]"><tr><SortableHeader label="OP" column="opCode" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Processo" column="machineDescription" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Referência" column="reference" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /><SortableHeader label="Produzida" column="producedQuantity" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} className="text-right" /><SortableHeader label="Saldo" column="balance" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} className="text-right" /><SortableHeader label="Peças / conjunto" column="piecesPerSet" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} className="text-center" /><SortableHeader label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => toggleSort(key as never)} /></tr></thead><tbody className="divide-y divide-[#eee3ba]">{sortedItems.map((item) => <tr key={`${item.opCode}-${item.mpCode}`} className="bg-white/80"><td className="px-4 py-3 font-mono text-sm font-black text-[#5c4817]">{item.opCode}</td><td className="px-4 py-3 font-bold text-[#4b523d]">{item.machineDescription || `Processo ${item.mpCode}`}</td><td className="px-4 py-3 font-medium text-[#616951]">{item.reference || "—"}</td><td className="px-4 py-3 text-right font-mono font-black text-[#2f6647]">{quantity(item.producedQuantity)}</td><td className="px-4 py-3 text-right font-mono font-black text-[#9a6810]">{quantity(item.balance)}</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-md bg-[#f6edd2] px-2 py-1 font-mono text-xs font-black text-[#765e1e]"><Boxes className="h-3.5 w-3.5" />{quantity(item.piecesPerSet)}</span></td><td className="px-4 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${statusTone(item.status)}`}>{item.status || "—"}</span></td></tr>)}</tbody></table></div>
  </section>;
}
