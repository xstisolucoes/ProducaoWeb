import { useEffect, useState } from "react";
import { CirclePlus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConnectionNotice, LoadingRows, PageHeading, SearchBar, StatusPill, TablePagination, displayValue } from "@/components/ProductionPrimitives";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { toast } from "sonner";

const statusOptions = ["Liberado", "Em Produção", "Parcial", "Atendido", "Parado"] as const;

export default function Orders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { const id = window.setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => window.clearTimeout(id); }, [search]);
  const orders = trpc.production.orders.list.useQuery({ page, limit: 20, search: query }, { retry: false });
  const { user } = useLocalAuth();
  const statusPermission = user?.permissionRules.statusUpdate;
  const canUpdateStatus = Boolean(statusPermission && user?.permissions.includes(statusPermission));
  const utils = trpc.useUtils();
  const updateStatus = trpc.production.orders.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.production.orders.list.invalidate();
      await utils.production.dashboard.invalidate();
      toast.success("Status atualizado no Firebird local.");
    },
    onError: (error) => toast.error("Não foi possível atualizar a ordem.", { description: error.message }),
  });

  const announceCreation = () => toast.info("Cadastro de ordem em preparação", { description: "A criação será ativada após a validação local dos campos obrigatórios e geradores do Firebird legado." });
  return <div className="space-y-7"><PageHeading eyebrow="Programação" title="Ordens de Produção" description="Tela baseada na programação legada: fila, processo, saldos e status operacional de cada ordem." action={<Button onClick={announceCreation} className="h-10 rounded-lg bg-[#176c5a] px-4 text-sm font-bold hover:bg-[#0f5a49]"><CirclePlus className="mr-2 h-4 w-4" />Nova ordem</Button>} />
    {orders.error && <ConnectionNotice error={orders.error} />}
    <section className="overflow-hidden rounded-2xl border border-[#e1e5de] bg-white shadow-[0_12px_32px_rgba(31,42,34,0.035)]"><div className="flex flex-col gap-3 border-b border-[#edf0eb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><SearchBar value={search} onChange={setSearch} placeholder="Buscar por OP, referência ou produto" /><Button variant="outline" onClick={() => toast.info("Filtros avançados em preparação", { description: "A busca por OP, referência e produto já está disponível." })} className="h-10 rounded-lg border-[#dfe4dc] text-[#566157]"><SlidersHorizontal className="mr-2 h-4 w-4" />Filtros</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[#fafbf9] text-[10px] uppercase tracking-[0.1em] text-[#899189]"><tr><th className="px-5 py-3 font-bold">Ordem / Processo</th><th className="px-5 py-3 font-bold">Referência</th><th className="px-5 py-3 font-bold">Fila</th><th className="px-5 py-3 font-bold">Saldo</th><th className="px-5 py-3 font-bold">Produzido</th><th className="px-5 py-3 font-bold">Entrega</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 font-bold">Atualizar</th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{orders.isLoading ? <LoadingRows columns={8} /> : orders.data?.items.map((item) => <tr className="hover:bg-[#fbfcfa]" key={`${item.op_codigo}-${item.mp_codigo}`}><td className="px-5 py-3.5"><p className="font-mono text-xs font-medium text-[#27392f]">OP {item.op_codigo}</p><p className="mt-0.5 text-xs text-[#859086]">{displayValue(item.processo)}</p></td><td className="px-5 py-3.5 text-[#47534a]">{displayValue(item.produto_referencia || item.referencia)}</td><td className="px-5 py-3.5 font-mono text-xs text-[#556258]">{displayValue(item.fila)}</td><td className="px-5 py-3.5 font-mono text-xs text-[#556258]">{displayValue(item.saldo)}</td><td className="px-5 py-3.5 font-mono text-xs text-[#556258]">{displayValue(item.quantidade_produzida)}</td><td className="px-5 py-3.5 text-xs text-[#68746a]">{item.data_entrega ? new Date(item.data_entrega).toLocaleDateString("pt-BR") : "—"}</td><td className="px-5 py-3.5"><StatusPill status={item.status} /></td><td className="px-5 py-3.5">{canUpdateStatus ? <Select disabled={updateStatus.isPending} value={statusOptions.includes(item.status as typeof statusOptions[number]) ? item.status! : undefined} onValueChange={(status) => updateStatus.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo, fila: item.fila ?? undefined, status: status as typeof statusOptions[number] })}><SelectTrigger size="sm" className="w-32 border-[#dde3dc] bg-white text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{statusOptions.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select> : <span className="text-xs text-[#8b948b]">Sem permissão</span>}</td></tr>)}</tbody></table></div>
      {!orders.isLoading && !orders.data?.items.length && <div className="px-5 py-12 text-center text-sm text-[#899189]">Nenhuma ordem localizada com os filtros atuais.</div>}<TablePagination page={page} total={orders.data?.total ?? 0} limit={20} onChange={setPage} /></section></div>;
}
