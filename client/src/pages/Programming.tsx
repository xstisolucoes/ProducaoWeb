import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import {
  ConnectionNotice,
  displayValue,
  LoadingRows,
  PageHeading,
  processStatusClass,
  SortableHeader,
  StatusPill,
  TablePagination,
  useGridSort,
} from "@/components/ProductionPrimitives";
import {
  ProductPalletizationDialog,
  ProductPrintLayoutDialog,
} from "@/components/ProductVisualDialogs";
import { ProductReservationDialog } from "@/components/ProductReservationDialog";
import { ApprovedProcessQuantitiesDialog } from "@/components/ApprovedProcessQuantitiesDialog";
import { RequestDialog } from "@/components/RequestDialog";
import { ProcessLabelDialog } from "@/components/ProcessLabelDialog";
import { ProductFinishedLabelDialog } from "@/components/ProductFinishedLabelDialog";
import { SpecialProductionDialog } from "@/components/SpecialProductionDialog";
import { OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { useTheme } from "@/contexts/ThemeContext";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Ban,
  Barcode,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileImage,
  ListOrdered,
  Package,
  Play,
  Power,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Tag,
  TimerReset,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString("pt-BR");
}

function safeColor(value: string | null | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#3d725e";
}

function isColadeiraMachineGroup(groupName: string | null | undefined) {
  return String(groupName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .includes("COLADEIRA");
}

function isApontamentoMachineGroup(groupName: string | null | undefined) {
  return String(groupName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .includes("APONTAMENTO");
}

const PROGRAMMER_MACHINE_CACHE_KEY = "production-programming-machine-code";
const STATION_MACHINE_CACHE_KEY = "production-station-machine-code";
const MANUAL_MACHINE_CACHE_KEY = "production-manual-machine-code";
const OPERATIONAL_STATUS_FILTER_OPTIONS = [
  "Liberado",
  "Parcial",
  "Em Produção",
];

function firstDisplayName(name: string | null | undefined) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)[0] || "—"
  );
}

type QueueMessage = { title: string; description: string };

function operationalQueueMessage(
  message: string | null | undefined
): QueueMessage {
  const detail = String(message ?? "").trim();
  if (/processo em produção na fila 1/i.test(detail)) {
    return {
      title: "Alteração Não Permitida",
      description:
        "Existe um Processo em Produção na Fila 1. Conclua-o Antes de Alterar a Prioridade da Fila.",
    };
  }
  if (/processo A Concluir na fila 1/i.test(detail)) {
    return {
      title: "Alteração Não Permitida",
      description:
        "Existe um Processo A Concluir na Fila 1. Conclua-o Antes de Alterar a Prioridade da Fila.",
    };
  }
  if (/processo Setup a Concluir na fila 1/i.test(detail)) {
    return {
      title: "Alteração Não Permitida",
      description:
        "Existe um Processo Setup a Concluir na Fila 1. Conclua o Setup Antes de Alterar a Prioridade da Fila.",
    };
  }
  if (
    !detail ||
    /(firebird|proxy|network|fetch|http|timeout|conexão|indisponível)/i.test(
      detail
    )
  ) {
    return {
      title: "Alteração Não Permitida",
      description:
        "Não Foi Possível Alterar a Fila Neste Momento. Verifique a Programação e Tente Novamente.",
    };
  }
  return { title: "Alteração Não Permitida", description: detail };
}

