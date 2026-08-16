import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { ConnectionNotice, displayValue, LoadingRows, PageHeading, SearchBar, StatusPill, TablePagination } from "@/components/ProductionPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Factory, ListOrdered, LogOut, Play, Power, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("pt-BR");
}

export default function Programming() {
  const { user, logout } = useLocalAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [queueValues, setQueueValues] = useState<Record<string, string>>({});
  const programming = trpc.production.programming.list.useQuery({ page, limit: 20, search }, { retry: false });
  const activeProduction = trpc.production.programming.active.useQuery(undefined, { enabled: Boolean(user?.machine) && user?.operationalProfile === "operator", retry: false, refetchOnWindowFocus: false });
  const recoveredProcess = useRef<string | null>(null);
  const utils = trpc.useUtils();
  const updateQueue = trpc.production.orders.updateStatus.useMutation({
    onSuccess: async () => { await utils.production.programming.list.invalidate(); toast.success("Fila atualizada."); },
    onError: (error) => toast.error("Não foi possível alterar a fila", { description: error.message }),
  });
  const changeProcess = trpc.production.programming.changeProcess.useMutation({
    onSuccess: async (result) => { await utils.production.programming.list.invalidate(); toast.success(`Processo alterado. Nova fila: ${result.queue}.`); },
    onError: (error) => toast.error("Não foi possível alterar o processo", { description: error.message }),
  });
  const resumeToConclude = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => { await utils.production.programming.list.invalidate(); toast.success("Produção retomada. Novo ciclo de horário registrado."); setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`); },
    onError: (error) => toast.error("Não foi possível retomar A Concluir", { description: error.message }),
  });
  const startNewSetup = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => { await utils.production.programming.list.invalidate(); toast.success("Setup iniciado com o horário do cronômetro diário."); setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`); },
    onError: (error) => toast.error("Não foi possível iniciar o setup", { description: error.message }),
  });
  const operator = user?.operationalProfile === "operator";
  const machine = user?.machine;
  const hasPriorityToConclude = operator && Boolean(programming.data?.items.some((item) => item.status === "A Concluir" && Number(item.fila) === 1));

  useEffect(() => {
    const active = activeProduction.data;
    if (!operator || !active) return;
    const key = `${active.opCodigo}-${active.mpCodigo}`;
    if (recoveredProcess.current === key) return;
    recoveredProcess.current = key;
    toast.warning("OP em produção recuperada", {
      description: `Existe a OP ${active.opCodigo} em produção nesta máquina. Você será direcionado ao apontamento para continuar ou finalizar o processo.`,
      duration: 7000,
    });
    setLocation(`/apontamento/${active.opCodigo}/${active.mpCodigo}`);
  }, [activeProduction.data, operator, setLocation]);

  const closeStation = () => {
    window.close();
    window.setTimeout(() => toast.info("Para fechar esta estação, feche a janela do navegador."), 250);
  };

  const signOut = async () => {
    await logout();
    setLocation("/");
  };

  if (!machine) {
    return <div className="space-y-6"><PageHeading eyebrow="Programação" title="Máquina não identificada" description="O login foi aceito, mas não encontramos uma máquina vinculada a este operador. Configure FIREBIRD_MACHINE_CODE ou confira o vínculo em usuarios_maquinas." /><ConnectionNotice error={programming.error} /></div>;
  }

  return <div className="space-y-6">
    <PageHeading
      eyebrow={operator ? "Operação de máquina" : "Programação de produção"}
      title={operator ? "Sequência da máquina" : "Programação e fila"}
      description={operator ? "Ordens Liberadas/Abertas, A Concluir e Setup a Concluir da máquina atribuída ao seu acesso. Somente a fila 1 pode iniciar; A Concluir tem prioridade." : "Consulte a programação da máquina e ajuste a posição de fila das ordens ainda abertas."}
      action={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => programming.refetch()} className="border-[#cad9d0] bg-white"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button variant="outline" onClick={signOut} className="border-[#cc9c43] bg-[#fffaf0] text-[#74541a] hover:bg-[#fff2d6]"><LogOut className="mr-2 h-4 w-4" />Deslogar</Button><Button onClick={closeStation} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"><Power className="mr-2 h-4 w-4" />Fechar</Button></div>}
    />

    <section className="overflow-hidden rounded-2xl border border-[#164f42] bg-[#0f3d33] text-white shadow-[0_18px_42px_rgba(18,61,51,.18)]">
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#bce7ce] text-[#135a46]"><Factory className="h-5 w-5" /></div>
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#b8d8c5]">Máquina / processo</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.035em]">{machine.description}</h2><p className="mt-1 text-sm text-[#cde6d7]">Código {machine.code} · {machine.followsQueue ? "Segue a fila operacional" : "Processo sem fila obrigatória"}</p></div>
        <div className="rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-right"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b8d8c5]">Perfil atual</p><p className="mt-1 font-semibold">{operator ? "Operador" : "Programador"}</p></div>
      </div>
    </section>

    {programming.error ? <ConnectionNotice error={programming.error} /> : null}
    <section className="overflow-hidden rounded-2xl border border-[#e1e5de] bg-white shadow-[0_12px_32px_rgba(31,42,34,.035)]">
      <div className="flex flex-col gap-3 border-b border-[#edf0eb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-[#34463b]"><ListOrdered className="h-4 w-4 text-[#28715d]" />Fila operacional</div>{operator ? <p className="mt-1 text-xs font-medium text-[#65766c]">Liberado/Aberto, A Concluir e Setup a Concluir são exibidos juntos. Somente a fila 1 inicia; A Concluir é prioritária.</p> : null}</div><SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar OP, referência ou produto" /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-[#fafbf9] text-[10px] uppercase tracking-[.1em] text-[#899189]"><tr><th className="px-5 py-3">Fila</th><th className="px-5 py-3">Cliente / OP</th><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Referência</th><th className="px-5 py-3">Qtd. OP</th><th className="px-5 py-3">Produzida</th><th className="px-5 py-3">Saldo</th><th className="px-5 py-3">Entrega</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Ação</th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{programming.isLoading ? <LoadingRows columns={10} /> : programming.data?.items.map((item) => {
        const key = `${item.op_codigo}-${item.mp_codigo}`; const desiredQueue = queueValues[key] ?? String(item.fila ?? ""); const eligibleStatus = ["Liberado", "Aberto", "A Concluir", "Setup a Concluir"].includes(item.status ?? ""); const isPriorityRow = Number(item.fila) === 1; const canStart = eligibleStatus && isPriorityRow && (!hasPriorityToConclude || item.status === "A Concluir");
        return <tr key={key} className={canStart ? "bg-[#f3fbf6]" : "hover:bg-[#fbfcfa]"}><td className="px-5 py-3.5"><span className="inline-flex min-w-7 justify-center rounded-md bg-[#e7efe9] px-2 py-1 font-mono text-xs font-bold text-[#235442]">{displayValue(item.fila)}</span></td><td className="px-5 py-3.5"><p className="font-medium text-[#34463b]">{displayValue(item.client)}</p><p className="mt-0.5 font-mono text-xs text-[#7c887e]">OP {item.op_codigo}</p></td><td className="px-5 py-3.5 font-mono text-xs text-[#405449]">{displayValue(item.customerProductCode)}</td><td className="px-5 py-3.5 font-medium text-[#46564b]">{displayValue(item.produto_referencia || item.referencia)}</td><td className="px-5 py-3.5 font-mono text-xs">{displayValue(item.quantity)}</td><td className="px-5 py-3.5 font-mono text-xs">{displayValue(item.quantidade_produzida)}</td><td className="px-5 py-3.5 font-mono text-xs font-bold text-[#28684f]">{displayValue(item.saldo)}</td><td className="px-5 py-3.5 text-xs text-[#68766d]">{formatDate(item.data_entrega)}</td><td className="px-5 py-3.5"><StatusPill status={item.status} /></td><td className="px-5 py-3.5">{operator ? <Button size="sm" disabled={!canStart || resumeToConclude.isPending || startNewSetup.isPending} onClick={() => item.status === "A Concluir" ? resumeToConclude.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo }) : startNewSetup.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo })} className="h-8 bg-[#187558] text-xs hover:bg-[#116348]"><Play className="mr-1.5 h-3.5 w-3.5" />{item.status === "A Concluir" && resumeToConclude.isPending ? "Retomando…" : item.status !== "A Concluir" && startNewSetup.isPending ? "Iniciando setup…" : canStart ? item.status === "A Concluir" ? "Retomar" : "Iniciar" : !isPriorityRow ? "Fila prioritária" : hasPriorityToConclude ? "A Concluir prioritária" : "Indisponível"}</Button> : <div className="flex items-center gap-2"><Input value={desiredQueue} onChange={(event) => setQueueValues((current) => ({ ...current, [key]: event.target.value }))} inputMode="numeric" className="h-8 w-16 font-mono text-xs" /><Button size="sm" variant="outline" disabled={updateQueue.isPending || item.status === "Atendido" || item.status === "A Concluir"} onClick={() => updateQueue.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo, fila: Number(desiredQueue), status: item.status as "Liberado" | "Em Produção" | "Parcial" | "Atendido" | "Parado" })} className="h-8 text-xs"><Settings2 className="mr-1 h-3.5 w-3.5" />Fila</Button><Button size="sm" variant="outline" disabled={changeProcess.isPending || item.status === "Atendido" || item.status === "A Concluir"} onClick={() => { const value = window.prompt("Informe o código do novo processo/máquina:"); const machineCode = Number(value); if (!Number.isInteger(machineCode) || machineCode < 1) { if (value !== null) toast.error("Informe um código de processo válido."); return; } changeProcess.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo, machineCode }); }} className="h-8 text-xs">Processo</Button></div>}</td></tr>;
      })}</tbody></table></div>
      {!programming.isLoading && !programming.data?.items.length ? <div className="px-5 py-14 text-center text-sm text-[#899189]">Não há processos liberados para esta máquina com os filtros atuais.</div> : null}
      <TablePagination page={page} total={programming.data?.total ?? 0} limit={20} onChange={setPage} />
    </section>
    {operator ? <p className="flex items-center gap-2 text-xs text-[#69766c]"><ClipboardCheck className="h-4 w-4 text-[#2c765e]" />O início abre o apontamento da OP selecionada. O setup só é gravado após a confirmação explícita na próxima tela.</p> : null}
  </div>;
}
