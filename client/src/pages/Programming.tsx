import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { ConnectionNotice, displayValue, LoadingRows, PageHeading, processStatusClass, StatusPill, TablePagination } from "@/components/ProductionPrimitives";
import { ProductPalletizationDialog, ProductPrintLayoutDialog } from "@/components/ProductVisualDialogs";
import { ProductReservationDialog } from "@/components/ProductReservationDialog";
import { ApprovedProcessQuantitiesDialog } from "@/components/ApprovedProcessQuantitiesDialog";
import { RequestDialog } from "@/components/RequestDialog";
import { ProcessLabelDialog } from "@/components/ProcessLabelDialog";
import { OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { useTheme } from "@/contexts/ThemeContext";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, Barcode, Boxes, ClipboardCheck, Factory, FileImage, ListOrdered, Package, Play, Power, RefreshCw, Search, Settings2, Sparkles, TimerReset, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("pt-BR");
}

function safeColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#3d725e";
}

const PROGRAMMER_MACHINE_CACHE_KEY = "production-programming-machine-code";
const STATION_MACHINE_CACHE_KEY = "production-station-machine-code";

function firstDisplayName(name: string | null | undefined) {
  return String(name ?? "").trim().split(/\s+/)[0] || "—";
}

type QueueMessage = { title: string; description: string };

function operationalQueueMessage(message: string | null | undefined): QueueMessage {
  const detail = String(message ?? "").trim();
  if (/processo em produção na fila 1/i.test(detail)) {
    return { title: "Alteração não permitida", description: "Existe um processo em produção na fila 1. Conclua-o antes de alterar a prioridade da fila." };
  }
  if (/processo A Concluir na fila 1/i.test(detail)) {
    return { title: "Alteração não permitida", description: "Existe um processo A Concluir na fila 1. Conclua-o antes de alterar a prioridade da fila." };
  }
  if (/processo Setup a Concluir na fila 1/i.test(detail)) {
    return { title: "Alteração não permitida", description: "Existe um processo Setup a Concluir na fila 1. Conclua o setup antes de alterar a prioridade da fila." };
  }
  if (!detail || /(firebird|proxy|network|fetch|http|timeout|conexão|indisponível)/i.test(detail)) {
    return { title: "Alteração não permitida", description: "Não foi possível alterar a fila neste momento. Verifique a programação e tente novamente." };
  }
  return { title: "Alteração não permitida", description: detail };
}