export default function Programming() {
  const { user, logout } = useLocalAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [releaseStartedOnly, setReleaseStartedOnly] = useState(false);
  const [selectedMachineCode, setSelectedMachineCode] = useState<number | null>(
    () => {
      if (typeof window === "undefined") return user?.machine?.code ?? null;
      const cachedCode = Number(
        window.localStorage.getItem(PROGRAMMER_MACHINE_CACHE_KEY)
      );
      return Number.isInteger(cachedCode) && cachedCode > 0
        ? cachedCode
        : (user?.machine?.code ?? null);
    }
  );
  const [statusFilter, setStatusFilter] = useState("A Lib/Lib/Parcial");
  const [showMachineSearch, setShowMachineSearch] = useState(false);
  const [machineSearch, setMachineSearch] = useState("");
  const [showStationConfiguration, setShowStationConfiguration] = useState(
    () => {
      if (typeof window === "undefined") return false;
      const stationCode = Number(
        window.localStorage.getItem(STATION_MACHINE_CACHE_KEY)
      );
      return !Number.isInteger(stationCode) || stationCode < 1;
    }
  );
  const [stationSearch, setStationSearch] = useState("");
  const [queueValues, setQueueValues] = useState<Record<string, string>>({});
  const [selectedProcess, setSelectedProcess] = useState<{
    opCode: number;
    masterOrder: number | null;
  } | null>(null);
  const [showExitOptions, setShowExitOptions] = useState(false);
  const [showCleaning, setShowCleaning] = useState(false);
  const [showEndPeriodConfirm, setShowEndPeriodConfirm] = useState(false);
  const [selectedCleaningReason, setSelectedCleaningReason] = useState<
    number | null
  >(null);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [showApprovedQuantities, setShowApprovedQuantities] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showProcessLabel, setShowProcessLabel] = useState(false);
  const [showProductFinishedLabel, setShowProductFinishedLabel] =
    useState(false);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [showSpecialSet, setShowSpecialSet] = useState(false);
  const [queueMessage, setQueueMessage] = useState<QueueMessage | null>(null);
  const [processTransfer, setProcessTransfer] = useState<{
    opCodigo: number;
    mpCodigo: number;
    reference: string | null;
  } | null>(null);
  const [selectedTargetMachineCode, setSelectedTargetMachineCode] = useState<
    number | null
  >(null);
  const operator = [
    "operator",
    "manual-pointing",
    "manual-production",
    "quality-release",
  ].includes(user?.operationalProfile ?? "");
  const manualPointing = [
    "manual-pointing",
    "manual-production",
    "quality-release",
  ].includes(user?.operationalProfile ?? "");
  const manualProduction = user?.operationalProfile === "manual-production";
  const qualityRelease = user?.operationalProfile === "quality-release";
  const programmer = user?.operationalProfile === "programmer";
  const stationConfigurator = user?.canConfigureStation === true;
  const { brandTheme } = useTheme();
  const machine = user?.machine;
  const controlledMachines = trpc.production.programming.machines.useQuery(
    undefined,
    { enabled: programmer, retry: false }
  );
  const manualMachines = trpc.localAuth.manualMachines.useQuery(undefined, {
    enabled: manualProduction && showMachineSearch,
    retry: false,
  });
  const loginStations = trpc.localAuth.stations.useQuery(undefined, {
    enabled: stationConfigurator && showStationConfiguration,
    retry: false,
  });
  const persistStation = trpc.localAuth.persistStation.useMutation();
  const switchManualMachine = trpc.localAuth.switchManualMachine.useMutation({
    onSuccess: async ({ machine: nextMachine }) => {
      window.localStorage.setItem(
        MANUAL_MACHINE_CACHE_KEY,
        String(nextMachine.code)
      );
      setShowMachineSearch(false);
      setSelectedProcess(null);
      toast.info("Máquina/Processo Selecionada", {
        description: `Entre Novamente para Operar em ${nextMachine.description}.`,
      });
      await logout();
      setLocation("/");
    },
    onError: error =>
      toast.error("Não Foi Possível Trocar a Máquina/Processo", {
        description: error.message,
      }),
  });
  const activeMachineCode = operator
    ? (machine?.code ?? null)
    : selectedMachineCode;
  const activeMachine = programmer
    ? (controlledMachines.data?.find(
        item => Number(item.code) === Number(activeMachineCode)
      ) ?? null)
    : machine;
  const coladeiraMachine =
    operator && isColadeiraMachineGroup(machine?.groupDescription);
  const pointingMachine =
    operator && isApontamentoMachineGroup(machine?.groupDescription);
  const programmingLimit =
    qualityRelease || (operator && !manualPointing) ? 8 : 7;
  const operationalStatusFilter =
    manualPointing || coladeiraMachine
      ? statusFilter
      : operator
        ? "Todos"
        : statusFilter;
  const programming = trpc.production.programming.list.useQuery(
    {
      page,
      limit: programmingLimit,
      search,
      machineCode: activeMachineCode ?? undefined,
      status: operationalStatusFilter,
      releaseStartedOnly: qualityRelease && releaseStartedOnly,
    },
    { enabled: Boolean(activeMachineCode), retry: false }
  );
  const {
    sortedItems: sortedProgrammingItems,
    sortKey: programmingSortKey,
    sortDirection: programmingSortDirection,
    toggleSort: toggleProgrammingSort,
  } = useGridSort(programming.data?.items);
  const activeProduction = trpc.production.programming.active.useQuery(
    undefined,
    {
      enabled: Boolean(user?.machine) && operator && !manualPointing,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const processSequence = trpc.production.queue.processes.useQuery(
    {
      opCode: selectedProcess?.opCode ?? 1,
      masterOrder: selectedProcess?.masterOrder ?? null,
    },
    { enabled: Boolean(selectedProcess), retry: false }
  );
  const cleaningReasons = trpc.production.programming.cleaningReasons.useQuery(
    undefined,
    { enabled: showCleaning && Boolean(user?.machine), retry: false }
  );
  const selectedItem =
    sortedProgrammingItems.find(
      item => item.op_codigo === selectedProcess?.opCode
    ) ?? sortedProgrammingItems[0];
  const selectedCodes = selectedItem
    ? { opCodigo: selectedItem.op_codigo, mpCodigo: selectedItem.mp_codigo }
    : null;
  const selectedPalletization = trpc.production.pointing.palletization.useQuery(
    selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
    { enabled: showPalletization && Boolean(selectedCodes), retry: false }
  );
  const selectedReservations = trpc.production.queue.reservations.useQuery(
    { opCode: selectedItem?.op_codigo ?? 1 },
    { enabled: showReservation && Boolean(selectedItem), retry: false }
  );
  const selectedApprovedQuantities =
    trpc.production.pointing.approvedQuantities.useQuery(
      selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
      {
        enabled: showApprovedQuantities && Boolean(selectedCodes),
        retry: false,
      }
    );
  const selectedLabel = trpc.production.pointing.processLabel.useQuery(
    selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
    { enabled: showProcessLabel && Boolean(selectedCodes), retry: false }
  );
  const selectedProductFinishedLabel =
    trpc.production.pointing.productFinishedLabel.useQuery(
      selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
      {
        enabled: showProductFinishedLabel && Boolean(selectedCodes),
        retry: false,
      }
    );
  const selectedReleasePlan =
    trpc.production.pointing.productReleasePlan.useQuery(
      selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
      { enabled: qualityRelease && Boolean(selectedCodes), retry: false }
    );
  const selectedSpecialProduction =
    trpc.production.pointing.specialProduction.useQuery(
      {
        ...(selectedCodes ?? { opCodigo: 1, mpCodigo: 1 }),
        machineCode: activeMachineCode ?? undefined,
      },
      {
        enabled: Boolean(selectedCodes) && Boolean(activeMachineCode),
        retry: false,
      }
    );
  const selectedPrintLayout = trpc.production.pointing.printLayout.useQuery(
    selectedCodes ?? { opCodigo: 1, mpCodigo: 1 },
    { enabled: Boolean(selectedCodes), retry: false }
  );
  const eligibleProcessMachines =
    trpc.production.programming.eligibleMachines.useQuery(
      processTransfer ?? { opCodigo: 1, mpCodigo: 1 },
      { enabled: Boolean(processTransfer), retry: false }
    );
  const localPrinters = trpc.production.printers.list.useQuery(undefined, {
    enabled: showProcessLabel || showProductFinishedLabel,
    retry: false,
  });
  const recoveredProcess = useRef<string | null>(null);
  const mobileProgrammingCarousel = useRef<HTMLDivElement | null>(null);
  const utils = trpc.useUtils();
  const reloadProgrammingPreservingMachine = () => {
    if (typeof window === "undefined") return;
    const machineCode = activeMachine?.code ?? selectedMachineCode;
    if (
      programmer &&
      Number.isInteger(Number(machineCode)) &&
      Number(machineCode) > 0
    ) {
      window.localStorage.setItem(
        PROGRAMMER_MACHINE_CACHE_KEY,
        String(machineCode)
      );
    }
    window.location.reload();
  };
  const updateQueue = trpc.production.programming.changeQueue.useMutation({
    onSuccess: async result => {
      await utils.production.programming.list.invalidate();
      const statusMessage = result.releasedFromQueue2000
        ? " e Liberada para Produção."
        : result.releasedFromPartial
          ? " e Atualizada de Parcial para Liberado."
          : ".";
      toast.success("Fila Reorganizada.", {
        description: `A Ordem Foi Posicionada na Fila ${result.queue}${statusMessage}`,
      });
      window.setTimeout(reloadProgrammingPreservingMachine, 180);
    },
    onError: error => setQueueMessage(operationalQueueMessage(error.message)),
  });
  const changeProcess = trpc.production.programming.changeProcess.useMutation({
    onSuccess: async result => {
      await utils.production.programming.list.invalidate();
      setProcessTransfer(null);
      setSelectedTargetMachineCode(null);
      toast.success(`Processo Alterado. Nova Fila: ${result.queue}.`);
    },
    onError: error => setQueueMessage(operationalQueueMessage(error.message)),
  });
  const resumeToConclude = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.production.programming.list.invalidate();
      toast.success("Produção Retomada. Novo Ciclo de Horário Registrado.");
      setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`);
    },
    onError: error =>
      toast.error("Não Foi Possível Retomar A Concluir", {
        description: error.message,
      }),
  });
  const startNewSetup = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.production.programming.list.invalidate();
      toast.success("Setup Iniciado com o Horário do Cronômetro Diário.");
      setLocation(`/apontamento/${variables.opCodigo}/${variables.mpCodigo}`);
    },
    onError: error =>
      toast.error("Não Foi Possível Iniciar o Setup", {
        description: error.message,
      }),
  });
  const recordIdleEvent =
    trpc.production.programming.recordIdleEvent.useMutation({
      onSuccess: async (result, variables) => {
        await utils.production.programming.list.invalidate();
        setShowCleaning(false);
        setShowExitOptions(false);
        setShowEndPeriodConfirm(false);
        setSelectedCleaningReason(null);
        toast.success(
          variables.eventType === "cleaning"
            ? "Limpeza Registrada"
            : "Fim do Período Registrado",
          {
            description:
              variables.eventType === "cleaning"
                ? "O Motivo de Limpeza Foi Gravado no Histórico de Ociosidade da Máquina/Processo."
                : `Motivo ${result.reasonCode} Gravado no Histórico de Ociosidade.`,
          }
        );
        if (variables.eventType === "end-period") await signOut();
      },
      onError: error =>
        toast.error("Não Foi Possível Registrar a Ociosidade", {
          description: error.message,
        }),
    });
  const hasPriorityToConclude =
    operator &&
    !manualPointing &&
    !coladeiraMachine &&
    Boolean(
      programming.data?.items.some(
        item => item.status === "A Concluir" && Number(item.fila) === 1
      )
    );

  useEffect(() => {
    if (
      (manualPointing || coladeiraMachine) &&
      !OPERATIONAL_STATUS_FILTER_OPTIONS.includes(statusFilter)
    )
      setStatusFilter("Liberado");
  }, [manualPointing, coladeiraMachine, statusFilter]);

  useEffect(() => {
    const active = activeProduction.data;
    if (!operator || manualPointing || !active) return;
    const key = `${active.opCodigo}-${active.mpCodigo}`;
    if (recoveredProcess.current === key) return;
    recoveredProcess.current = key;
    toast.warning("OP em Produção Recuperada", {
      description: `Existe a OP ${active.opCodigo} em Produção Nesta Máquina. Você Será Direcionado ao Apontamento para Continuar ou Finalizar o Processo.`,
      duration: 7000,
    });
    setLocation(
      `${manualPointing ? "/apontamento-manual" : "/apontamento"}/${active.opCodigo}/${active.mpCodigo}`
    );
  }, [activeProduction.data, manualPointing, operator, setLocation]);

  useEffect(() => {
    const first = programming.data?.items[0];
    if (!first || selectedProcess) return;
    setSelectedProcess({
      opCode: first.op_codigo,
      masterOrder: first.master_order ?? null,
    });
  }, [programming.data?.items, selectedProcess]);

  useEffect(() => {
    if (!programmer || !selectedItem) return;
    const card = mobileProgrammingCarousel.current?.querySelector<HTMLElement>(
      `[data-mobile-programming-card="${selectedItem.op_codigo}-${selectedItem.mp_codigo}"]`
    );
    if (!card) return;
    const frame = window.requestAnimationFrame(() =>
      card.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    );
    return () => window.cancelAnimationFrame(frame);
  }, [programmer, selectedItem?.mp_codigo, selectedItem?.op_codigo]);

  useEffect(() => {
    if (!programmer || !controlledMachines.data?.length) return;
    const selectedIsAvailable =
      selectedMachineCode !== null &&
      controlledMachines.data.some(
        item => Number(item.code) === Number(selectedMachineCode)
      );
    if (selectedIsAvailable) return;
    const fallbackCode = Number(controlledMachines.data[0].code);
    setSelectedMachineCode(fallbackCode);
    window.localStorage.setItem(
      PROGRAMMER_MACHINE_CACHE_KEY,
      String(fallbackCode)
    );
  }, [controlledMachines.data, programmer, selectedMachineCode]);

  useEffect(() => {
    setSelectedProcess(null);
    setPage(1);
  }, [activeMachineCode, statusFilter, releaseStartedOnly]);

  const closeStation = () => {
    window.close();
    window.setTimeout(
      () =>
        toast.info(
          "Para Fechar Esta Máquina/Processo, Feche a Janela do Navegador."
        ),
      250
    );
  };

  const signOut = async () => {
    await logout();
    setLocation("/");
  };

  const selectProgrammerMachine = (machineCode: number) => {
    const normalizedCode = Number(machineCode);
    setSelectedMachineCode(normalizedCode);
    window.localStorage.setItem(
      PROGRAMMER_MACHINE_CACHE_KEY,
      String(normalizedCode)
    );
  };

  const configureStation = async (machineCode: number) => {
    try {
      await persistStation.mutateAsync({ machineCode });
      window.localStorage.setItem(
        STATION_MACHINE_CACHE_KEY,
        String(machineCode)
      );
      setShowStationConfiguration(false);
      await logout();
      setLocation("/");
    } catch (error) {
      toast.error("Não Foi Possível Gravar a Máquina/Processo", {
        description:
          error instanceof Error ? error.message : "Tente Novamente.",
      });
    }
  };

  const refreshProgramming = async () => {
    await programming.refetch();
    toast.success("Programação Atualizada", {
      description: `Fila Recarregada para ${activeMachine?.description ?? "a Máquina Selecionada"}.`,
    });
  };

  const reloadAfterQueueWarning = () => {
    setQueueMessage(null);
    reloadProgrammingPreservingMachine();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const renderProgrammerMobileCard = (
    item: (typeof sortedProgrammingItems)[number]
  ) => {
    const key = `${item.op_codigo}-${item.mp_codigo}`;
    const desiredQueue = queueValues[key] ?? String(item.fila ?? "");
    const selected =
      selectedProcess?.opCode === item.op_codigo &&
      selectedItem?.mp_codigo === item.mp_codigo;
    const processSituation =
      item.reservedStatus || item.processSituation || item.processPosition;
    return (
      <article
        key={key}
        data-mobile-programming-card={key}
        onClick={() =>
          setSelectedProcess({
            opCode: item.op_codigo,
            masterOrder: item.master_order ?? null,
          })
        }
        className={`w-[calc(100vw-3.5rem)] max-w-md shrink-0 snap-center rounded-xl border-2 p-4 shadow-sm transition ${selected ? "border-[#177458] bg-[#effaf2] shadow-[0_0_0_3px_rgba(23,116,88,.12)]" : "border-[#d9e8de] bg-white"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-black ''tracking-[.14em] text-[#537162]">
              Ordem de Produção
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <strong className="font-mono text-xl font-black text-[#234b39]">
                {item.op_codigo}
              </strong>
              {item.specialPrimary ? (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    setShowSpecialSet(true);
                  }}
                  className="rounded border border-[#d0a534] bg-[#fff4bf] px-2 py-1 text-[10px] font-black ''tracking-wide text-[#725411]"
                >
                  Conjunto
                </button>
              ) : null}
            </div>
          </div>
          <StatusPill status={item.status} />
        </div>
        <div className="mt-3 border-t border-[#e0ece4] pt-3">
          <p className="text-base font-black leading-tight text-[#294737]">
            {displayValue(item.client)}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-[#596a60]">
            {displayValue(item.produto_referencia || item.referencia)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <MobileProgrammingField
            label="Produto"
            value={`${displayValue(item.productCode)} · Rev. ${displayValue(item.revision)}`}
          />
          <MobileProgrammingField
            label="Código do Cliente"
            value={displayValue(item.customerProductCode)}
          />
          <MobileProgrammingField
            label="Quantidade OP"
            value={displayValue(item.quantity)}
          />
          <MobileProgrammingField
            label="Produzida"
            value={displayValue(item.quantidade_produzida)}
          />
          <MobileProgrammingField
            label="Saldo"
            value={displayValue(item.saldo)}
            emphasize
          />
          <MobileProgrammingField
            label="Fila Atual"
            value={displayValue(item.fila)}
          />
          <MobileProgrammingField
            label="Data Exp."
            value={formatDate(item.shipmentDate)}
          />
          <MobileProgrammingField
            label="Data Ent."
            value={formatDate(item.data_entrega)}
          />
        </div>
        <details className="mt-3 rounded-lg border border-[#dbe9df] bg-[#f8fcf9] px-3 py-2">
          <summary className="cursor-pointer text-sm font-black text-[#315842]">
            Ver Situação e Solicitação
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MobileProgrammingField
              label="Situação M.P."
              value={displayValue(processSituation)}
            />
            <MobileProgrammingField
              label="Solicitação"
              value={displayValue(item.requestStatus, "Não Solicitada")}
            />
          </div>
        </details>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            value={desiredQueue}
            onChange={event =>
              setQueueValues(current => ({
                ...current,
                [key]: event.target.value,
              }))
            }
            inputMode="numeric"
            aria-label={`Nova Fila da OP ${item.op_codigo}`}
            className="h-11 font-mono text-base"
          />
          <Button
            disabled={updateQueue.isPending}
            onClick={() => {
              const queue = Number(desiredQueue);
              if (!Number.isInteger(queue) || queue < 1) {
                setQueueMessage(
                  operationalQueueMessage("Informe uma Posição de Fila Válida.")
                );
                return;
              }
              if (!activeMachine?.code) {
                setQueueMessage(
                  operationalQueueMessage(
                    "Selecione uma Máquina para Reorganizar a Fila."
                  )
                );
                return;
              }
              updateQueue.mutate({
                opCodigo: item.op_codigo,
                mpCodigo: item.mp_codigo,
                machineCode: Number(activeMachine.code),
                queue,
              });
            }}
            className="h-11 bg-[#177458] px-4 text-sm font-black text-white hover:bg-[#105f49]"
          >
            <Settings2 className="mr-1.5 h-4 w-4" />
            Fila
          </Button>
        </div>
        <Button
          variant="outline"
          disabled={
            changeProcess.isPending ||
            ["Atendido", "A Concluir", "Setup a Concluir"].includes(
              item.status ?? ""
            )
          }
          onClick={() => {
            setSelectedTargetMachineCode(null);
            setProcessTransfer({
              opCodigo: item.op_codigo,
              mpCodigo: item.mp_codigo,
              reference: item.referencia ?? item.produto_referencia ?? null,
            });
          }}
          className="mt-2 h-11 w-full border-[#9ccbb0] bg-white text-sm font-black text-[#245b42] hover:bg-[#effaf2]"
        >
          Alterar Processo
        </Button>
      </article>
    );
  };

  if (!activeMachine) {
    return (
      <div className="space-y-6">
        <PageHeading
          eyebrow="Programação"
          title={
            stationConfigurator
              ? "Configure a Máquina/Processo"
              : programmer
                ? "Selecione uma Máquina"
                : "Máquina Não Identificada"
          }
          description={
            stationConfigurator
              ? "Defina a Máquina/Processo deste posto. Após salvar, ela ficará gravada na rede e os operadores usarão essa configuração automaticamente, mesmo depois de reiniciar o navegador."
              : programmer
                ? "Escolha uma Máquina Controlada para Consultar a Programação."
                : "O login foi aceito, mas não encontramos uma máquina vinculada a este operador."
          }
        />
        {stationConfigurator ? (
          <Button
            onClick={() => setShowStationConfiguration(true)}
            className="bg-[#177458] text-white hover:bg-[#105f49]"
          >
            Configurar Máquina/Processo
          </Button>
        ) : (
          <Button
            onClick={() => setShowMachineSearch(true)}
            className="bg-[#177458] text-white hover:bg-[#105f49]"
          >
            Selecionar Máquina
          </Button>
        )}
        <StationConfigurationDialog
          open={showStationConfiguration}
          onOpenChange={setShowStationConfiguration}
          search={stationSearch}
          onSearchChange={setStationSearch}
          stations={loginStations.data ?? []}
          loading={loginStations.isLoading}
          error={loginStations.error}
          saving={persistStation.isPending}
          onSelect={configureStation}
        />
        <Dialog open={showMachineSearch} onOpenChange={setShowMachineSearch}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Selecionar Máquina Controlada</DialogTitle>
              <DialogDescription>
                Escolha a máquina para consultar a programação.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={machineSearch}
              onChange={event => setMachineSearch(event.target.value)}
              placeholder="Buscar por Código ou Descrição"
            />
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {controlledMachines.data
                ?.filter(item =>
                  `${item.code} ${item.description}`
                    .toLocaleLowerCase("pt-BR")
                    .includes(machineSearch.toLocaleLowerCase("pt-BR"))
                )
                .map(item => (
                  <button
                    key={item.code}
                    onClick={() => {
                      selectProgrammerMachine(item.code);
                      setShowMachineSearch(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left hover:border-[#177458] hover:bg-[#eefaf2]"
                  >
                    <span className="font-bold text-[#254536]">
                      {item.description}
                    </span>
                    <span className="font-mono text-xs text-[#5f786a]">
                      Código {item.code}
                    </span>
                  </button>
                ))}
            </div>
            <DialogFooter>
              <Button
                onClick={() => setShowMachineSearch(false)}
                className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConnectionNotice error={programming.error} />
      </div>
    );
  }

  return (
    <div
      className={`theme-programming ${programmer ? "programming-programmer" : ""} ${operator ? "flex min-h-dvh flex-col gap-3" : "space-y-4"}`}
    >
      <section className="theme-machine-band overflow-hidden rounded-2xl border text-white shadow-[0_18px_42px_rgba(18,61,51,.18)] [&>div:nth-child(3)]:hidden">
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <div
            className={`flex items-center justify-center overflow-hidden ${brandTheme === "xsti" ? "h-12 w-44" : "h-11 w-11 rounded-xl bg-[#bce7ce] text-[#135a46]"}`}
          >
            {brandTheme === "xsti" ? (
              <img
                src={XPAPER_LOGO_SRC}
                alt="XPAPER"
                className="h-full w-full object-contain object-left"
              />
            ) : (
              <Factory className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-['Tahoma'] text-[12px] ''tracking-[.18em] text-[#b8d8c5]">
              Máquina/Processo
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold tracking-[-.035em]">
                {activeMachine.description}
              </h2>
              {qualityRelease ? (
                <>
                  <span className="rounded-lg border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black ''tracking-wide text-white">
                    Lote {displayValue(selectedReleasePlan.data?.lotSize)}
                  </span>
                  <span className="rounded-lg border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black ''tracking-wide text-white">
                    Amostra {displayValue(selectedReleasePlan.data?.sampleSize)}
                  </span>
                  <span className="rounded-lg border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black ''tracking-wide text-white">
                    N {displayValue(selectedReleasePlan.data?.acceptableLimit)}
                  </span>
                  <span className="rounded-lg border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black ''tracking-wide text-white">
                    NC{" "}
                    {displayValue(selectedReleasePlan.data?.nonConformingLimit)}
                  </span>
                  <span className="rounded-lg border border-white/30 bg-white/12 px-3 py-1.5 text-xs font-black ''tracking-wide text-white">
                    Nível de Inspeção Geral II · N.Q.A. 1,5
                  </span>
                </>
              ) : null}
              {/* {programmer || manualProduction ? ( */}
              {manualProduction ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMachineSearch(true)}
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  Trocar Máquina/Processo
                </Button>
              ) : null}
              {stationConfigurator ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowStationConfiguration(true)}
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  Configurar Máquina/Processo
                </Button>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#cde6d7]">
              Código {activeMachine.code} ·{" "}
              {operator && machine?.followsQueue
                ? "Segue a Fila Operacional"
                : "Máquina Controlada"}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2">
            <ThemeConfigurator compact />
            <div className="min-w-0 border-l border-white/15 pl-3 text-right">
              <p className="theme-tooling-label text-[14px] font-['Tahoma'] ''tracking-[.14em] text-[#b8d8c5]">
                {operator ? "Operador" : "Programador"}
              </p>
              <p className="mt-1 truncate font-semibold">
                {firstDisplayName(user?.name)}
              </p>
            </div>
          </div>
        </div>
        {processSequence.data?.length ? (
          <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2.5">
            {processSequence.data.map(process => (
              <button
                key={`${process.opCode}-${process.mpCode}`}
                onClick={() =>
                  setSelectedProcess({
                    opCode: process.opCode,
                    masterOrder: selectedProcess?.masterOrder ?? null,
                  })
                }
                className={`process-status-card min-w-44 rounded-lg border px-3 py-2 text-left font-['Tahoma] transition ${processStatusClass(process.status)}
                ${process.mpCode === selectedItem?.mp_codigo ? "ring-4 ring-blue/85" : "opacity-90 hover:opacity-100"}`}
              >
                <span className="block truncate text-xs font-extrabold">
                  {process.machineDescription}
                </span>
                <span className="mt-1 block text-[10px] font-semibold">
                  {process.status ?? "Sem Status"}
                  {manualPointing || coladeiraMachine
                    ? ""
                    : ` · Fila ${process.queue ?? "—"}`}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {operator && !manualPointing && selectedItem ? (
          <div className="grid gap-2 border-t border-white/10 bg-black/10 px-4 py-2.5 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr]">
            <div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2">
              <span className="block text-[9px] font-black ''tracking-[.12em] text-[#b8d8c5]">
                Ajuste Largura
              </span>
              <span className="mt-1 block font-mono text-sm font-black text-white">
                {displayValue(selectedItem.adjustmentWidth)}{" "}
                <span className="text-[#b8d8c5]">
                  · Total {displayValue(selectedItem.adjustmentWidthTotal)}
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2">
              <span className="block text-[9px] font-black ''tracking-[.12em] text-[#b8d8c5]">
                Ajuste Comprimento
              </span>
              <span className="mt-1 block font-mono text-sm font-black text-white">
                {displayValue(selectedItem.adjustmentLength)}{" "}
                <span className="text-[#b8d8c5]">
                  · Total {displayValue(selectedItem.adjustmentLengthTotal)}
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2">
              <span className="block text-[9px] font-black ''tracking-[.12em] text-[#b8d8c5]">
                Cores
              </span>
              <div className="mt-1 flex gap-1 overflow-hidden">
                {selectedPrintLayout.data?.colors?.length ? (
                  selectedPrintLayout.data.colors.map(color => (
                    <span
                      key={`${color.order}-${color.description}`}
                      title={color.description}
                      className="h-5 min-w-5 rounded border border-white/60 shadow-sm"
                      style={{ backgroundColor: safeColor(color.hexWhite) }}
                    />
                  ))
                ) : (
                  <span className="text-xs font-bold text-[#e0eee4]">—</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2">
              <span className="block text-[9px] font-black ''tracking-[.12em] text-[#b8d8c5]">
                Clichês / Facas
              </span>
              <span className="mt-1 block truncate text-xs font-bold text-white">
                C:{" "}
                {selectedPrintLayout.data?.cliches?.length
                  ? selectedPrintLayout.data.cliches
                      .map(item => `${item.code}/${item.series}`)
                      .join(" · ")
                  : "—"}{" "}
                <span className="text-[#b8d8c5]">|</span> F:{" "}
                {selectedPrintLayout.data?.facas?.length
                  ? selectedPrintLayout.data.facas
                      .map(item => item.code)
                      .join(" · ")
                  : "—"}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {programming.error ? (
        <ConnectionNotice error={programming.error} />
      ) : null}
      {programmer || qualityRelease ? (
        <section className="theme-filter-band flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm sm:flex-row sm:items-end">
          {programmer ? (
            <>
              <div className="min-w-0 flex-1">
                <label className="mb-1 text-[12px] font-['Tahoma] ''tracking-[.14em] text-[#1d5c47]">
                  Máquina
                </label>
                <button
                  onClick={() => setShowMachineSearch(true)}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-[#a8cfb6] bg-white px-3 text-left text-sm font-bold text-[#254536]"
                >
                  <span className="truncate">{activeMachine.description}</span>
                  <Search className="h-4 w-4 text-[#237052]" />
                </button>
              </div>
              <div className="w-full sm:w-60">
                <label className="mb-1  text-[12px] font-['Tahoma] ''tracking-[.14em] text-[#1d5c47]">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#a8cfb6] bg-white px-3 text-sm font-bold text-[#254536]"
                >
                  <option>Todos</option>
                  <option>A Lib/Lib/Parcial</option>
                  <option>A Liberar</option>
                  <option>Atendido</option>
                  <option>Liberado</option>
                  <option>Em Produção</option>
                  <option>Parcial</option>
                  <option>Setup Cancelado</option>
                </select>
              </div>
            </>
          ) : null}
          {qualityRelease ? (
            <label className="flex h-10 cursor-pointer items-center gap-3 rounded-lg border border-[#a8cfb6] bg-white px-3 text-sm font-black text-[#254536]">
              <input
                type="checkbox"
                checked={releaseStartedOnly}
                onChange={event => setReleaseStartedOnly(event.target.checked)}
                className="h-4 w-4 accent-[#177458]"
              />
              Mostrar apenas processos já iniciados ou atendidos anteriormente
            </label>
          ) : null}
        </section>
      ) : null}
      <section
        className={`theme-surface overflow-hidden rounded-2xl border border-[#e1e5de] bg-white shadow-[0_12px_32px_rgba(31,42,34,.035)] ${operator ? "flex min-h-0 flex-1 flex-col" : ""} ${coladeiraMachine ? "programming-coladeira" : ""}`}
      >
        <div className="theme-grid-title flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]">
              <ListOrdered className="theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]" />
              {manualPointing ? "Ordens para Apontamento" : "Fila Operacional"}
            </div>
          </div>
          <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-end">
            {manualPointing || coladeiraMachine ? (
              <div className="w-full sm:w-52">
                <label className="mb-1 block text-[10px] font-black ''tracking-[.14em] text-[#3c735b]">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={event => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full rounded-lg border border-[#a8cfb6] bg-white px-3 text-sm font-bold text-[#254536]"
                >
                  {OPERATIONAL_STATUS_FILTER_OPTIONS.map(option => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4d846b]" />
              <Input
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Cliente, Cód Prod. Cliente, OP ou Referência"
                className="theme-search-field h-10 border-[#b9d9c8] bg-white/90 pl-9 text-sm"
              />
            </div>
          </div>
        </div>
        {programmer ? (
          <div className="md:hidden">
            {programming.isLoading ? (
              <div className="m-3 rounded-xl border border-[#d9e8de] bg-[#f8fcf9] p-6 text-center text-sm font-bold text-[#5d7568]">
                Carregando programação…
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-[#e0ece4] px-4 py-3">
                  <div>
                    <span className="block text-[10px] font-black ''tracking-[.14em] text-[#537162]">
                      Carrossel de ordens
                    </span>
                    <span className="mt-1 block text-sm font-black text-[#264c3a]">
                      OP{" "}
                      {Math.max(
                        1,
                        sortedProgrammingItems.findIndex(
                          item =>
                            item.op_codigo === selectedItem?.op_codigo &&
                            item.mp_codigo === selectedItem?.mp_codigo
                        ) + 1
                      )}{" "}
                      de {sortedProgrammingItems.length || 0}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Ordem anterior"
                      disabled={
                        sortedProgrammingItems.findIndex(
                          item =>
                            item.op_codigo === selectedItem?.op_codigo &&
                            item.mp_codigo === selectedItem?.mp_codigo
                        ) <= 0
                      }
                      onClick={() => {
                        const index = sortedProgrammingItems.findIndex(
                          item =>
                            item.op_codigo === selectedItem?.op_codigo &&
                            item.mp_codigo === selectedItem?.mp_codigo
                        );
                        const previous = sortedProgrammingItems[index - 1];
                        if (previous)
                          setSelectedProcess({
                            opCode: previous.op_codigo,
                            masterOrder: previous.master_order ?? null,
                          });
                      }}
                      className="h-10 w-10 border-[#9ccbb0] bg-white text-[#245b42] hover:bg-[#effaf2]"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Próxima ordem"
                      disabled={
                        sortedProgrammingItems.findIndex(
                          item =>
                            item.op_codigo === selectedItem?.op_codigo &&
                            item.mp_codigo === selectedItem?.mp_codigo
                        ) >=
                        sortedProgrammingItems.length - 1
                      }
                      onClick={() => {
                        const index = sortedProgrammingItems.findIndex(
                          item =>
                            item.op_codigo === selectedItem?.op_codigo &&
                            item.mp_codigo === selectedItem?.mp_codigo
                        );
                        const next = sortedProgrammingItems[index + 1];
                        if (next)
                          setSelectedProcess({
                            opCode: next.op_codigo,
                            masterOrder: next.master_order ?? null,
                          });
                      }}
                      className="h-10 w-10 border-[#9ccbb0] bg-white text-[#245b42] hover:bg-[#effaf2]"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div
                  ref={mobileProgrammingCarousel}
                  className="programming-mobile-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4"
                >
                  {sortedProgrammingItems.map(renderProgrammerMobileCard)}
                </div>
                <p className="px-4 pb-4 text-center text-xs font-semibold text-[#5d7568]">
                  Deslize para navegar entre as OPs ou use as setas. Os ajustes
                  abaixo acompanham o cartão selecionado.
                </p>
              </>
            )}
          </div>
        ) : null}
        <div
          className={`overflow-x-auto ${operator ? "min-h-[440px] flex-1" : programmer ? "hidden min-h-[388px] md:block" : ""}`}
        >
          <table
            className={`programming-grid w-full text-left text-sm ${manualPointing ? "min-w-[1250px]" : "min-w-[1600px]"}`}
          >
            <thead className="theme-grid-header sticky top-0 z-10 border-b-2 border-[#e0c976] bg-[#fff2c9] font-['Tahoma'] text-xs font-black ''tracking-[.12em] text-[#705719]">
              <tr>
                {!manualPointing ? (
                  <SortableHeader
                    label="Fila"
                    column="fila"
                    sortKey={programmingSortKey}
                    sortDirection={programmingSortDirection}
                    onSort={key => toggleProgrammingSort(key as never)}
                  />
                ) : null}
                <SortableHeader
                  label="Cliente"
                  column="client"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="O.P."
                  column="op_codigo"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Produto"
                  column="productCode"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Rev."
                  column="revision"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Referência"
                  column="referencia"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Cod. Prod. Cliente"
                  column="customerProductCode"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Qtde da OP"
                  column="quantity"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                  className="text-center"
                />
                <SortableHeader
                  label="Qtde Produzida"
                  column="quantidade_produzida"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                  className="text-center"
                />
                <SortableHeader
                  label="Saldo"
                  column="saldo"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                  className="text-center"
                />
                <SortableHeader
                  label="Data de Expedição"
                  column="shipmentDate"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Data de Entrega"
                  column="data_entrega"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                <SortableHeader
                  label="Status"
                  column="status"
                  sortKey={programmingSortKey}
                  sortDirection={programmingSortDirection}
                  onSort={key => toggleProgrammingSort(key as never)}
                />
                {qualityRelease ? (
                  <SortableHeader
                    label="Situação"
                    column="processSituation"
                    sortKey={programmingSortKey}
                    sortDirection={programmingSortDirection}
                    onSort={key => toggleProgrammingSort(key as never)}
                  />
                ) : null}
                {!manualPointing ? (
                  <>
                    <SortableHeader
                      label="Situação da M.P."
                      column="processPosition"
                      sortKey={programmingSortKey}
                      sortDirection={programmingSortDirection}
                      onSort={key => toggleProgrammingSort(key as never)}
                    />
                    <SortableHeader
                      label="Solicitação"
                      column="requestStatus"
                      sortKey={programmingSortKey}
                      sortDirection={programmingSortDirection}
                      onSort={key => toggleProgrammingSort(key as never)}
                    />
                  </>
                ) : null}
                <th className="px-3 py-3  text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ede8]">
              {programming.isLoading ? (
                <LoadingRows
                  columns={qualityRelease ? 14 : manualPointing ? 13 : 16}
                />
              ) : (
                sortedProgrammingItems.map(item => {
                  const key = `${item.op_codigo}-${item.mp_codigo}`;
                  const desiredQueue =
                    queueValues[key] ?? String(item.fila ?? "");
                  const eligibleStatus = [
                    "Liberado",
                    "Aberto",
                    "A Concluir",
                    "Setup a Concluir",
                    ...(coladeiraMachine ? ["Parcial"] : []),
                  ].includes(item.status ?? "");
                  const manualEligible = [
                    "Liberado",
                    "Parcial",
                    "Em Produção",
                  ].includes(item.status ?? "");
                  const isPriorityRow =
                    coladeiraMachine || Number(item.fila) === 1;
                  const canStart = manualPointing
                    ? manualEligible
                    : eligibleStatus &&
                      isPriorityRow &&
                      (!hasPriorityToConclude || item.status === "A Concluir");
                  const selected =
                    selectedProcess?.opCode === item.op_codigo &&
                    selectedItem?.mp_codigo === item.mp_codigo;
                  item.processPosition =
                    item.reservedStatus ||
                    item.processSituation ||
                    item.processPosition;
                  return (
                    <tr
                      key={key}
                      onClick={() =>
                        setSelectedProcess({
                          opCode: item.op_codigo,
                          masterOrder: item.master_order ?? null,
                        })
                      }
                      className={`theme-grid-row ${selected ? "theme-grid-row-selected bg-[#dff3e7] shadow-[inset_5px_0_0_#177458]" : canStart ? "bg-[#f5fbf7]" : "hover:bg-[#f7faf7]"} cursor-pointer transition-colors`}
                    >
                      {!manualPointing ? (
                        <td className="px-3 py-2.5">
                          <span className="inline-flex min-w-7 justify-center rounded-md bg-[#e7efe9] px-2 py-1 font-mono text-xs font-bold text-[#235442]">
                            {displayValue(item.fila)}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 font-semibold text-[#34463b]">
                        {displayValue(item.client)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#405449]">
                        <span>{item.op_codigo}</span>
                        {item.specialPrimary ? (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              setShowSpecialSet(true);
                            }}
                            className="ml-1.5 inline-flex rounded border border-[#d0a534] bg-[#fff4bf] px-1.5 py-0.5 font-sans text-[9px] font-black ''tracking-wide text-[#725411] transition hover:bg-[#ffe27c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8e6808]"
                          >
                            Conjunto
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 font-['Tahoma'] text-xs text-[#405449]">
                        {displayValue(item.productCode)}
                      </td>
                      <td className="px-3 py-2.5 font-['Tahoma']  text-xs">
                        {displayValue(item.revision)}
                      </td>
                      <td className="px-3 py-2.5  font-['Tahoma']  text-[#46564b]">
                        {displayValue(
                          item.produto_referencia || item.referencia
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-['Tahoma']  text-xs text-[#405449]">
                        {displayValue(item.customerProductCode)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-['Tahoma'] ">
                        {displayValue(item.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-['Tahoma']">
                        {displayValue(item.quantidade_produzida)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-['Tahoma']  text-xs font-bold ">
                        {displayValue(item.saldo)}
                      </td>
                      <td className="px-3 py-2.5  font-['Tahoma'] ">
                        {formatDate(item.shipmentDate)}
                      </td>
                      <td className="px-3 py-2.5  font-['Tahoma'] ">
                        {formatDate(item.data_entrega)}
                      </td>
                      <td className="px-3 py-2.5  font-['Tahoma'] ">
                        <StatusPill status={item.status} />
                      </td>
                      {qualityRelease ? (
                        <td className="px-3 py-2.5">
                          <span className="rounded bg-[#eef3ff] px-2 py-1  font-['Tahoma']  text-[11px] font-black text-[#24529a]">
                            {displayValue(
                              item.processSituation,
                              "1º Amostragem"
                            )}
                          </span>
                        </td>
                      ) : null}
                      {!manualPointing ? (
                        <>
                          <td className="px-3 py-2.5">
                            <span className="rounded bg-[#e6f8eb] px-2 py-1 text-[11px]  font-['Tahoma']  text-[#187347]">
                              {displayValue(item.processPosition)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded px-2 py-1 text-[11px] font-bold ${requestStatusClass(item.requestStatus)}`}
                            >
                              {displayValue(
                                item.requestStatus,
                                "Não solicitada"
                              )}
                            </span>
                          </td>
                        </>
                      ) : null}
                      <td className="px-3 py-2.5">
                        {operator ? (
                          <Button
                            size="sm"
                            disabled={
                              !canStart ||
                              resumeToConclude.isPending ||
                              startNewSetup.isPending
                            }
                            onClick={event => {
                              event.stopPropagation();
                              if (manualPointing) {
                                setLocation(
                                  `/apontamento-manual/${item.op_codigo}/${item.mp_codigo}`
                                );
                                return;
                              }
                              item.status === "A Concluir"
                                ? resumeToConclude.mutate({
                                    opCodigo: item.op_codigo,
                                    mpCodigo: item.mp_codigo,
                                  })
                                : startNewSetup.mutate({
                                    opCodigo: item.op_codigo,
                                    mpCodigo: item.mp_codigo,
                                  });
                            }}
                            className="theme-btn-primary h-8 bg-[#187558] text-xs hover:bg-[#116348]"
                          >
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                            {manualPointing && item.status === "Em Produção"
                              ? "Apontar"
                              : item.status === "A Concluir" &&
                                  resumeToConclude.isPending
                                ? "Retomando…"
                                : item.status !== "A Concluir" &&
                                    startNewSetup.isPending
                                  ? "Iniciando setup…"
                                  : canStart
                                    ? item.status === "A Concluir"
                                      ? "Retomar"
                                      : "Iniciar"
                                    : manualPointing
                                      ? "Indisponível"
                                      : !isPriorityRow
                                        ? "Fila prioritária"
                                        : hasPriorityToConclude
                                          ? "A Concluir prioritária"
                                          : "Indisponível"}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              value={desiredQueue}
                              onChange={event =>
                                setQueueValues(current => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              inputMode="numeric"
                              className="theme-search-field h-8 w-16 font-mono text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateQueue.isPending}
                              onClick={() => {
                                const queue = Number(desiredQueue);
                                if (!Number.isInteger(queue) || queue < 1) {
                                  setQueueMessage(
                                    operationalQueueMessage(
                                      "Informe uma posição de fila válida."
                                    )
                                  );
                                  return;
                                }
                                if (!activeMachine?.code) {
                                  setQueueMessage(
                                    operationalQueueMessage(
                                      "Selecione uma Máquina para reorganizar a fila."
                                    )
                                  );
                                  return;
                                }
                                updateQueue.mutate({
                                  opCodigo: item.op_codigo,
                                  mpCodigo: item.mp_codigo,
                                  machineCode: Number(activeMachine.code),
                                  queue,
                                });
                              }}
                              className="theme-btn-soft h-8 text-xs"
                            >
                              <Settings2 className="mr-1 h-3.5 w-3.5" />
                              Fila
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                changeProcess.isPending ||
                                [
                                  "Atendido",
                                  "A Concluir",
                                  "Setup a Concluir",
                                ].includes(item.status ?? "")
                              }
                              onClick={() => {
                                setSelectedTargetMachineCode(null);
                                setProcessTransfer({
                                  opCodigo: item.op_codigo,
                                  mpCodigo: item.mp_codigo,
                                  reference:
                                    item.referencia ??
                                    item.produto_referencia ??
                                    null,
                                });
                              }}
                              className="theme-btn-soft h-8 text-xs"
                            >
                              Processo
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!programming.isLoading && !programming.data?.items.length ? (
          <div className="px-5 py-14 text-center text-sm text-[#899189]">
            Não há processos liberados para esta máquina com os filtros atuais.
          </div>
        ) : null}
        <TablePagination
          page={page}
          total={programming.data?.total ?? 0}
          limit={programmingLimit}
          onChange={setPage}
        />
      </section>
      {selectedItem ? (
        <section className="theme-details-panel overflow-hidden rounded-xl border-2 border-[#b8dec7] bg-[linear-gradient(105deg,#eaf8ef_0%,#ffffff_46%,#e1f5e8_100%)] shadow-[0_8px_22px_rgba(31,81,58,.08)]">
          <div className="grid gap-px bg-[#b8dec7] lg:grid-cols-2">
            <div className="bg-white/90 px-5 py-3">
              <span className="theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]">
                Ajuste Largura
              </span>
              <span className="mt-1 block font-mono text-2xl font-black tracking-tight text-[#135440]">
                {selectedItem.adjustmentLength
                  ? `${displayValue(selectedItem.adjustmentWidth)} = `
                  : ""}
                {displayValue(selectedItem.adjustmentWidthTotal)}
              </span>
            </div>
            <div className="bg-white/90 px-5 py-3">
              <span className="theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]">
                Ajuste Comprimento
              </span>
              <span className="mt-1 block font-mono text-2xl font-black tracking-tight text-[#135440]">
                {selectedItem.adjustmentLength
                  ? `${displayValue(selectedItem.adjustmentLength)} = `
                  : ""}
                {displayValue(selectedItem.adjustmentLengthTotal)}
              </span>
            </div>
          </div>
          <div className="theme-tooling-panel flex flex-col gap-3 border-t border-[#c8e5d2] bg-[linear-gradient(100deg,#f6fff8,#fff9e9,#effcf3)] px-5 py-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]">
                Cores
              </span>
              {selectedPrintLayout.data?.colors?.length ? (
                selectedPrintLayout.data.colors.map(color => (
                  <span
                    key={`${color.order}-${color.description}`}
                    className="rounded-md border-2 border-white px-3 py-1.5 text-sm font-black text-white shadow-[0_2px_5px_rgba(0,0,0,.16)]"
                    style={{ backgroundColor: safeColor(color.hexWhite) }}
                  >
                    {color.description}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold text-[#71867a]">—</span>
              )}
            </div>
            <div className="h-8 border-l border-[#d8c998]" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="theme-tooling-label text-[12px] font-['Tahoma'] ''tracking-[.14em] text-[#1d5c47]">
                Ferramentais
              </span>
              <span className="theme-tooling-chip rounded-lg border border-[#d5bd72] bg-white px-3 py-1.5 text-sm font-black text-[#66521c]">
                Clichê:{" "}
                {selectedPrintLayout.data?.cliches?.length
                  ? selectedPrintLayout.data.cliches
                      .map(item => `${item.code}/${item.series}`)
                      .join(" · ")
                  : "—"}
              </span>
              <span className="theme-tooling-chip rounded-lg border border-[#d5bd72] bg-white px-3 py-1.5 text-sm font-black text-[#66521c]">
                Faca:{" "}
                {selectedPrintLayout.data?.facas?.length
                  ? selectedPrintLayout.data.facas
                      .map(item => item.code)
                      .join(" · ")
                  : "—"}
              </span>
            </div>
          </div>
        </section>
      ) : null}
      <section className="theme-toolbar sticky bottom-0 z-20 overflow-x-auto rounded-xl border-2 border-[#2b8c69] bg-[linear-gradient(100deg,#0c513e_0%,#19795a_48%,#0f6049_100%)] p-2 shadow-[0_-8px_24px_rgba(24,65,48,.2)]">
        <div className="flex min-w-max gap-2">
          <OperatorCallButton
            label="Atualizar"
            shortcut=""
            icon={<RefreshCw className="h-4 w-4" />}
            tone="green"
            onClick={refreshProgramming}
          />
          {selectedItem?.specialPrimary ? (
            <OperatorCallButton
              label="Conjunto"
              shortcut=""
              icon={<UsersRound className="h-4 w-4" />}
              tone="yellow"
              onClick={() => setShowSpecialSet(true)}
            />
          ) : null}
          <OperatorCallButton
            label="Pacotes / Paletização"
            shortcut="F4"
            icon={<Package className="h-4 w-4" />}
            tone="green"
            disabled={!selectedItem}
            onClick={() => setShowPalletization(true)}
          />
          <OperatorCallButton
            label="Visualizar Layout"
            shortcut="F5"
            icon={<FileImage className="h-4 w-4" />}
            tone="green"
            disabled={!selectedItem}
            onClick={() => setShowPrintLayout(true)}
          />
          <OperatorCallButton
            label="Reserva"
            shortcut="F7"
            icon={<Boxes className="h-4 w-4" />}
            tone="yellow"
            disabled={!selectedItem}
            onClick={() => setShowReservation(true)}
          />
          <OperatorCallButton
            label="Qtde. Aprovada"
            shortcut="F8"
            icon={<ClipboardCheck className="h-4 w-4" />}
            tone="yellow"
            disabled={!selectedItem}
            onClick={() => setShowApprovedQuantities(true)}
          />
          <OperatorCallButton
            label="Solicitações"
            shortcut="F9"
            icon={<ClipboardCheck className="h-4 w-4" />}
            tone="yellow"
            onClick={() => setShowRequests(true)}
          />
          <OperatorCallButton
            label="Etiqueta de Processo"
            shortcut="F10"
            icon={<Barcode className="h-4 w-4" />}
            tone="purple"
            disabled={!selectedItem}
            onClick={() => setShowProcessLabel(true)}
          />
          {pointingMachine ? (
            <OperatorCallButton
              label="Etiqueta PA"
              shortcut=""
              icon={<Tag className="h-4 w-4" />}
              tone="purple"
              disabled={!selectedItem}
              onClick={() => setShowProductFinishedLabel(true)}
            />
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button
              aria-label="Fechar"
              title="Fechar"
              onClick={
                manualPointing
                  ? signOut
                  : operator
                    ? () => setShowExitOptions(true)
                    : signOut
              }
              className="mobile-command-close h-9 shrink-0 rounded-lg bg-[#cf3f3f] px-4 text-sm font-bold text-white hover:bg-[#ad2e2e]"
            >
              <Power className="h-4 w-4" />
              <span className="mobile-command-label ml-2">Fechar</span>
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={showMachineSearch} onOpenChange={setShowMachineSearch}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {manualProduction
                ? "Trocar Máquina/Processo Manual"
                : "Selecionar Máquina Controlada"}
            </DialogTitle>
            <DialogDescription>
              {manualProduction
                ? "Escolha somente uma Máquina/Processo de Processo Manual. Liberação de Produto e Apontamento não são exibidos."
                : "Escolha a máquina para consultar a programação."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={machineSearch}
            onChange={event => setMachineSearch(event.target.value)}
            placeholder="Buscar por Código ou Descrição"
          />
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {(manualProduction ? manualMachines.data : controlledMachines.data)
              ?.filter(item =>
                `${item.code} ${item.description}`
                  .toLocaleLowerCase("pt-BR")
                  .includes(machineSearch.toLocaleLowerCase("pt-BR"))
              )
              .map(item => (
                <button
                  key={item.code}
                  disabled={switchManualMachine.isPending}
                  onClick={() => {
                    if (manualProduction)
                      switchManualMachine.mutate({ machineCode: item.code });
                    else {
                      selectProgrammerMachine(item.code);
                      setShowMachineSearch(false);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left hover:border-[#177458] hover:bg-[#eefaf2] disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="font-bold text-[#254536]">
                    {item.description}
                  </span>
                  <span className="font-mono text-xs text-[#5f786a]">
                    {switchManualMachine.isPending
                      ? "Alterando…"
                      : `Código ${item.code}`}
                  </span>
                </button>
              ))}
            {manualProduction && manualMachines.isLoading ? (
              <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">
                Consultando Máquinas/Processos Manuais…
              </p>
            ) : null}
            {manualProduction && manualMachines.error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                Não foi possível listar as Máquinas/Processos Manuais.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowMachineSearch(false)}
              disabled={switchManualMachine.isPending}
              className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StationConfigurationDialog
        open={showStationConfiguration}
        onOpenChange={setShowStationConfiguration}
        search={stationSearch}
        onSearchChange={setStationSearch}
        stations={loginStations.data ?? []}
        loading={loginStations.isLoading}
        error={loginStations.error}
        saving={persistStation.isPending}
        onSelect={configureStation}
      />
      <Dialog
        open={Boolean(processTransfer)}
        onOpenChange={open => {
          if (!open && !changeProcess.isPending) {
            setProcessTransfer(null);
            setSelectedTargetMachineCode(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Alterar Processo</DialogTitle>
            <DialogDescription>
              Selecione a Máquina Elegível para Transferir a OP{" "}
              {processTransfer?.opCodigo ?? ""}
              {processTransfer?.reference
                ? ` · ${processTransfer.reference}`
                : ""}
              . A Lista Respeita o Produto, a Revisão e o Grupo Produtivo do
              Legado.
            </DialogDescription>
          </DialogHeader>
          {eligibleProcessMachines.isLoading ? (
            <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">
              Consultando Máquinas Elegíveis…
            </p>
          ) : eligibleProcessMachines.data?.length ? (
            <div className="grid max-h-[420px] gap-3 overflow-y-auto sm:grid-cols-2">
              {eligibleProcessMachines.data.map(candidate => (
                <button
                  key={candidate.code}
                  onClick={() => setSelectedTargetMachineCode(candidate.code)}
                  className={`rounded-xl border-2 p-4 text-left transition ${selectedTargetMachineCode === candidate.code ? "border-[#177458] bg-[#eefaf2] shadow-[0_0_0_3px_rgba(23,116,88,.12)]" : "border-[#d7e4da] bg-white hover:border-[#8fc59f]"}`}
                >
                  <span className="block text-base font-black text-[#254536]">
                    {candidate.description}
                  </span>
                  <span className="mt-1 block font-mono text-xs font-semibold text-[#5d7568]">
                    Código {candidate.code}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">
              Não Há Outra Máquina Elegível para o Produto, Revisão e Grupo
              Produtivo desta OP.
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setProcessTransfer(null);
                setSelectedTargetMachineCode(null);
              }}
              disabled={changeProcess.isPending}
              className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !processTransfer ||
                !selectedTargetMachineCode ||
                changeProcess.isPending
              }
              onClick={() =>
                processTransfer &&
                selectedTargetMachineCode &&
                changeProcess.mutate({
                  opCodigo: processTransfer.opCodigo,
                  mpCodigo: processTransfer.mpCodigo,
                  machineCode: selectedTargetMachineCode,
                })
              }
              className="bg-[#177458] text-white hover:bg-[#105f49]"
            >
              {changeProcess.isPending
                ? "Transferindo…"
                : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showExitOptions} onOpenChange={setShowExitOptions}>
        <DialogContent
          className="w-[min(96vw,860px)] max-w-[860px] max-h-[calc(100dvh-1rem)] overflow-y-auto border-2 border-[#d9c17b] bg-[#fffdf7] p-0"
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader className="border-b border-[#d9c17b] bg-[linear-gradient(105deg,#eaf8ef_0%,#fffdf3_55%,#f4e6ad_100%)] px-7 py-6">
            <DialogTitle className="text-2xl font-black tracking-[-.03em] text-[#234a3a]">
              Encerrar operação da Máquina/Processo
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5b7062]">
              Escolha a ação desejada. Limpeza e fim de período são registrados
              no histórico de ociosidade após a confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5 p-5 sm:p-6">
            <button
              onClick={() => {
                setShowExitOptions(false);
                setShowCleaning(true);
              }}
              className="min-h-40 rounded-xl border-2 border-[#b8d9c0] bg-[#f2fbf5] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#177458]"
            >
              <Sparkles className="mx-auto h-10 w-10 text-[#177458]" />
              <span className="mt-3 block text-lg font-black text-[#254536]">
                Iniciar Limpeza
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#5d7568]">
                Selecionar Motivo de Limpeza
              </span>
            </button>
            <button
              onClick={signOut}
              className="min-h-40 rounded-xl border-2 border-[#b8d9c0] bg-[#f5faf6] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#177458]"
            >
              <UsersRound className="mx-auto h-10 w-10 text-[#177458]" />
              <span className="mt-3 block text-lg font-black text-[#254536]">
                Trocar Operador
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#5d7568]">
                Encerrar o Acesso Atual
              </span>
            </button>
            <button
              onClick={() => {
                setShowExitOptions(false);
                setShowEndPeriodConfirm(true);
              }}
              className="min-h-40 rounded-xl border-2 border-[#e3cc85] bg-[#fffaf0] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#bb7515]"
            >
              <TimerReset className="mx-auto h-10 w-10 text-[#a87012]" />
              <span className="mt-3 block text-lg font-black text-[#5d471d]">
                Fim do Período
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#80672c]">
                Encerrar o período da Máquina/Processo
              </span>
            </button>
            <button
              onClick={() => setShowExitOptions(false)}
              className="min-h-40 rounded-xl border-2 border-[#e1b3b3] bg-[#fff5f5] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#cf3f3f]"
            >
              <Ban className="mx-auto h-10 w-10 text-[#cf3f3f]" />
              <span className="mt-3 block text-lg font-black text-[#722c2c]">
                Cancelar
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#8d5a5a]">
                Voltar à Programação
              </span>
            </button>
          </div>
          <DialogFooter className="border-t border-[#ebe2c7] bg-white/70 px-6 py-4">
            <Button
              onClick={() => setShowExitOptions(false)}
              className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showCleaning} onOpenChange={setShowCleaning}>
        <DialogContent
          className="max-w-4xl overflow-hidden border-2 border-[#b8d9c0] bg-[#fffdf7] p-0"
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader className="border-b border-[#b8d9c0] bg-[linear-gradient(105deg,#eaf8ef_0%,#fffdf3_55%,#f4e6ad_100%)] px-7 py-6">
            <DialogTitle className="text-2xl font-black tracking-[-.03em] text-[#234a3a]">
              Iniciar Limpeza
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm font-semibold leading-6 text-[#5b7062]">
              Selecione o motivo para registrar o período de ociosidade da
              Máquina/Processo.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {cleaningReasons.isLoading ? (
              <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">
                Consultando Motivos de Limpeza…
              </p>
            ) : cleaningReasons.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {cleaningReasons.data.map(reason => (
                  <button
                    key={reason.code}
                    onClick={() => setSelectedCleaningReason(reason.code)}
                    className={`rounded-xl border-2 p-4 text-left font-bold transition ${selectedCleaningReason === reason.code ? "border-[#177458] bg-[#eefaf2] text-[#164c37]" : "border-[#d7e4da] bg-white text-[#466052] hover:border-[#8fc59f]"}`}
                  >
                    {reason.description}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">
                Nenhum Motivo de Limpeza Foi Encontrado para esta
                Máquina/Processo.
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-[#d9e7dd] bg-white/70 px-6 py-4">
            <Button
              onClick={() => setShowCleaning(false)}
              disabled={recordIdleEvent.isPending}
              className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
            >
              Voltar
            </Button>
            <Button
              disabled={!selectedCleaningReason || recordIdleEvent.isPending}
              onClick={() =>
                selectedCleaningReason &&
                recordIdleEvent.mutate({
                  eventType: "cleaning",
                  reasonCode: selectedCleaningReason,
                })
              }
              className="bg-[#177458] text-white hover:bg-[#105f49]"
            >
              {recordIdleEvent.isPending ? "Gravando…" : "Confirmar Limpeza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showEndPeriodConfirm}
        onOpenChange={setShowEndPeriodConfirm}
      >
        <DialogContent
          className="max-w-xl overflow-hidden border-2 border-[#e3cc85] bg-[#fffdf7] p-0"
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader className="border-b border-[#e3cc85] bg-[linear-gradient(105deg,#fff8df_0%,#fffdf3_60%,#f4e6ad_100%)] px-7 py-6">
            <DialogTitle className="text-2xl font-black tracking-[-.03em] text-[#5d471d]">
              Confirmar Fim do Período
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm font-semibold leading-6 text-[#80672c]">
              O Fim do Período Será Registrado no Histórico de Ociosidade com o
              Motivo Operacional Padrão e o Acesso do Operador Será Encerrado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 py-5">
            <Button
              onClick={() => setShowEndPeriodConfirm(false)}
              disabled={recordIdleEvent.isPending}
              className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
            >
              Voltar
            </Button>
            <Button
              onClick={() =>
                recordIdleEvent.mutate({ eventType: "end-period" })
              }
              disabled={recordIdleEvent.isPending}
              className="bg-[#aa7917] text-white hover:bg-[#8e630f]"
            >
              {recordIdleEvent.isPending
                ? "Gravando…"
                : "Confirmar Fim do Período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {queueMessage ? (
        <OperationalMessageDialog
          open
          tone="caution"
          title={queueMessage.title}
          description={queueMessage.description}
          onClose={reloadAfterQueueWarning}
        />
      ) : null}
      <ProductPalletizationDialog
        open={showPalletization}
        onOpenChange={setShowPalletization}
        data={selectedPalletization.data}
        loading={selectedPalletization.isLoading}
        error={selectedPalletization.error}
        productLabel={selectedItem?.referencia ?? undefined}
      />
      <ProductPrintLayoutDialog
        open={showPrintLayout}
        onOpenChange={setShowPrintLayout}
        data={selectedPrintLayout.data}
        loading={selectedPrintLayout.isLoading}
        error={selectedPrintLayout.error}
        productLabel={
          selectedItem?.productCode === undefined
            ? undefined
            : String(selectedItem.productCode)
        }
        revision={selectedItem?.revision}
      />
      <ProductReservationDialog
        open={showReservation}
        onOpenChange={setShowReservation}
        opCode={selectedItem?.op_codigo}
        data={selectedReservations.data}
        loading={selectedReservations.isLoading}
        error={selectedReservations.error}
      />
      <ApprovedProcessQuantitiesDialog
        open={showApprovedQuantities}
        onOpenChange={setShowApprovedQuantities}
        data={selectedApprovedQuantities.data}
        loading={selectedApprovedQuantities.isLoading}
        error={selectedApprovedQuantities.error}
      />
      <RequestDialog open={showRequests} onOpenChange={setShowRequests} />
      <ProcessLabelDialog
        open={showProcessLabel}
        onOpenChange={setShowProcessLabel}
        data={selectedLabel.data}
        loading={selectedLabel.isLoading}
        error={selectedLabel.error}
        printers={localPrinters.data?.printers ?? []}
        printerSource={localPrinters.data?.source}
        opCodigo={selectedCodes?.opCodigo ?? 1}
        mpCodigo={selectedCodes?.mpCodigo ?? 1}
      />
      <ProductFinishedLabelDialog
        open={showProductFinishedLabel}
        onOpenChange={setShowProductFinishedLabel}
        data={selectedProductFinishedLabel.data}
        loading={selectedProductFinishedLabel.isLoading}
        error={selectedProductFinishedLabel.error}
        printers={localPrinters.data?.printers ?? []}
        printerSource={localPrinters.data?.source}
        opCodigo={selectedCodes?.opCodigo ?? 1}
        mpCodigo={selectedCodes?.mpCodigo ?? 1}
      />
      <SpecialProductionDialog
        open={showSpecialSet}
        onOpenChange={setShowSpecialSet}
        data={selectedSpecialProduction.data}
        loading={selectedSpecialProduction.isLoading}
        error={selectedSpecialProduction.error}
      />
    </div>
  );
}

function StationConfigurationDialog({
  open,
  onOpenChange,
  search,
  onSearchChange,
  stations,
  loading,
  error,
  saving,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  stations: Array<{ code: number; description: string }>;
  loading: boolean;
  error: { message: string } | null | undefined;
  saving: boolean;
  onSelect: (machineCode: number) => Promise<void>;
}) {
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visibleStations = stations.filter(station =>
    `${station.code} ${station.description}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch)
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Configurar Máquina/Processo deste Posto</DialogTitle>
          <DialogDescription>
            Esta ação é exclusiva para PCP, Programador ou Administrador. A
            máquina escolhida será gravada neste posto da rede e no navegador;
            em seguida, o acesso será encerrado para que o próximo usuário entre
            pela Máquina/Processo configurada.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Buscar por Código ou Descrição"
          autoFocus
          disabled={saving}
        />
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="rounded-lg bg-[#f4f8f4] p-5 text-sm font-bold text-[#5b7062]">
              Consultando Máquinas/Processos Ativos…
            </p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
              Não foi possível listar as Máquinas/Processos. Verifique a conexão
              com o proxy local.
            </p>
          ) : visibleStations.length ? (
            visibleStations.map(station => (
              <button
                key={station.code}
                disabled={saving}
                onClick={() => void onSelect(station.code)}
                className="flex w-full items-center justify-between rounded-lg border border-[#d4e7dc] bg-[#f8fcf9] px-4 py-3 text-left transition hover:border-[#177458] hover:bg-[#eefaf2] disabled:cursor-wait disabled:opacity-60"
              >
                <span className="font-bold text-[#254536]">
                  {station.description}
                </span>
                <span className="font-mono text-xs text-[#5f786a]">
                  {saving ? "Gravando…" : `Código ${station.code}`}
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-lg border border-[#ead49d] bg-[#fffaf0] p-5 text-sm font-bold text-[#765f28]">
              Nenhuma Máquina/Processo Encontrada.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperatorCallButton({
  label,
  shortcut,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  tone: "green" | "yellow" | "purple";
  disabled?: boolean;
  onClick: () => void;
}) {
  const styles = {
    green: "border-[#4d956f] bg-[#f6fcf8] text-[#286449] hover:bg-[#eaf7ee]",
    yellow: "border-[#d4b955] bg-[#fffdf5] text-[#80651a] hover:bg-[#fff6d9]",
    purple: "border-[#9c70ba] bg-[#fdfaff] text-[#6c4688] hover:bg-[#f5ecfb]",
  };
  return (
    <Button
      variant="outline"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
      className={`mobile-command-button h-9 shrink-0 gap-2 rounded-lg border-2 px-3 text-sm font-semibold ${styles[tone]} theme-btn-soft`}
    >
      <span>{icon}</span>
      <span className="mobile-command-label">{label}</span>
      {shortcut ? (
        <span className="mobile-command-shortcut rounded border border-current/30 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-black leading-none">
          {shortcut}
        </span>
      ) : null}
    </Button>
  );
}

function MobileProgrammingField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string | number;
  emphasize?: boolean;
}) {
  return (
    <div>
      <span className="block text-[9px] font-black ''tracking-[.12em] text-[#668071]">
        {label}
      </span>
      <span
        className={`mt-1 block break-words text-sm font-black leading-tight ${emphasize ? "text-[#176546]" : "text-[#324c3c]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function requestStatusClass(status: string | null | undefined) {
  const normalized = String(status ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  if (normalized === "atendido") return "bg-[#dcf5e7] text-[#176b43]";
  if (normalized === "separado" || normalized === "transbordo")
    return "bg-[#dceeff] text-[#155c99]";
  if (normalized === "solicitado") return "bg-[#fff0b8] text-[#805900]";
  return "bg-[#eff1ee] text-[#687169]";
}