export default function Programming() {
  const { user, logout } = useLocalAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedMachineCode, setSelectedMachineCode] = useState<number | null>(() => {
    if (typeof window === "undefined") return user?.machine?.code ?? null;
    const cachedCode = Number(window.localStorage.getItem(PROGRAMMER_MACHINE_CACHE_KEY));
    return Number.isInteger(cachedCode) && cachedCode > 0 ? cachedCode : user?.machine?.code ?? null;
  });
  const [statusFilter, setStatusFilter] = useState("A Lib/Lib/Parcial");
  const [showMachineSearch, setShowMachineSearch] = useState(false);
  const [machineSearch, setMachineSearch] = useState("");
  const [showStationConfiguration, setShowStationConfiguration] = useState(() => {
    if (typeof window === "undefined") return false;
    const stationCode = Number(window.localStorage.getItem(STATION_MACHINE_CACHE_KEY));
    return !Number.isInteger(stationCode) || stationCode < 1;
  });
  const [stationSearch, setStationSearch] = useState("");
  const [queueValues, setQueueValues] = useState<Record<string, string>>({});
  const [selectedProcess, setSelectedProcess] = useState<{ opCode: number; masterOrder: number | null } | null>(null);
  const [showExitOptions, setShowExitOptions] = useState(false);
  const [showCleaning, setShowCleaning] = useState(false);
  const [selectedCleaningReason, setSelectedCleaningReason] = useState<number | null>(null);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [showApprovedQuantities, setShowApprovedQuantities] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showProcessLabel, setShowProcessLabel] = useState(false);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [queueMessage, setQueueMessage] = useState<QueueMessage | null>(null);
  const [processTransfer, setProcessTransfer] = useState<{ opCodigo: number; mpCodigo: number; reference: string | null } | null>(null);
  const [selectedTargetMachineCode, setSelectedTargetMachineCode] = useState<number | null>(null);
  const operator = ["operator", "manual-pointing"].includes(user?.operationalProfile ?? "");
  const manualPointing = user?.operationalProfile === "manual-pointing";
  const programmer = user?.operationalProfile === "programmer";
  const stationConfigurator = user?.canConfigureStation === true;
  const { brandTheme } = useTheme();
  const machine = user?.machine;
  const controlledMachines = trpc.production.programming.machines.useQuery(undefined, { enabled: programmer, retry: false });
  const loginStations = trpc.localAuth.stations.useQuery(undefined, { enabled: stationConfigurator && showStationConfiguration, retry: false });
  const activeMachineCode = operator ? machine?.code ?? null : selectedMachineCode;
  const activeMachine = programmer ? controlledMachines.data?.find((item) => Number(item.code) === Number(activeMachineCode)) ?? null : machine;
  const programming = trpc.production.programming.list.useQuery({ page, limit: 7, search, machineCode: activeMachineCode ?? undefined, status: manualPointing ? "Liberado/Parcial/Em Produção" : operator ? "Todos" : statusFilter }, { enabled: Boolean(activeMachineCode), retry: false });
  const activeProduction = trpc.production.programming.active.useQuery(undefined, { enabled: Boolean(user?.machine) && operator && !manualPointing, retry: false, refetchOnWindowFocus: false });
  const processSequence = trpc.production.queue.processes.useQuery({ opCode: selectedProcess?.opCode ?? 1, masterOrder: selectedProcess?.masterOrder ?? null }, { enabled: Boolean(selectedProcess), retry: false });
  const cleaningReasons = trpc.production.programming.cleaningReasons.useQuery(undefined, { enabled: showCleaning && Boolean(user?.machine), retry: false });
  const selectedItem = programming.data?.items.find((item) => item.op_codigo === selectedProcess?.opCode) ?? programming.data?.items[0];
  const selectedCodes = selectedItem ? { opCodigo: selectedItem.op_codigo, mpCodigo: selectedItem.mp_codigo } : null;
  const selectedPalletization = trpc.production.pointing.palletization.useQuery(selectedCodes ?? { opCodigo: 1, mpCodigo: 1 }, { enabled: showPalletization && Boolean(selectedCodes), retry: false });
  const selectedReservations = trpc.production.queue.reservations.useQuery({ opCode: selectedItem?.op_codigo ?? 1 }, { enabled: showReservation && Boolean(selectedItem), retry: false });
  const selectedApprovedQuantities = trpc.production.pointing.approvedQuantities.useQuery(selectedCodes ?? { opCodigo: 1, mpCodigo: 1 }, { enabled: showApprovedQuantities && Boolean(selectedCodes), retry: false });
  const selectedLabel = trpc.production.pointing.processLabel.useQuery(selectedCodes ?? { opCodigo: 1, mpCodigo: 1 }, { enabled: showProcessLabel && Boolean(selectedCodes), retry: false });
  const selectedPrintLayout = trpc.production.pointing.printLayout.useQuery(selectedCodes ?? { opCodigo: 1, mpCodigo: 1 }, { enabled: Boolean(selectedCodes), retry: false });
  const eligibleProcessMachines = trpc.production.programming.eligibleMachines.useQuery(processTransfer ?? { opCodigo: 1, mpCodigo: 1 }, { enabled: Boolean(processTransfer), retry: false });
  const localPrinters = trpc.production.printers.list.useQuery(undefined, { enabled: showProcessLabel, retry: false });
  const recoveredProcess = useRef<string | null>(null);
  const utils = trpc.useUtils();
  const reloadProgrammingPreservingMachine = () => {
    if (typeof window === "undefined") return;
    const machineCode = activeMachine?.code ?? selectedMachineCode;
    if (programmer && Number.isInteger(Number(machineCode)) && Number(machineCode) > 0) {
      window.localStorage.setItem(PROGRAMMER_MACHINE_CACHE_KEY, String(machineCode));
    }
    window.location.reload();
  };
  const updateQueue = trpc.production.programming.changeQueue.useMutation({
    onSuccess: async (result) => { await utils.production.programming.list.invalidate(); toast.success("Fila reorganizada.", { description: `A ordem foi posicionada na fila ${result.queue}${result.releasedFromQueue2000 ? " e liberada para produção." : "."}` }); window.setTimeout(reloadProgrammingPreservingMachine, 180); },
    onError: (error) => setQueueMessage(operationalQueueMessage(error.message)),
  });
  const changeProcess = trpc.production.programming.changeProcess.useMutation({
    onSuccess: async (result) => { await utils.production.programming.list.invalidate(); setProcessTransfer(null); setSelectedTargetMachineCode(null); toast.success(`Processo alterado. Nova fila: ${result.queue}.`); },
    onError: (error) => setQueueMessage(operationalQueueMessage(error.message)),
  });
  const resumeToConclude = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => { await utils.production.programming.list.invalidate(); toast.success("Produção retomada. Novo ciclo de horário registrado."); setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`); },
    onError: (error) => toast.error("Não foi possível retomar A Concluir", { description: error.message }),
  });
  const startNewSetup = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => { await utils.production.programming.list.invalidate(); toast.success("Setup iniciado com o horário do cronômetro diário."); setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`); },
    onError: (error) => toast.error("Não foi possível iniciar o setup", { description: error.message }),
  });
  const hasPriorityToConclude = operator && !manualPointing && Boolean(programming.data?.items.some((item) => item.status === "A Concluir" && Number(item.fila) === 1));

  useEffect(() => {
    const active = activeProduction.data;
    if (!operator || manualPointing || !active) return;
    const key = `${active.opCodigo}-${active.mpCodigo}`;
    if (recoveredProcess.current === key) return;
    recoveredProcess.current = key;
    toast.warning("OP em produção recuperada", {
      description: `Existe a OP ${active.opCodigo} em produção nesta máquina. Você será direcionado ao apontamento para continuar ou finalizar o processo.`,
      duration: 7000,
    });
    setLocation(`${manualPointing ? "/apontamento-manual" : "/apontamento"}/${active.opCodigo}/${active.mpCodigo}`);
  }, [activeProduction.data, manualPointing, operator, setLocation]);

  useEffect(() => {
    const first = programming.data?.items[0];
    if (!first || selectedProcess) return;
    setSelectedProcess({ opCode: first.op_codigo, masterOrder: first.master_order ?? null });
  }, [programming.data?.items, selectedProcess]);

  useEffect(() => {
    if (!programmer || !controlledMachines.data?.length) return;
    const selectedIsAvailable = selectedMachineCode !== null && controlledMachines.data.some((item) => Number(item.code) === Number(selectedMachineCode));
    if (selectedIsAvailable) return;
    const fallbackCode = Number(controlledMachines.data[0].code);
    setSelectedMachineCode(fallbackCode);
    window.localStorage.setItem(PROGRAMMER_MACHINE_CACHE_KEY, String(fallbackCode));
  }, [controlledMachines.data, programmer, selectedMachineCode]);

  useEffect(() => {
    setSelectedProcess(null);
    setPage(1);
  }, [activeMachineCode, statusFilter]);

  const closeStation = () => {
    window.close();
    window.setTimeout(() => toast.info("Para fechar esta estação, feche a janela do navegador."), 250);
  };

  const signOut = async () => {
    await logout();
    setLocation("/");
  };

  const selectProgrammerMachine = (machineCode: number) => {
    const normalizedCode = Number(machineCode);
    setSelectedMachineCode(normalizedCode);
    window.localStorage.setItem(PROGRAMMER_MACHINE_CACHE_KEY, String(normalizedCode));
  };

  const configureStation = async (machineCode: number) => {
    window.localStorage.setItem(STATION_MACHINE_CACHE_KEY, String(machineCode));
    setShowStationConfiguration(false);
    await logout();
    setLocation("/");
  };

  const refreshProgramming = async () => {
    await programming.refetch();
    toast.success("Programação atualizada", { description: `Fila recarregada para ${activeMachine?.description ?? "a máquina selecionada"}.` });
  };

  const reloadAfterQueueWarning = () => { setQueueMessage(null); reloadProgrammingPreservingMachine(); };

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  if (!activeMachine) {
    return <div className="space-y-6"><PageHeading eyebrow="Programação" title={stationConfigurator ? "Configure a estação" : programmer ? "Selecione uma máquina" : "Máquina não identificada"} description={stationConfigurator ? "Defina a máquina deste navegador. Após salvar, os operadores desta estação usarão essa configuração automaticamente." : programmer ? "Escolha uma máquina controlada para consultar a programação." : "O login foi aceito, mas não encontramos uma máquina vinculada a este operador."} />{stationConfigurator ? <Button onClick={() => setShowStationConfiguration(true)} className="bg-[#177458] text-white hover:bg-[#105f49]">Configurar estação</Button> : <Button onClick={() => setShowMachineSearch(true)} className="bg-[#177458] text-white hover:bg-[#105f49]">Selecionar máquina</Button>}<StationConfigurationDialog open={showStationConfiguration} onOpenChange={setShowStationConfiguration} search={stationSearch} onSearchChange={setStationSearch} stations={loginStations.data ?? []} loading={loginStations.isLoading} error={loginStations.error} onSelect={configureStation} /><Dialog open={showMachineSearch} onOpenChange={setShowMachineSearch}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Selecionar máquina controlada</DialogTitle><DialogDescription>Escolha a máquina para consultar a programação.</DialogDescription></DialogHeader><Input value={machineSearch} onChange={(event) => setMachineSearch(event.target.value)} placeholder="Buscar por código ou descrição" /><div className="max-h-96 space-y-2 overflow-y-auto">{controlledMachines.data?.filter((item) => `${item.code} ${item.description}`.toLocaleLowerCase("pt-BR").includes(machineSearch.toLocaleLowerCase("pt-BR"))).map((item) => <button key={item.code} onClick={() => { selectProgrammerMachine(item.code); setShowMachineSearch(false); }} className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left hover:border-[#177458] hover:bg-[#eefaf2]"><span className="font-bold text-[#254536]">{item.description}</span><span className="font-mono text-xs text-[#5f786a]">Código {item.code}</span></button>)}</div><DialogFooter><Button onClick={() => setShowMachineSearch(false)} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Fechar</Button></DialogFooter></DialogContent></Dialog><ConnectionNotice error={programming.error} /></div>;
  }

    return <div className={`theme-programming ${manualPointing ? "flex min-h-dvh flex-col gap-3" : "space-y-4"}`}>
    {operator && !manualPointing ? <PageHeading eyebrow="" title="Sequência da máquina" description="" compact /> : null}

    <section className="theme-machine-band overflow-hidden rounded-2xl border text-white shadow-[0_18px_42px_rgba(18,61,51,.18)] [&>div:nth-child(3)]:hidden">
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className={`flex items-center justify-center overflow-hidden ${brandTheme === "xsti" ? "h-12 w-44" : "h-11 w-11 rounded-xl bg-[#bce7ce] text-[#135a46]"}`}>{brandTheme === "xsti" ? <img src={XPAPER_LOGO_SRC} alt="XPAPER" className="h-full w-full object-contain object-left" /> : <Factory className="h-5 w-5" />}</div>
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#b8d8c5]">Máquina / processo</p><div className="mt-1 flex flex-wrap items-center gap-3"><h2 className="text-xl font-extrabold tracking-[-.035em]">{activeMachine.description}</h2>{programmer ? <Button size="sm" variant="outline" onClick={() => setShowMachineSearch(true)} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Trocar máquina</Button> : null}{stationConfigurator ? <Button size="sm" variant="outline" onClick={() => setShowStationConfiguration(true)} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Configurar estação</Button> : null}</div><p className="mt-1 text-sm text-[#cde6d7]">Código {activeMachine.code} · {operator && machine?.followsQueue ? "Segue a fila operacional" : "Máquina controlada"}</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2"><ThemeConfigurator compact /><div className="min-w-0 border-l border-white/15 pl-3 text-right"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b8d8c5]">{operator ? "Operador" : "Programador"}</p><p className="mt-1 truncate font-semibold">{firstDisplayName(user?.name)}</p></div></div>
      </div>
      {processSequence.data?.length ? <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2.5">{processSequence.data.map((process) => <button key={`${process.opCode}-${process.mpCode}`} onClick={() => setSelectedProcess({ opCode: process.opCode, masterOrder: selectedProcess?.masterOrder ?? null })} className={`process-status-card min-w-44 rounded-lg border px-3 py-2 text-left font-sans transition ${processStatusClass(process.status)} ${process.mpCode === selectedItem?.mp_codigo ? "ring-2 ring-white/75" : "opacity-90 hover:opacity-100"}`}><span className="block truncate text-xs font-extrabold">{process.machineDescription}</span><span className="mt-1 block text-[10px] font-semibold">{process.status ?? "Sem status"}{manualPointing ? "" : ` · Fila ${process.queue ?? "—"}`}</span></button>)}</div> : null}
      {operator && !manualPointing && selectedItem ? <div className="grid gap-2 border-t border-white/10 bg-black/10 px-4 py-2.5 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr]"><div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#b8d8c5]">Ajuste largura</span><span className="mt-1 block font-mono text-sm font-black text-white">{displayValue(selectedItem.adjustmentWidth)} <span className="text-[#b8d8c5]">· total {displayValue(selectedItem.adjustmentWidthTotal)}</span></span></div><div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#b8d8c5]">Ajuste comprimento</span><span className="mt-1 block font-mono text-sm font-black text-white">{displayValue(selectedItem.adjustmentLength)} <span className="text-[#b8d8c5]">· total {displayValue(selectedItem.adjustmentLengthTotal)}</span></span></div><div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#b8d8c5]">Cores</span><div className="mt-1 flex gap-1 overflow-hidden">{selectedPrintLayout.data?.colors?.length ? selectedPrintLayout.data.colors.map((color) => <span key={`${color.order}-${color.description}`} title={color.description} className="h-5 min-w-5 rounded border border-white/60 shadow-sm" style={{ backgroundColor: safeColor(color.hexWhite) }} />) : <span className="text-xs font-bold text-[#e0eee4]">—</span>}</div></div><div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#b8d8c5]">Clichês / facas</span><span className="mt-1 block truncate text-xs font-bold text-white">C: {selectedPrintLayout.data?.cliches?.length ? selectedPrintLayout.data.cliches.map((item) => `${item.code}/${item.series}`).join(" · ") : "—"} <span className="text-[#b8d8c5]">|</span> F: {selectedPrintLayout.data?.facas?.length ? selectedPrintLayout.data.facas.map((item) => item.code).join(" · ") : "—"}</span></div></div> : null}
    </section>

    {programming.error ? <ConnectionNotice error={programming.error} /> : null}
    {programmer ? <section className="theme-filter-band flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label className="mb-1 block text-[10px] font-black uppercase tracking-[.14em] text-[#3c735b]">Máquina</label><button onClick={() => setShowMachineSearch(true)} className="flex h-10 w-full items-center justify-between rounded-lg border border-[#a8cfb6] bg-white px-3 text-left text-sm font-bold text-[#254536]"><span className="truncate">{activeMachine.description}</span><Search className="h-4 w-4 text-[#237052]" /></button></div><div className="w-full sm:w-60"><label className="mb-1 block text-[10px] font-black uppercase tracking-[.14em] text-[#3c735b]">Status</label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-lg border border-[#a8cfb6] bg-white px-3 text-sm font-bold text-[#254536]"><option>Todos</option><option>A Lib/Lib/Parcial</option><option>A Liberar</option><option>Atendido</option><option>Liberado</option><option>Em Produção</option><option>Parcial</option><option>Setup Cancelado</option></select></div></section> : null}
    <section className={`theme-surface overflow-hidden rounded-2xl border border-[#e1e5de] bg-white shadow-[0_12px_32px_rgba(31,42,34,.035)] ${manualPointing ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div className="theme-grid-title flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-[#1d5c47]"><ListOrdered className="h-4 w-4 text-[#28715d]" />{manualPointing ? "Ordens para apontamento" : "Fila operacional"}</div></div><div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4d846b]" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Código prod. cliente, OP ou referência" className="theme-search-field h-10 border-[#b9d9c8] bg-white/90 pl-9 text-sm" /></div></div>
      <div className={`overflow-x-auto ${manualPointing ? "min-h-0 flex-1" : programmer ? "min-h-[388px]" : ""}`}><table className={`programming-grid w-full text-left text-sm ${manualPointing ? "min-w-[1250px]" : "min-w-[1600px]"}`}><thead className="theme-grid-header bg-[#f5f8f5] text-[10px] font-black uppercase tracking-[.08em] text-[#66776d]"><tr>{!manualPointing ? <th className="px-3 py-3">Fila</th> : null}<th className="px-3 py-3">Cliente</th><th className="px-3 py-3">O.P.</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Rev.</th><th className="px-3 py-3">Referência</th><th className="px-3 py-3">Código prod. cliente</th><th className="px-3 py-3 text-right">Qtde. OP</th><th className="px-3 py-3 text-right">Produzida</th><th className="px-3 py-3 text-right">Saldo</th><th className="px-3 py-3">Data Exp.</th><th className="px-3 py-3">Data Ent.</th><th className="px-3 py-3">Status</th>{!manualPointing ? <><th className="px-3 py-3">Situação M.P.</th><th className="px-3 py-3">Solicitação</th></> : null}<th className="px-3 py-3">Ação</th></tr></thead><tbody className="divide-y divide-[#e7ede8]">{programming.isLoading ? <LoadingRows columns={manualPointing ? 13 : 16} /> : programming.data?.items.map((item) => {
        const key = `${item.op_codigo}-${item.mp_codigo}`; const desiredQueue = queueValues[key] ?? String(item.fila ?? ""); const eligibleStatus = ["Liberado", "Aberto", "A Concluir", "Setup a Concluir"].includes(item.status ?? ""); const manualEligible = ["Liberado", "Parcial", "Em Produção"].includes(item.status ?? ""); const isPriorityRow = Number(item.fila) === 1; const canStart = manualPointing ? manualEligible : eligibleStatus && isPriorityRow && (!hasPriorityToConclude || item.status === "A Concluir");
        const selected = selectedProcess?.opCode === item.op_codigo && selectedItem?.mp_codigo === item.mp_codigo;
        item.processPosition = item.reservedStatus || item.processSituation || item.processPosition;
        return <tr key={key} onClick={() => setSelectedProcess({ opCode: item.op_codigo, masterOrder: item.master_order ?? null })} className={`theme-grid-row ${selected ? "theme-grid-row-selected bg-[#dff3e7] shadow-[inset_5px_0_0_#177458]" : canStart ? "bg-[#f5fbf7]" : "hover:bg-[#f7faf7]"} cursor-pointer transition-colors`}>{!manualPointing ? <td className="px-3 py-2.5"><span className="inline-flex min-w-7 justify-center rounded-md bg-[#e7efe9] px-2 py-1 font-mono text-xs font-bold text-[#235442]">{displayValue(item.fila)}</span></td> : null}<td className="px-3 py-2.5 font-semibold text-[#34463b]">{displayValue(item.client)}</td><td className="px-3 py-2.5 font-mono text-xs font-bold text-[#405449]">{item.op_codigo}</td><td className="px-3 py-2.5 font-mono text-xs text-[#405449]">{displayValue(item.productCode)}</td><td className="px-3 py-2.5 font-mono text-xs">{displayValue(item.revision)}</td><td className="px-3 py-2.5 font-medium text-[#46564b]">{displayValue(item.produto_referencia || item.referencia)}</td><td className="px-3 py-2.5 font-mono text-xs text-[#405449]">{displayValue(item.customerProductCode)}</td><td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{displayValue(item.quantity)}</td><td className="px-3 py-2.5 text-right font-mono text-xs">{displayValue(item.quantidade_produzida)}</td><td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-[#28684f]">{displayValue(item.saldo)}</td><td className="px-3 py-2.5 text-xs text-[#68766d]">{formatDate(item.shipmentDate)}</td><td className="px-3 py-2.5 text-xs text-[#68766d]">{formatDate(item.data_entrega)}</td><td className="px-3 py-2.5"><StatusPill status={item.status} /></td>{!manualPointing ? <><td className="px-3 py-2.5"><span className="rounded bg-[#e6f8eb] px-2 py-1 text-[11px] font-bold text-[#187347]">{displayValue(item.processPosition)}</span></td><td className="px-3 py-2.5"><span className={`rounded px-2 py-1 text-[11px] font-bold ${requestStatusClass(item.requestStatus)}`}>{displayValue(item.requestStatus, "Não solicitada")}</span></td></> : null}<td className="px-3 py-2.5">{operator ? <Button size="sm" disabled={!canStart || resumeToConclude.isPending || startNewSetup.isPending} onClick={(event) => { event.stopPropagation(); if (manualPointing) { setLocation(`/apontamento-manual/${item.op_codigo}/${item.mp_codigo}`); return; } item.status === "A Concluir" ? resumeToConclude.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo }) : startNewSetup.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo }); }} className="theme-btn-primary h-8 bg-[#187558] text-xs hover:bg-[#116348]"><Play className="mr-1.5 h-3.5 w-3.5" />{manualPointing && item.status === "Em Produção" ? "Apontar" : item.status === "A Concluir" && resumeToConclude.isPending ? "Retomando…" : item.status !== "A Concluir" && startNewSetup.isPending ? "Iniciando setup…" : canStart ? item.status === "A Concluir" ? "Retomar" : "Iniciar" : manualPointing ? "Indisponível" : !isPriorityRow ? "Fila prioritária" : hasPriorityToConclude ? "A Concluir prioritária" : "Indisponível"}</Button> : <div className="flex items-center gap-2"><Input value={desiredQueue} onChange={(event) => setQueueValues((current) => ({ ...current, [key]: event.target.value }))} inputMode="numeric" className="theme-search-field h-8 w-16 font-mono text-xs" /><Button size="sm" variant="outline" disabled={updateQueue.isPending} onClick={() => { const queue = Number(desiredQueue); if (!Number.isInteger(queue) || queue < 1) { setQueueMessage(operationalQueueMessage("Informe uma posição de fila válida.")); return; } if (!activeMachine?.code) { setQueueMessage(operationalQueueMessage("Selecione uma máquina para reorganizar a fila.")); return; } updateQueue.mutate({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo, machineCode: Number(activeMachine.code), queue }); }} className="theme-btn-soft h-8 text-xs"><Settings2 className="mr-1 h-3.5 w-3.5" />Fila</Button><Button size="sm" variant="outline" disabled={changeProcess.isPending || ["Atendido", "A Concluir", "Setup a Concluir"].includes(item.status ?? "")} onClick={() => { setSelectedTargetMachineCode(null); setProcessTransfer({ opCodigo: item.op_codigo, mpCodigo: item.mp_codigo, reference: item.referencia ?? item.produto_referencia ?? null }); }} className="theme-btn-soft h-8 text-xs">Processo</Button></div>}</td></tr>;
      })}</tbody></table></div>
      {!programming.isLoading && !programming.data?.items.length ? <div className="px-5 py-14 text-center text-sm text-[#899189]">Não há processos liberados para esta máquina com os filtros atuais.</div> : null}
      <TablePagination page={page} total={programming.data?.total ?? 0} limit={7} onChange={setPage} />
    </section>
    {selectedItem ? <section className="theme-details-panel overflow-hidden rounded-xl border-2 border-[#b8dec7] bg-[linear-gradient(105deg,#eaf8ef_0%,#ffffff_46%,#e1f5e8_100%)] shadow-[0_8px_22px_rgba(31,81,58,.08)]"><div className="grid gap-px bg-[#b8dec7] lg:grid-cols-2"><div className="bg-white/90 px-5 py-3"><span className="block text-[10px] font-black uppercase tracking-[.14em] text-[#37745b]">Ajuste largura</span><span className="mt-1 block font-mono text-2xl font-black tracking-tight text-[#135440]">{displayValue(selectedItem.adjustmentWidth)} <span className="text-lg text-[#638574]">· total {displayValue(selectedItem.adjustmentWidthTotal)}</span></span></div><div className="bg-white/90 px-5 py-3"><span className="block text-[10px] font-black uppercase tracking-[.14em] text-[#37745b]">Ajuste comprimento</span><span className="mt-1 block font-mono text-2xl font-black tracking-tight text-[#135440]">{displayValue(selectedItem.adjustmentLength)} <span className="text-lg text-[#638574]">· total {displayValue(selectedItem.adjustmentLengthTotal)}</span></span></div></div><div className="theme-tooling-panel flex flex-col gap-3 border-t border-[#c8e5d2] bg-[linear-gradient(100deg,#f6fff8,#fff9e9,#effcf3)] px-5 py-3 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[.14em] text-[#5e7e6d]">Cores</span>{selectedPrintLayout.data?.colors?.length ? selectedPrintLayout.data.colors.map((color) => <span key={`${color.order}-${color.description}`} className="rounded-md border-2 border-white px-3 py-1.5 text-sm font-black text-white shadow-[0_2px_5px_rgba(0,0,0,.16)]" style={{ backgroundColor: safeColor(color.hexWhite) }}>{color.description}</span>) : <span className="text-sm font-bold text-[#71867a]">—</span>}</div><div className="h-8 border-l border-[#d8c998]" /><div className="flex flex-wrap items-center gap-2"><span className="theme-tooling-label text-[10px] font-black uppercase tracking-[.14em] text-[#796833]">Ferramentais</span><span className="theme-tooling-chip rounded-lg border border-[#d5bd72] bg-white px-3 py-1.5 text-sm font-black text-[#66521c]">Clichê: {selectedPrintLayout.data?.cliches?.length ? selectedPrintLayout.data.cliches.map((item) => `${item.code}/${item.series}`).join(" · ") : "—"}</span><span className="theme-tooling-chip rounded-lg border border-[#d5bd72] bg-white px-3 py-1.5 text-sm font-black text-[#66521c]">Faca: {selectedPrintLayout.data?.facas?.length ? selectedPrintLayout.data.facas.map((item) => item.code).join(" · ") : "—"}</span></div></div></section> : null}
    <section className="theme-toolbar sticky bottom-0 z-20 overflow-x-auto rounded-xl border-2 border-[#2b8c69] bg-[linear-gradient(100deg,#0c513e_0%,#19795a_48%,#0f6049_100%)] p-2 shadow-[0_-8px_24px_rgba(24,65,48,.2)]"><div className="flex min-w-max gap-2"><OperatorCallButton label="Atualizar" shortcut="" icon={<RefreshCw className="h-4 w-4" />} tone="green" onClick={refreshProgramming} /><OperatorCallButton label="Pacotes / Paletização" shortcut="F4" icon={<Package className="h-4 w-4" />} tone="green" disabled={!selectedItem} onClick={() => setShowPalletization(true)} /><OperatorCallButton label="Visualizar layout" shortcut="F5" icon={<FileImage className="h-4 w-4" />} tone="green" disabled={!selectedItem} onClick={() => setShowPrintLayout(true)} /><OperatorCallButton label="Reserva" shortcut="F7" icon={<Boxes className="h-4 w-4" />} tone="yellow" disabled={!selectedItem} onClick={() => setShowReservation(true)} /><OperatorCallButton label="Qtde aprovada" shortcut="F8" icon={<ClipboardCheck className="h-4 w-4" />} tone="yellow" disabled={!selectedItem} onClick={() => setShowApprovedQuantities(true)} /><OperatorCallButton label="Solicitações" shortcut="F9" icon={<ClipboardCheck className="h-4 w-4" />} tone="yellow" onClick={() => setShowRequests(true)} /><OperatorCallButton label="Etiqueta de processo" shortcut="F10" icon={<Barcode className="h-4 w-4" />} tone="purple" disabled={!selectedItem} onClick={() => setShowProcessLabel(true)} /><div className="ml-auto flex gap-2"><Button onClick={manualPointing ? signOut : operator ? () => setShowExitOptions(true) : signOut} className="h-9 shrink-0 rounded-lg bg-[#cf3f3f] px-4 text-sm font-bold text-white hover:bg-[#ad2e2e]"><Power className="mr-2 h-4 w-4" />Fechar</Button></div></div></section>
    <Dialog open={showMachineSearch} onOpenChange={setShowMachineSearch}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Selecionar máquina controlada</DialogTitle><DialogDescription>Escolha a máquina para consultar a programação.</DialogDescription></DialogHeader><Input value={machineSearch} onChange={(event) => setMachineSearch(event.target.value)} placeholder="Buscar por código ou descrição" /><div className="max-h-96 space-y-2 overflow-y-auto">{controlledMachines.data?.filter((item) => `${item.code} ${item.description}`.toLocaleLowerCase("pt-BR").includes(machineSearch.toLocaleLowerCase("pt-BR"))).map((item) => <button key={item.code} onClick={() => { selectProgrammerMachine(item.code); setShowMachineSearch(false); }} className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left hover:border-[#177458] hover:bg-[#eefaf2]"><span className="font-bold text-[#254536]">{item.description}</span><span className="font-mono text-xs text-[#5f786a]">Código {item.code}</span></button>)}</div><DialogFooter><Button onClick={() => setShowMachineSearch(false)} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Fechar</Button></DialogFooter></DialogContent></Dialog>
    <StationConfigurationDialog open={showStationConfiguration} onOpenChange={setShowStationConfiguration} search={stationSearch} onSearchChange={setStationSearch} stations={loginStations.data ?? []} loading={loginStations.isLoading} error={loginStations.error} onSelect={configureStation} />
    <Dialog open={Boolean(processTransfer)} onOpenChange={(open) => { if (!open && !changeProcess.isPending) { setProcessTransfer(null); setSelectedTargetMachineCode(null); } }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Alterar processo</DialogTitle><DialogDescription>Selecione a máquina elegível para transferir a OP {processTransfer?.opCodigo ?? ""}{processTransfer?.reference ? ` · ${processTransfer.reference}` : ""}. A lista respeita o produto, a revisão e o grupo produtivo do legado.</DialogDescription></DialogHeader>{eligibleProcessMachines.isLoading ? <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">Consultando máquinas elegíveis…</p> : eligibleProcessMachines.data?.length ? <div className="grid max-h-[420px] gap-3 overflow-y-auto sm:grid-cols-2">{eligibleProcessMachines.data.map((candidate) => <button key={candidate.code} onClick={() => setSelectedTargetMachineCode(candidate.code)} className={`rounded-xl border-2 p-4 text-left transition ${selectedTargetMachineCode === candidate.code ? "border-[#177458] bg-[#eefaf2] shadow-[0_0_0_3px_rgba(23,116,88,.12)]" : "border-[#d7e4da] bg-white hover:border-[#8fc59f]"}`}><span className="block text-base font-black text-[#254536]">{candidate.description}</span><span className="mt-1 block font-mono text-xs font-semibold text-[#5d7568]">Código {candidate.code}</span></button>)}</div> : <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">Não há outra máquina elegível para o produto, revisão e grupo produtivo desta OP.</p>}<DialogFooter><Button onClick={() => { setProcessTransfer(null); setSelectedTargetMachineCode(null); }} disabled={changeProcess.isPending} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Cancelar</Button><Button disabled={!processTransfer || !selectedTargetMachineCode || changeProcess.isPending} onClick={() => processTransfer && selectedTargetMachineCode && changeProcess.mutate({ opCodigo: processTransfer.opCodigo, mpCodigo: processTransfer.mpCodigo, machineCode: selectedTargetMachineCode })} className="bg-[#177458] text-white hover:bg-[#105f49]">{changeProcess.isPending ? "Transferindo…" : "Confirmar transferência"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showExitOptions} onOpenChange={setShowExitOptions}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Encerrar operação da máquina</DialogTitle><DialogDescription>Escolha a ação desejada para esta estação. Limpeza e fim de período serão gravados no fluxo de ociosidade após a confirmação dos campos do legado.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><button onClick={() => { setShowExitOptions(false); setShowCleaning(true); }} className="min-h-40 rounded-xl border-2 border-[#b8d9c0] bg-[#f2fbf5] p-5 text-center transition hover:-translate-y-0.5 hover:border-[#177458]"><Sparkles className="mx-auto h-10 w-10 text-[#177458]" /><span className="mt-3 block text-lg font-black text-[#254536]">Iniciar limpeza</span><span className="mt-1 block text-xs font-semibold text-[#5d7568]">Selecionar motivo de limpeza</span></button><button onClick={signOut} className="min-h-40 rounded-xl border-2 border-[#b8d9c0] bg-[#f5faf6] p-5 text-center transition hover:-translate-y-0.5 hover:border-[#177458]"><UsersRound className="mx-auto h-10 w-10 text-[#177458]" /><span className="mt-3 block text-lg font-black text-[#254536]">Trocar operador</span><span className="mt-1 block text-xs font-semibold text-[#5d7568]">Encerrar o acesso atual</span></button><button onClick={() => toast.info("Fim do período", { description: "A gravação em MOTIVOS_OCIOSIDADE será ativada após o mapeamento dos campos legados." })} className="min-h-40 rounded-xl border-2 border-[#e3cc85] bg-[#fffaf0] p-5 text-center transition hover:-translate-y-0.5 hover:border-[#bb7515]"><TimerReset className="mx-auto h-10 w-10 text-[#a87012]" /><span className="mt-3 block text-lg font-black text-[#5d471d]">Fim do período</span><span className="mt-1 block text-xs font-semibold text-[#80672c]">Encerrar o período da máquina</span></button><button onClick={() => setShowExitOptions(false)} className="min-h-40 rounded-xl border-2 border-[#e1b3b3] bg-[#fff5f5] p-5 text-center transition hover:-translate-y-0.5 hover:border-[#cf3f3f]"><Ban className="mx-auto h-10 w-10 text-[#cf3f3f]" /><span className="mt-3 block text-lg font-black text-[#722c2c]">Cancelar</span><span className="mt-1 block text-xs font-semibold text-[#8d5a5a]">Voltar à programação</span></button></div><DialogFooter><Button onClick={() => setShowExitOptions(false)} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Fechar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showCleaning} onOpenChange={setShowCleaning}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Checklist de limpeza</DialogTitle><DialogDescription>Selecione o motivo de limpeza. A gravação de ociosidade será conectada após o mapeamento da tabela MOTIVOS_OCIOSIDADE.</DialogDescription></DialogHeader>{cleaningReasons.isLoading ? <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">Consultando motivos de limpeza…</p> : cleaningReasons.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{cleaningReasons.data.map((reason) => <button key={reason.code} onClick={() => setSelectedCleaningReason(reason.code)} className={`rounded-xl border-2 p-4 text-left font-bold transition ${selectedCleaningReason === reason.code ? "border-[#177458] bg-[#eefaf2] text-[#164c37]" : "border-[#d7e4da] bg-white text-[#466052] hover:border-[#8fc59f]"}`}>{reason.description}</button>)}</div> : <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">Nenhum motivo de limpeza foi encontrado para esta máquina.</p>}<DialogFooter><Button onClick={() => setShowCleaning(false)} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Cancelar</Button><Button disabled={!selectedCleaningReason} onClick={() => toast.info("Motivo de limpeza selecionado", { description: "O registro será ativado após o mapeamento de MOTIVOS_OCIOSIDADE." })} className="bg-[#177458] text-white hover:bg-[#105f49]">Confirmar limpeza</Button></DialogFooter></DialogContent></Dialog>
    {queueMessage ? <OperationalMessageDialog open tone="caution" title={queueMessage.title} description={queueMessage.description} onClose={reloadAfterQueueWarning} /> : null}
    <ProductPalletizationDialog open={showPalletization} onOpenChange={setShowPalletization} data={selectedPalletization.data} loading={selectedPalletization.isLoading} error={selectedPalletization.error} productLabel={selectedItem?.referencia ?? undefined} />
    <ProductPrintLayoutDialog open={showPrintLayout} onOpenChange={setShowPrintLayout} data={selectedPrintLayout.data} loading={selectedPrintLayout.isLoading} error={selectedPrintLayout.error} productLabel={selectedItem?.productCode === undefined ? undefined : String(selectedItem.productCode)} revision={selectedItem?.revision} />
    <ProductReservationDialog open={showReservation} onOpenChange={setShowReservation} opCode={selectedItem?.op_codigo} data={selectedReservations.data} loading={selectedReservations.isLoading} error={selectedReservations.error} />
    <ApprovedProcessQuantitiesDialog open={showApprovedQuantities} onOpenChange={setShowApprovedQuantities} data={selectedApprovedQuantities.data} loading={selectedApprovedQuantities.isLoading} error={selectedApprovedQuantities.error} />
    <RequestDialog open={showRequests} onOpenChange={setShowRequests} />
    <ProcessLabelDialog open={showProcessLabel} onOpenChange={setShowProcessLabel} data={selectedLabel.data} loading={selectedLabel.isLoading} error={selectedLabel.error} printers={localPrinters.data?.printers ?? []} printerSource={localPrinters.data?.source} />
  </div>;
}

function StationConfigurationDialog({ open, onOpenChange, search, onSearchChange, stations, loading, error, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; search: string; onSearchChange: (value: string) => void; stations: Array<{ code: number; description: string }>; loading: boolean; error: { message: string } | null | undefined; onSelect: (machineCode: number) => Promise<void> }) {
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visibleStations = stations.filter((station) => `${station.code} ${station.description}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl" onInteractOutside={(event) => event.preventDefault()}><DialogHeader><DialogTitle>Configurar estação deste navegador</DialogTitle><DialogDescription>Esta ação é exclusiva para PCP, Programador ou Administrador. A máquina escolhida será salva somente neste navegador; em seguida, o acesso será encerrado para que o próximo usuário entre pela estação configurada.</DialogDescription></DialogHeader><Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por código ou descrição" autoFocus /><div className="max-h-[420px] space-y-2 overflow-y-auto">{loading ? <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">Consultando estações ativas…</p> : error ? <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">Não foi possível listar as estações. Verifique a conexão com o proxy local.</p> : visibleStations.length ? visibleStations.map((station) => <button key={station.code} onClick={() => void onSelect(station.code)} className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left transition hover:border-[#177458] hover:bg-[#eefaf2]"><span className="font-bold text-[#254536]">{station.description}</span><span className="font-mono text-xs text-[#5f786a]">Código {station.code}</span></button>) : <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">Nenhuma estação encontrada.</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)} className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Cancelar</Button></DialogFooter></DialogContent></Dialog>;
}

function OperatorCallButton({ label, shortcut, icon, tone, disabled, onClick }: { label: string; shortcut: string; icon: React.ReactNode; tone: "green" | "yellow" | "purple"; disabled?: boolean; onClick: () => void }) {
  const styles = { green: "border-[#4d956f] bg-[#f6fcf8] text-[#286449] hover:bg-[#eaf7ee]", yellow: "border-[#d4b955] bg-[#fffdf5] text-[#80651a] hover:bg-[#fff6d9]", purple: "border-[#9c70ba] bg-[#fdfaff] text-[#6c4688] hover:bg-[#f5ecfb]" };
  return <Button variant="outline" disabled={disabled} onClick={onClick} className={`h-9 shrink-0 gap-2 rounded-lg border-2 px-3 text-sm font-semibold ${styles[tone]} theme-btn-soft`}><span>{icon}</span>{label}<span className="rounded border border-current/30 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-black leading-none">{shortcut}</span></Button>;
}

function requestStatusClass(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLocaleLowerCase("pt-BR");
  if (normalized === "atendido") return "bg-[#dcf5e7] text-[#176b43]";
  if (normalized === "separado" || normalized === "transbordo") return "bg-[#dceeff] text-[#155c99]";
  if (normalized === "solicitado") return "bg-[#fff0b8] text-[#805900]";
  return "bg-[#eff1ee] text-[#687169]";
}
