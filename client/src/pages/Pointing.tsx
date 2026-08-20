import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { colorChipContrastTone, colorChipStyle } from "@/lib/colorContrast";
import { ConnectionNotice, displayValue, StatusPill } from "@/components/ProductionPrimitives";
import { QueueConsultationDialog } from "@/components/QueueConsultationDialog";
import { ProductReservationDialog } from "@/components/ProductReservationDialog";
import { ApprovedProcessQuantitiesDialog } from "@/components/ApprovedProcessQuantitiesDialog";
import { RequestDialog } from "@/components/RequestDialog";
import { ProcessLabelDialog } from "@/components/ProcessLabelDialog";
import { ProductFinishedLabelDialog } from "@/components/ProductFinishedLabelDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationTone, OperationalConfirmDialog, OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, Factory, FileWarning, ImageIcon, ListOrdered, Minus, Package, Play, Plus, RotateCcw, ScanLine, Tag, TimerReset, X } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type SetupOutcome = "attended" | "to_conclude" | "cancelled";
type ProductionOutcome = "attended" | "to_conclude" | "partial";
type RpncOrigin = "product" | "raw-material";
type RpncSelection = { quantity: string; causeCodes: number[]; containmentAction: string };

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "00:00:00";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type PendingConfirmation = { tone: ConfirmationTone; title: string; description: string; confirmLabel: string; action: () => void };

export default function Pointing() {
  const [, params] = useRoute("/apontamento/:opCodigo/:mpCodigo");
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const opCodigo = Number(params?.opCodigo);
  const mpCodigo = Number(params?.mpCodigo);
  const utils = trpc.useUtils();
  const pointing = trpc.production.pointing.get.useQuery({ opCodigo, mpCodigo }, { enabled: Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [showQueueConsultation, setShowQueueConsultation] = useState(false);
  const [showReservationDetails, setShowReservationDetails] = useState(false);
  const [showApprovedQuantities, setShowApprovedQuantities] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showProcessLabel, setShowProcessLabel] = useState(false);
  const [showProductFinishedLabel, setShowProductFinishedLabel] = useState(false);
  const [showRpnc, setShowRpnc] = useState(false);
  const [rpncOrigin, setRpncOrigin] = useState<RpncOrigin>("product");
  const [rpncSelections, setRpncSelections] = useState<Record<string, RpncSelection>>({});
  const [selectedRpncChecklistCode, setSelectedRpncChecklistCode] = useState<number | null>(null);
  const [selectedRpncItemCode, setSelectedRpncItemCode] = useState<number | null>(null);
  const [layoutZoom, setLayoutZoom] = useState(1);
  const [layoutPan, setLayoutPan] = useState({ x: 0, y: 0 });
  const [layoutDrag, setLayoutDrag] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pauseReasons = trpc.production.pointing.pauseReasons.useQuery(undefined, { enabled: Boolean(pointing.data?.queuePosition === "PI" && pauseModalOpen), retry: false });
  const rawMaterials = trpc.production.pointing.rawMaterials.useQuery({ opCodigo, mpCodigo }, { enabled: showTrace && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const printLayout = trpc.production.pointing.printLayout.useQuery({ opCodigo, mpCodigo }, { enabled: showPrintLayout && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const palletization = trpc.production.pointing.palletization.useQuery({ opCodigo, mpCodigo }, { enabled: showPalletization && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const processLabel = trpc.production.pointing.processLabel.useQuery({ opCodigo, mpCodigo }, { enabled: showProcessLabel && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const productFinishedLabel = trpc.production.pointing.productFinishedLabel.useQuery({ opCodigo, mpCodigo }, { enabled: showProductFinishedLabel && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const localPrinters = trpc.production.printers.list.useQuery(undefined, { enabled: showProcessLabel || showProductFinishedLabel, retry: false });
  const rpncChecklist = trpc.production.pointing.rpncChecklist.useQuery({ opCodigo, mpCodigo, origin: rpncOrigin }, { enabled: showRpnc && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const reservation = trpc.production.pointing.reservation.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data?.queuePosition === "PI") && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const reservationDetails = trpc.production.queue.reservations.useQuery({ opCode: opCodigo }, { enabled: showReservationDetails && Number.isInteger(opCodigo), retry: false });
  const approvedQuantities = trpc.production.pointing.approvedQuantities.useQuery({ opCodigo, mpCodigo }, { enabled: showApprovedQuantities && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const [showInspection, setShowInspection] = useState(false);
  const [confirmedInspectionCodes, setConfirmedInspectionCodes] = useState<number[]>([]);
  const inspectionChecklist = trpc.production.pointing.inspectionChecklist.useQuery(undefined, { enabled: showInspection, retry: false });
  const [showProcessInspection, setShowProcessInspection] = useState(false);
  const [confirmedProcessInspectionCodes, setConfirmedProcessInspectionCodes] = useState<number[]>([]);
  const processInspectionChecklist = trpc.production.pointing.processInspectionChecklist.useQuery(undefined, { enabled: Boolean(pointing.data?.queuePosition === "PI"), retry: false });

  const startSetup = trpc.production.pointing.startSetup.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Setup iniciado e apontamento aberto."); },
    onError: (error) => toast.error("Não foi possível iniciar o setup", { description: error.message }),
  });
  const finishSetup = trpc.production.pointing.finishSetup.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Setup finalizado."); },
    onError: (error) => toast.error("Não foi possível finalizar o setup", { description: error.message }),
  });
  const startPause = trpc.production.pointing.startPause.useMutation({
    onSuccess: async () => { setPauseOpen(true); setPauseModalOpen(false); await refresh(); toast.success("Parada iniciada."); },
    onError: (error) => toast.error("Não foi possível iniciar a parada", { description: error.message }),
  });
  const finishPause = trpc.production.pointing.finishPause.useMutation({
    onSuccess: async () => { setPauseOpen(false); await refresh(); toast.success("Parada finalizada."); },
    onError: (error) => toast.error("Não foi possível finalizar a parada", { description: error.message }),
  });
  const finishProduction = trpc.production.pointing.finishProduction.useMutation({
    onSuccess: async (result) => { await utils.production.programming.list.invalidate(); await utils.production.pointing.reservation.invalidate({ opCodigo, mpCodigo }); setShowFinish(false); toast.success(`Produção finalizada: ${result.status}. Saldo: ${result.balance}.`, { description: `PVPP ${result.processProductionCode || "não localizado"} · arranjo ${result.arrangementTotal}× · informado ${result.enteredQuantity} · produzido ${result.productionQuantity} · reserva ${result.reservationQuantity}.` }); setShowProductFinishedLabel(true); },
    onError: (error) => toast.error("Não foi possível finalizar a produção", { description: error.message }),
  });
  const completeInspection = trpc.production.pointing.completeInspection.useMutation({
    onSuccess: async () => { await refresh(); setShowInspection(false); setConfirmedInspectionCodes([]); toast.success("Checklist confirmado. Produção iniciada."); },
    onError: (error) => toast.error("Não foi possível confirmar o checklist", { description: error.message }),
  });
  const completeProcessInspection = trpc.production.pointing.completeProcessInspection.useMutation({
    onSuccess: (result) => { setShowProcessInspection(false); setConfirmedProcessInspectionCodes([]); toast.success("Inspeção de Processo registrada.", { description: `Registro efetuado às ${formatTimestamp(result.recordedAt)}. Próxima inspeção em ${result.intervalMinutes} min.` }); },
    onError: (error) => toast.error("Não foi possível registrar a Inspeção de Processo", { description: error.message }),
  });
  const [lotValidatedMessage, setLotValidatedMessage] = useState<string | null>(null);
  const [lotInvalidMessage, setLotInvalidMessage] = useState<string | null>(null);
  const validateLot = trpc.production.pointing.validateLot.useMutation({
    onSuccess: async (_result, variables) => { await utils.production.pointing.rawMaterials.invalidate({ opCodigo, mpCodigo }); setValidatedStructures((current) => ({ ...current, [variables.structureCode]: variables.lot })); setLotValidatedMessage(`O lote ${variables.lot} foi validado e vinculado à matéria-prima.`); },
    onError: (error) => setLotInvalidMessage(error.message),
  });
  const submitRpnc = trpc.production.pointing.submitRpnc.useMutation({
    onSuccess: (result) => { const shouldResumeTrace = resumeTraceAfterRpnc; setShowRpnc(false); setRpncSelections({}); setSelectedRpncChecklistCode(null); setSelectedRpncItemCode(null); setResumeTraceAfterRpnc(false); toast.success(`RPNC ${result.rpncCode}/${result.year} aberta com ${result.nonconformityCount} não conformidade(s).`); if (shouldResumeTrace) beginTrace(); },
    onError: (error) => toast.error("Não foi possível gravar a RPNC", { description: error.message }),
  });

  const [showFinish, setShowFinish] = useState(false);
  const [pendingTraceConformance, setPendingTraceConformance] = useState(false);
  const [resumeTraceAfterRpnc, setResumeTraceAfterRpnc] = useState(false);
  const [quantityProduced, setQuantityProduced] = useState("");
  const [quantityLost, setQuantityLost] = useState("");
  const [productionOutcome, setProductionOutcome] = useState<ProductionOutcome>("attended");
  const [observation, setObservation] = useState("");
  const [lotTrace, setLotTrace] = useState("");
  const [lotInputs, setLotInputs] = useState<Record<number, { first: string; last: string }>>({});
  const [validatedStructures, setValidatedStructures] = useState<Record<number, string>>({});

  async function refresh() {
    await utils.production.pointing.get.invalidate({ opCodigo, mpCodigo });
    await utils.production.programming.list.invalidate();
  }

  function askConfirmation(confirmationRequest: PendingConfirmation) {
    setConfirmation(confirmationRequest);
  }

  function confirmAction(message: string, action: () => void) {
    const normalized = message.toLowerCase();
    const tone: ConfirmationTone = normalized.includes("finalização") || normalized.includes("cancel") ? "caution" : normalized.includes("parada") ? "warning" : "question";
    const title = tone === "caution" ? "Confirme com cuidado" : tone === "warning" ? "Atenção à operação" : "Confirmar operação";
    askConfirmation({ tone, title, description: message, confirmLabel: "Confirmar", action });
  }

  function closeSetup(outcome: SetupOutcome) {
    if (outcome === "attended") {
      setShowInspection(true);
      return;
    }
    const labels: Record<SetupOutcome, string> = {
      attended: "ATENDIDO — iniciará a produção.",
      to_conclude: "A CONCLUIR — manterá o setup pendente.",
      cancelled: "CANCELADO — cancelará o setup desta ordem.",
    };
    askConfirmation({ tone: outcome === "cancelled" ? "caution" : "warning", title: "Finalizar setup", description: `Confirma finalizar o setup como ${labels[outcome]}`, confirmLabel: "Confirmar decisão", action: () => finishSetup.mutate({ opCodigo, mpCodigo, outcome }) });
  }

  function confirmFinish(outcome: ProductionOutcome) {
    if (invalidQuantity) return;
    if (outcome === "attended" && belowReservation) return;
    const labels: Record<ProductionOutcome, string> = { attended: "Atendido", to_conclude: "A Concluir", partial: "Parcial" };
    const reservationNote = reservation.data?.applicable ? aboveReservation ? ` A baixa de reserva está ${excessPercent}% acima da reserva de ${reservation.data.balance}.` : ` Reserva considerada: ${reservation.data.balance}.` : " Este processo não possui reserva obrigatória.";
    askConfirmation({ tone: aboveReservation ? "caution" : outcome === "attended" ? "caution" : "warning", title: "Finalizar produção", description: `Confirma finalizar como ${labels[outcome]} com ${produced} informado(s), produção calculada de ${productionQuantity} e perda calculada de ${productionLost}?${reservationNote}`, confirmLabel: `Finalizar como ${labels[outcome]}`, action: () => finishProduction.mutate({ opCodigo, mpCodigo, quantityProduced: produced, quantityLost: lost, outcome, observation, lotTrace: traceSummary }) });
  }

  function finishWith(outcome: ProductionOutcome) {
    if (invalidQuantity || (outcome === "attended" && belowReservation)) return;
    confirmFinish(outcome);
  }

  function rpncKey(checklistCode: number, itemCode: number) { return `${checklistCode}:${itemCode}`; }
  function openRpnc(origin: RpncOrigin = "product") { setRpncOrigin(origin); setRpncSelections({}); setSelectedRpncChecklistCode(null); setSelectedRpncItemCode(null); setShowRpnc(true); }
  function closeRpnc() { setShowRpnc(false); setRpncSelections({}); setSelectedRpncChecklistCode(null); setSelectedRpncItemCode(null); setResumeTraceAfterRpnc(false); }
  function changeRpncOrigin(origin: RpncOrigin) { setRpncOrigin(origin); setRpncSelections({}); setSelectedRpncChecklistCode(null); setSelectedRpncItemCode(null); }
  function selectRpncChecklist(checklistCode: number, firstItemCode: number | null) { setSelectedRpncChecklistCode(checklistCode); setSelectedRpncItemCode(firstItemCode); }
  function selectRpncItem(itemCode: number) { setSelectedRpncItemCode(itemCode); }
  function toggleRpncItem(checklistCode: number, itemCode: number, selected: boolean) {
    const key = rpncKey(checklistCode, itemCode);
    setRpncSelections((current) => {
      if (!selected) { const { [key]: _removed, ...remaining } = current; return remaining; }
      return { ...current, [key]: current[key] ?? { quantity: "", causeCodes: [], containmentAction: "" } };
    });
  }
  function updateRpncItem(checklistCode: number, itemCode: number, patch: Partial<RpncSelection>) {
    const key = rpncKey(checklistCode, itemCode);
    setRpncSelections((current) => {
      const existing = current[key];
      const next: RpncSelection = existing ? { ...existing, ...patch } : { quantity: "", causeCodes: [], containmentAction: "", ...patch };
      return { ...current, [key]: next };
    });
  }
  function toggleRpncCause(checklistCode: number, itemCode: number, causeCode: number) {
    const key = rpncKey(checklistCode, itemCode);
    const selection = rpncSelections[key] ?? { quantity: "", causeCodes: [], containmentAction: "" };
    updateRpncItem(checklistCode, itemCode, { causeCodes: selection.causeCodes.includes(causeCode) ? selection.causeCodes.filter((code) => code !== causeCode) : [...selection.causeCodes, causeCode] });
  }

  const item = pointing.data;
  const setupStarted = item?.queuePosition === "SI" || Boolean(item?.setupStartedAt);
  const productionStarted = item?.queuePosition === "PI";
  const resumedToConclude = productionStarted && !item?.activeSetupStartedAt && Boolean(item?.activeProcessStartedAt);
  const pauseActive = Boolean(item?.activePause) || pauseOpen;
  const phase = pauseActive ? "PARADA ATIVA" : productionStarted ? "EM PRODUÇÃO" : setupStarted ? "SETUP INICIADO" : "AGUARDANDO INÍCIO";
  const produced = Number(quantityProduced);
  const lost = Number(quantityLost);
  const effectiveArrangementTotal = reservation.data?.applicable ? Math.max(1, Number(reservation.data.arrangementTotal ?? 1)) : Math.max(1, Number(item?.productionArrangementTotal ?? 1));
  const productionMultiplier = item?.calculateProductionArrangement || item?.calculateReservationArrangement ? effectiveArrangementTotal : 1;
  const reservationMultiplier = 1;
  const productionQuantity = produced * productionMultiplier;
  const productionLost = lost * productionMultiplier;
  const reservationQuantity = produced * reservationMultiplier;
  const invalidQuantity = !quantityProduced || !quantityLost || !Number.isInteger(produced) || produced <= 0 || !Number.isInteger(lost) || lost < 0 || lost > produced;
  const reservationBalance = Number(reservation.data?.balance ?? 0);
  const belowReservation = Boolean(reservation.data?.applicable && reservationQuantity < reservationBalance);
  const aboveReservation = Boolean(reservation.data?.applicable && reservationQuantity > reservationBalance);
  const excessPercent = reservationBalance > 0 ? Math.round(((reservationQuantity - reservationBalance) / reservationBalance) * 100) : 0;
  const allInspectionItemsConfirmed = (inspectionChecklist.data?.length ?? 0) === confirmedInspectionCodes.length;
  const processInspectionItems = processInspectionChecklist.data?.items ?? [];
  const allProcessInspectionItemsConfirmed = processInspectionItems.length > 0 && processInspectionItems.length === confirmedProcessInspectionCodes.length;
  const processInspectionIntervalMs = Math.max(1, processInspectionChecklist.data?.intervalMinutes ?? 20) * 60_000;
  const traceMaterials = rawMaterials.data ?? [];
  const rpncSelectedItems = (rpncChecklist.data?.checklists ?? []).flatMap((checklist) => checklist.items.flatMap((checklistItem) => {
    const selection = rpncSelections[rpncKey(checklist.code, checklistItem.code)];
    return selection ? [{ checklistCode: checklist.code, itemCode: checklistItem.code, quantity: Number(selection.quantity), causeCodes: selection.causeCodes, containmentAction: selection.containmentAction }] : [];
  }));
  const rpncInvalid = !rpncSelectedItems.length || rpncSelectedItems.some((selected) => !Number.isInteger(selected.quantity) || selected.quantity < 1);
  const rpncSubmission = { origin: rpncOrigin, checklists: (rpncChecklist.data?.checklists ?? []).map((checklist) => ({ checklistCode: checklist.code, items: rpncSelectedItems.filter((selected) => selected.checklistCode === checklist.code).map(({ itemCode, quantity, causeCodes, containmentAction }) => ({ itemCode, quantity, causeCodes, containmentAction })) })).filter((checklist) => checklist.items.length > 0) };
  const activeRpncChecklist = (rpncChecklist.data?.checklists ?? []).find((checklist) => checklist.code === selectedRpncChecklistCode) ?? rpncChecklist.data?.checklists[0] ?? null;
  const activeRpncItem = activeRpncChecklist?.items.find((checklistItem) => checklistItem.code === selectedRpncItemCode) ?? activeRpncChecklist?.items[0] ?? null;
  const activeRpncSelection = activeRpncChecklist && activeRpncItem ? rpncSelections[rpncKey(activeRpncChecklist.code, activeRpncItem.code)] ?? null : null;
  const allLotsRecorded = traceMaterials.length === 0 || traceMaterials.every((material) => { const saved = lotInputs[material.structureCode]; const stored = String(material.lot ?? "").replace(/\D/g, ""); const currentLot = (saved?.first ?? stored.slice(0, 4)).length === 4 && (saved?.last ?? stored.slice(4, 8)).length === 4 ? `${saved?.first ?? stored.slice(0, 4)}.${saved?.last ?? stored.slice(4, 8)}` : ""; return validatedStructures[material.structureCode] === currentLot; });
  const traceSummary = traceMaterials.map((material) => `${material.productCode}:${material.lot ?? ""}`).filter((item) => !item.endsWith(":" )).join(" | ") || lotTrace;

  function toggleInspection(code: number) {
    setConfirmedInspectionCodes((current) => current.includes(code) ? current.filter((itemCode) => itemCode !== code) : [...current, code]);
  }

  function toggleProcessInspection(code: number) {
    setConfirmedProcessInspectionCodes((current) => current.includes(code) ? current.filter((itemCode) => itemCode !== code) : [...current, code]);
  }

  function beginTrace() {
    setLotInputs({});
    setValidatedStructures({});
    setShowTrace(true);
  }

  function openTrace() { setPendingTraceConformance(true); }
  function decideTraceConformance(conforming: boolean) {
    setPendingTraceConformance(false);
    if (conforming) { beginTrace(); return; }
    setResumeTraceAfterRpnc(true);
    openRpnc("product");
  }

  function confirmRpnc() {
    if (rpncInvalid) { toast.error("Selecione pelo menos um item Não Conforme e informe a quantidade."); return; }
    const total = rpncSelectedItems.reduce((sum, selected) => sum + selected.quantity, 0);
    askConfirmation({ tone: "caution", title: "Abrir RPNC", description: `Confirma a abertura de RPNC para ${rpncChecklist.data?.originLabel || "esta origem"} com ${rpncSelectedItems.length} não conformidade(s) e quantidade total de ${total}?`, confirmLabel: "Confirmar RPNC", action: () => submitRpnc.mutate({ opCodigo, mpCodigo, ...rpncSubmission }) });
  }

  function resetLayoutView() {
    setLayoutZoom(1);
    setLayoutPan({ x: 0, y: 0 });
  }

  function changeLayoutZoom(delta: number) {
    setLayoutZoom((value) => Math.min(5, Math.max(0.4, Number((value + delta).toFixed(2)))));
  }

  function openPrintLayout() {
    resetLayoutView();
    setShowPrintLayout(true);
  }

  useEffect(() => {
    if (showTrace && !rawMaterials.isLoading && !rawMaterials.error && rawMaterials.data && rawMaterials.data.length === 0) {
      setShowTrace(false);
      setShowFinish(true);
    }
  }, [showTrace, rawMaterials.isLoading, rawMaterials.error, rawMaterials.data]);

  useEffect(() => {
    if (!productionStarted || pauseActive || showProcessInspection || processInspectionChecklist.isLoading || !processInspectionItems.length) return;
    const timeout = window.setTimeout(() => { setConfirmedProcessInspectionCodes([]); setShowProcessInspection(true); }, processInspectionIntervalMs);
    return () => window.clearTimeout(timeout);
  }, [productionStarted, pauseActive, showProcessInspection, processInspectionChecklist.isLoading, processInspectionItems.length, processInspectionIntervalMs]);

  useEffect(() => {
    if (!productionStarted) return;
    const keepProductionOpen = () => { window.history.pushState(null, "", window.location.href); toast.warning("A produção permanece aberta", { description: "Finalize o processo para retornar à programação." }); };
    const warnBeforeExit = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", keepProductionOpen);
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => { window.removeEventListener("popstate", keepProductionOpen); window.removeEventListener("beforeunload", warnBeforeExit); };
  }, [productionStarted]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (confirmation || showInspection || showProcessInspection || showRpnc || showTrace || showFinish || pauseModalOpen || showProcessLabel) return;

      if (!setupStarted && event.key === "F1" && !startSetup.isPending) {
        event.preventDefault();
        confirmAction("Deseja iniciar o setup desta ordem?", () => startSetup.mutate({ opCodigo, mpCodigo }));
        return;
      }
      if (setupStarted && !productionStarted && !finishSetup.isPending) {
        const shortcutOutcome: Record<string, SetupOutcome> = { F1: "attended", F2: "to_conclude", F3: "cancelled" };
        const outcome = shortcutOutcome[event.key];
        if (outcome) { event.preventDefault(); closeSetup(outcome); return; }
      }
      if (event.key === "F4") { event.preventDefault(); setShowPalletization(true); return; }
      if (event.key === "F5") { event.preventDefault(); openPrintLayout(); return; }
      if (event.key === "F6") { event.preventDefault(); setShowQueueConsultation(true); return; }
      if (event.key === "F7") { event.preventDefault(); setShowReservationDetails(true); return; }
      if (event.key === "F8") { event.preventDefault(); setShowApprovedQuantities(true); return; }
      if (event.key === "F9") { event.preventDefault(); setShowRequests(true); return; }
      if (event.key === "F10") { event.preventDefault(); setShowProcessLabel(true); return; }
      if (!productionStarted) return;
      if (event.key === "F1" && !pauseActive) { event.preventDefault(); openRpnc("product"); return; }
      if (event.key === "F2") {
        event.preventDefault();
        if (pauseActive) confirmAction("Confirma a finalização da parada e a retomada da produção?", () => finishPause.mutate({ opCodigo, mpCodigo }));
        else setPauseModalOpen(true);
        return;
      }
      if (event.key === "F3" && !pauseActive) { event.preventDefault(); openTrace(); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [confirmation, finishPause, finishSetup, mpCodigo, opCodigo, pauseActive, pauseModalOpen, productionStarted, setupStarted, showFinish, showInspection, showProcessInspection, showProcessLabel, showRpnc, showTrace, startSetup]);

  return (
    <div className="theme-pointing theme-surface-muted min-h-dvh space-y-2 bg-[#f6f9f6] p-3 pb-3 min-[900px]:h-dvh min-[900px]:overflow-hidden lg:p-4">
      <header className="flex flex-col gap-2 border-b-2 border-[#cbd5ce] pb-2 xl:flex-row xl:items-center xl:justify-between">
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#64776b]">Apontamento de produção · Operador</p><h1 className="mt-0.5 text-2xl font-black tracking-[-.055em] text-[#173b2e] sm:text-3xl">{phase}</h1></div>
        {item ? <div className="flex flex-wrap items-center gap-2 xl:justify-end"><Button variant="outline" onClick={() => setShowPalletization(true)} className="h-10 border-2 border-[#467242] bg-[#f4fbef] px-3 text-sm font-black text-[#315d2e]"><Package className="mr-1.5 h-4 w-4" />Pacotes / Paletização <ShortcutKey label="F4" /></Button><Button variant="outline" onClick={openPrintLayout} className="h-10 border-2 border-[#226b9d] bg-[#eff8ff] px-3 text-sm font-black text-[#155681]"><ImageIcon className="mr-1.5 h-4 w-4" />Visualizar layout <ShortcutKey label="F5" /></Button><Button variant="outline" onClick={() => setShowQueueConsultation(true)} className="h-10 border-2 border-[#177458] bg-[#eff9f1] px-3 text-sm font-black text-[#176148]"><ListOrdered className="mr-1.5 h-4 w-4" />Consultar fila <ShortcutKey label="F6" /></Button><Button variant="outline" onClick={() => setShowReservationDetails(true)} className="h-10 border-2 border-[#e0bd50] bg-[#fff9df] px-3 text-sm font-black text-[#705511]"><Boxes className="mr-1.5 h-4 w-4" />Reserva <ShortcutKey label="F7" /></Button><Button variant="outline" onClick={() => setShowApprovedQuantities(true)} className="h-10 border-2 border-[#d2b45b] bg-[#fff8e2] px-3 text-sm font-black text-[#76550c]"><ClipboardList className="mr-1.5 h-4 w-4" />Qtde aprovada <ShortcutKey label="F8" /></Button><Button variant="outline" onClick={() => setShowRequests(true)} className="h-10 border-2 border-[#d2b45b] bg-[#fffdf2] px-3 text-sm font-black text-[#76550c]"><ClipboardList className="mr-1.5 h-4 w-4" />Solicitações <ShortcutKey label="F9" /></Button><Button variant="outline" onClick={() => setShowProcessLabel(true)} className="h-10 border-2 border-[#7e5b9a] bg-[#faf5ff] px-3 text-sm font-black text-[#633b85]"><Tag className="mr-1.5 h-4 w-4" />Etiqueta de processo <ShortcutKey label="F10" /></Button></div> : null}
      </header>

      {pointing.error ? <ConnectionNotice error={pointing.error} /> : null}
      {item ? <>
        <section className="theme-machine-band overflow-hidden rounded-2xl border-2 text-white shadow-[0_8px_18px_rgba(15,61,48,.14)]">
          <div className="grid gap-2 p-3 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#b6d8c6]">Máquina</p><h2 className="mt-0.5 text-xl font-black leading-tight tracking-[-.04em] text-[#ff5757] sm:text-2xl">{item.machineDescription || user?.machine?.description || "Máquina"}</h2><p className="mt-1 font-mono text-sm font-bold text-[#d7eadc]">OP {item.op_codigo} · Processo {item.mp_codigo}</p></div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-2.5"><p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-[#b6d8c6]">Situação</p><div className="mt-1 flex flex-wrap items-center gap-2"><StatusPill status={item.status} /><span className="rounded-lg bg-[#f2f7f2] px-2 py-0.5 font-mono text-sm font-black text-[#163c2d]">{item.queuePosition || "—"}</span></div><p className="mt-1 text-sm font-bold text-white">Operador: {String(user?.name || "—").trim().split(/\s+/)[0] || "—"}</p></div>
          </div>
        </section>

        <section className="theme-surface rounded-2xl border-2 border-[#d5e0d6] bg-white p-3 shadow-[0_6px_14px_rgba(31,42,34,.035)]">
          <div className="grid gap-x-5 gap-y-2 border-b border-[#e5ece5] pb-2 md:grid-cols-5"><Info label="Produto" value={item.productCode} prominent /><Info label="Revisão" value={item.revision} /><Info label="Referência" value={item.produto_referencia || item.referencia} /><Info label="CPC" value={item.customerProductCode} prominent /><Info label="Cliente" value={item.clientFantasy || item.client} /></div>
          <div className="mt-2 grid gap-x-5 gap-y-2 border-b border-[#e5ece5] pb-2 md:grid-cols-4"><div className="md:col-span-2"><Info label="Razão social" value={item.clientLegalName} /></div><Info label="Sentido de onda" value={item.waveDirection} /><Info label="Papelão ondulado" value={item.internalComposition} /><Info label="Fechamento" value={item.closing} /><Info label="Fechamento do LAP" value={item.lapClosing} /><Info label="Impressão" value={item.print} /><Info label="Quantidade de cores" value={item.colorCount} /><Info label="Quantidade de grampos" value={item.stapleQuantity} /></div>
          <div className="mt-2 grid gap-4 md:grid-cols-3"><Info label="Quantidade da OP" value={item.quantity} prominent /><Info label="Saldo a produzir" value={item.saldo} prominent />{reservation.data?.indicatorQuantity != null ? <div className="rounded-xl border-2 border-[#d7ab2b] bg-gradient-to-r from-[#fff3bc] via-[#fff9df] to-[#fffdf1] px-3 py-2 shadow-[0_4px_10px_rgba(151,111,14,.12)]"><p className="font-mono text-[10px] font-black uppercase tracking-[.14em] text-[#8a6512]">{reservation.data.indicatorLabel || "Quantidade reservada"}</p><p className="mt-0.5 font-mono text-2xl font-black leading-none text-[#5b4405]">{displayValue(reservation.data.indicatorQuantity)}</p><p className="mt-1 text-xs font-bold text-[#87651a]">Reserva de matéria-prima vinculada a esta OP</p></div> : null}</div>
        </section>

        <section className="grid gap-2 xl:grid-cols-[1fr_240px]"><div className="theme-surface-muted rounded-2xl border-2 border-[#d5e0d6] bg-[#f9fcf9] p-3"><div className="flex items-center gap-2 text-base font-black text-[#234437]"><Factory className="h-5 w-5 text-[#28765d]" />Especificações de ajuste</div><div className="mt-2 grid gap-2"><MeasureWithComplement label="Ajuste da largura" value={item.adjustmentWidth} complement={item.cutSheetWidth} accent="blue" /><MeasureWithComplement label="Ajuste do comprimento" value={item.adjustmentLength} complement={item.cutSheetLength} accent="red" /></div></div><div className="theme-surface rounded-2xl border-2 border-[#d5e0d6] bg-white p-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#6f8075]">Cronômetros</p><div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Timer label={setupStarted && !productionStarted ? "Início do setup" : "Início da produção"} value={formatTimestamp(setupStarted && !productionStarted ? item.setupStartedAt : (resumedToConclude ? item.activeProcessStartedAt : item.processStartedAt))} /><Timer label={setupStarted && !productionStarted ? "Fim do setup" : "Fim da produção"} value={setupStarted && !productionStarted ? (item.setupFinishedAt ? formatTimestamp(item.setupFinishedAt) : "—") : (item.processFinishedAt ? formatTimestamp(item.processFinishedAt) : "—")} /></div></div></section>

        <section className="theme-surface rounded-2xl border-2 border-[#d5e0d6] bg-white p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#e6f4ea] p-2 text-[#176148]"><ClipboardCheck className="h-5 w-5" /></div><div><p className="text-base font-black text-[#254235]">Comandos de operação</p><p className="text-xs text-[#65776b]">Cada gravação exige confirmação para proteger a ordem em produção.</p></div></div>
            {!setupStarted ? <Button disabled={startSetup.isPending} onClick={() => confirmAction("Deseja iniciar o setup desta ordem?", () => startSetup.mutate({ opCodigo, mpCodigo }))} className="theme-btn-primary h-14 bg-[#177458] px-7 text-xl font-black hover:bg-[#0f6248]"><Play className="mr-2 h-6 w-6" />{startSetup.isPending ? "Iniciando…" : "Iniciar setup"}<ShortcutKey label="F1" /></Button>
              : !productionStarted ? <div className="w-full lg:w-[620px]"><p className="mb-2 text-lg font-black text-[#254235]">Finalizar setup</p><div className="grid gap-2 sm:grid-cols-3"><SetupButton label="Atendido" description="Abrir checklist" shortcut="F1" intent="attended" disabled={finishSetup.isPending} onClick={() => closeSetup("attended")} /><SetupButton label="A concluir" description="Manter setup pendente" shortcut="F2" intent="to_conclude" disabled={finishSetup.isPending} onClick={() => closeSetup("to_conclude")} /><SetupButton label="Cancelado" description="Cancelar setup" shortcut="F3" intent="cancelled" disabled={finishSetup.isPending} onClick={() => closeSetup("cancelled")} /></div></div>
              : <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"><Button variant="outline" disabled={pauseActive} onClick={() => openRpnc("product")} className="h-14 border-2 border-[#bc7b18] bg-[#fff8e7] px-4 text-base font-black text-[#87530a]"><FileWarning className="mr-2 h-5 w-5" />Abrir RPNC <ShortcutKey label="F1" /></Button>{pauseActive ? <Button disabled={finishPause.isPending} onClick={() => confirmAction("Confirma a finalização da parada e a retomada da produção?", () => finishPause.mutate({ opCodigo, mpCodigo }))} className="h-14 bg-[#bb5c10] px-5 text-lg font-black hover:bg-[#95470a]"><TimerReset className="mr-2 h-5 w-5" />{finishPause.isPending ? "Retomando…" : "Finalizar parada"}<ShortcutKey label="F2" /></Button> : <Button variant="outline" disabled={startPause.isPending} onClick={() => setPauseModalOpen(true)} className="h-14 border-2 border-[#ba6a15] px-5 text-lg font-black text-[#8a4b09]"><TimerReset className="mr-2 h-5 w-5" />Iniciar parada <ShortcutKey label="F2" /></Button>}<Button disabled={pauseActive} onClick={openTrace} className="h-14 bg-[#177458] px-4 text-base font-black hover:bg-[#0f6248]"><ScanLine className="mr-2 h-5 w-5" />Rastrear e finalizar <ShortcutKey label="F3" /></Button></div>}
          </div>

        </section>
        <QueueConsultationDialog open={showQueueConsultation} onClose={() => setShowQueueConsultation(false)} />
        <ProcessLabelDialog open={showProcessLabel} onOpenChange={setShowProcessLabel} data={processLabel.data} loading={processLabel.isLoading || localPrinters.isLoading} error={processLabel.error || localPrinters.error} printers={localPrinters.data?.printers ?? []} printerSource={localPrinters.data?.source} opCodigo={opCodigo} mpCodigo={mpCodigo} />
        <ProductFinishedLabelDialog open={showProductFinishedLabel} onOpenChange={(next) => { setShowProductFinishedLabel(next); if (!next) setLocation("/"); }} data={productFinishedLabel.data} loading={productFinishedLabel.isLoading || localPrinters.isLoading} error={productFinishedLabel.error || localPrinters.error} printers={localPrinters.data?.printers ?? []} printerSource={localPrinters.data?.source} opCodigo={opCodigo} mpCodigo={mpCodigo} />
        <RequestDialog open={showRequests} onOpenChange={setShowRequests} />
        <ProductReservationDialog open={showReservationDetails} onOpenChange={setShowReservationDetails} opCode={opCodigo} data={reservationDetails.data} loading={reservationDetails.isLoading} error={reservationDetails.error} />
        <ApprovedProcessQuantitiesDialog open={showApprovedQuantities} onOpenChange={setShowApprovedQuantities} data={approvedQuantities.data} loading={approvedQuantities.isLoading} error={approvedQuantities.error} />
        <Dialog open={showRpnc} onOpenChange={(open) => { if (open) setShowRpnc(true); }}>
          <DialogContent onPointerDownOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()} className="!max-h-[calc(100dvh-1.25rem)] !w-[calc(100vw-1.25rem)] !max-w-[1480px] overflow-hidden border-2 border-[#b98932] bg-[#fffdf8] p-0 sm:!max-h-[calc(100dvh-3rem)] sm:!w-[calc(100vw-3rem)]">
            <DialogHeader className="border-b-2 border-[#e5d3a8] bg-[#fff7e6] px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#6f480f]"><ClipboardList className="h-6 w-6" />Checklist para inspeção</DialogTitle><DialogDescription className="mt-1 text-sm font-bold text-[#7c6a4a]">Selecione o checklist, depois o item, e registre a não conformidade apenas quando necessário.</DialogDescription></div><div className="flex flex-wrap items-center gap-3"><div className="flex rounded-xl border-2 border-[#ddcda8] bg-white p-1"><Button onClick={() => changeRpncOrigin("product")} variant="ghost" className={`h-10 px-4 text-base font-black ${rpncOrigin === "product" ? "bg-[#e5b950] text-[#603b05] hover:bg-[#d6a83c]" : "text-[#766244] hover:bg-[#fff7e7]"}`}><Package className="mr-1.5 h-4 w-4" />Produto</Button><Button onClick={() => changeRpncOrigin("raw-material")} variant="ghost" className={`h-10 px-4 text-base font-black ${rpncOrigin === "raw-material" ? "bg-[#e5b950] text-[#603b05] hover:bg-[#d6a83c]" : "text-[#766244] hover:bg-[#fff7e7]"}`}><Factory className="mr-1.5 h-4 w-4" />Matéria-prima (PO)</Button></div>{rpncChecklist.data?.origin === "raw-material" ? <div className="rounded-xl border-2 border-[#ddcda8] bg-white px-3 py-2 text-sm font-bold text-[#775e2a]">Lote: <span className="font-mono text-base font-black text-[#6f480f]">{rpncChecklist.data.lot || "0"}</span></div> : null}</div></div></DialogHeader>
            {rpncChecklist.isLoading ? <p className="p-6 text-base font-bold text-[#806d53]">Carregando checklist de inspeção…</p> : rpncChecklist.error ? <p className="m-5 rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-4 text-base font-bold text-[#9b2525]">{rpncChecklist.error.message}</p> : !rpncChecklist.data?.checklists.length ? <p className="m-5 rounded-xl border-2 border-[#e1c88d] bg-white p-5 text-center text-base font-bold text-[#806d53]">Não há checklist cadastrado para {rpncOrigin === "product" ? "Liberação de Produto" : "Inspeção de Recebimento"}.</p> : <div className="grid h-[min(54dvh,520px)] min-h-[340px] grid-cols-1 gap-0 overflow-hidden bg-[#e8dfc9] lg:grid-cols-[34%_66%]">
              <section className="min-h-0 overflow-auto border-b-2 border-[#cdb981] bg-white lg:border-b-0 lg:border-r-2"><div className="grid grid-cols-[1fr_124px] border-b-2 border-[#d9c595] bg-[#f8edd3] px-4 py-2 text-sm font-black text-[#6e521a]"><span>Descrição</span><span className="text-center">Situação</span></div>{rpncChecklist.data.checklists.map((checklist) => { const active = activeRpncChecklist?.code === checklist.code; const nonconforming = checklist.items.some((checklistItem) => Boolean(rpncSelections[rpncKey(checklist.code, checklistItem.code)])); return <button key={checklist.code} type="button" onClick={() => selectRpncChecklist(checklist.code, checklist.items[0]?.code ?? null)} className={`grid w-full grid-cols-[1fr_124px] border-b border-[#eee6d2] text-left transition-colors ${active ? "bg-[#fff3d9]" : "bg-white hover:bg-[#fffaf0]"}`}><span className="min-w-0 px-4 py-2.5 text-base font-bold text-[#433a29]">{checklist.description}</span><span className={`m-1 flex items-center justify-center rounded px-2 text-sm font-black ${nonconforming ? "bg-[#d15d4e] text-white" : "bg-[#1fcf80] text-white"}`}>{nonconforming ? "Não Conforme" : "Conforme"}</span></button>; })}</section>
              <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_156px] gap-2 p-2"><div className="min-h-0 overflow-auto rounded-xl border-2 border-[#cdb981] bg-white"><div className="grid grid-cols-[1fr_128px_90px] border-b-2 border-[#d9c595] bg-[#f8edd3] px-4 py-2 text-sm font-black text-[#6e521a]"><span>Descrição {activeRpncChecklist ? `· ${activeRpncChecklist.description}` : ""}</span><span className="text-center">Situação</span><span className="text-center">Qtde</span></div>{activeRpncChecklist?.items.map((checklistItem) => { const selected = Boolean(rpncSelections[rpncKey(activeRpncChecklist.code, checklistItem.code)]); const active = activeRpncItem?.code === checklistItem.code; const selection = rpncSelections[rpncKey(activeRpncChecklist.code, checklistItem.code)]; return <button key={checklistItem.code} type="button" onClick={() => selectRpncItem(checklistItem.code)} className={`grid w-full grid-cols-[1fr_128px_90px] border-b border-[#eee6d2] text-left ${active ? "bg-[#fff3d9]" : "bg-white hover:bg-[#fffaf0]"}`}><span className="min-w-0 px-4 py-2.5 text-base font-bold text-[#433a29]">{checklistItem.description}</span><span className={`m-1 flex items-center justify-center rounded px-2 text-sm font-black ${selected ? "bg-[#d15d4e] text-white" : "bg-[#1fcf80] text-white"}`}>{selected ? "Não Conforme" : "Conforme"}</span><span className="flex items-center justify-center font-mono text-base font-black text-[#7a5418]">{selected ? selection?.quantity || "—" : "—"}</span></button>; })}</div>
                <div className="min-h-0 overflow-auto rounded-xl border-2 border-[#cdb981] bg-white"><div className="grid grid-cols-[1fr_128px] border-b-2 border-[#d9c595] bg-[#f8edd3] px-4 py-2 text-sm font-black text-[#6e521a]"><span>Causa aparente{activeRpncItem ? ` · ${activeRpncItem.description}` : ""}</span><span className="text-center">Situação</span></div>{activeRpncItem?.causes.length ? activeRpncItem.causes.map((cause) => <button key={cause.code} type="button" disabled={!activeRpncSelection} onClick={() => activeRpncChecklist && activeRpncItem && toggleRpncCause(activeRpncChecklist.code, activeRpncItem.code, cause.code)} className={`grid w-full grid-cols-[1fr_128px] border-b border-[#eee6d2] text-left disabled:opacity-50 ${activeRpncSelection?.causeCodes.includes(cause.code) ? "bg-[#fff3d9]" : "bg-white hover:bg-[#fffaf0]"}`}><span className="min-w-0 px-4 py-2.5 text-base font-bold text-[#433a29]">{cause.description}</span><span className={`m-1 flex items-center justify-center rounded px-2 text-sm font-black ${activeRpncSelection?.causeCodes.includes(cause.code) ? "bg-[#d15d4e] text-white" : "bg-[#1fcf80] text-white"}`}>{activeRpncSelection?.causeCodes.includes(cause.code) ? "Não Conforme" : "Conforme"}</span></button>) : <p className="p-4 text-sm font-bold text-[#806d53]">{activeRpncSelection ? "Não há causa aparente cadastrada para este item." : "Marque o item como Não Conforme para registrar a causa aparente."}</p>}</div></section>
            </div>}
            <div className="flex flex-col gap-3 border-t-2 border-[#e5d3a8] bg-[#fffaf0] px-5 py-4 lg:flex-row lg:items-end"><div className="shrink-0">{activeRpncChecklist && activeRpncItem ? <><p className="mb-1 text-sm font-black text-[#6f480f]">Situação do item</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => toggleRpncItem(activeRpncChecklist.code, activeRpncItem.code, false)} className={`h-12 border-2 text-sm font-black ${!activeRpncSelection ? "border-[#68a77a] bg-[#eaf7ee] text-[#296540]" : "border-[#d6dfd5] bg-white text-[#70806f]"}`}>Conforme</Button><Button variant="outline" onClick={() => toggleRpncItem(activeRpncChecklist.code, activeRpncItem.code, true)} className={`h-12 border-2 text-sm font-black ${activeRpncSelection ? "border-[#c54e39] bg-[#fff0ed] text-[#a33625]" : "border-[#e1c8c2] bg-white text-[#8b675f]"}`}>Não Conforme</Button></div></> : null}</div>{activeRpncChecklist && activeRpncItem && activeRpncSelection ? <label className="flex w-20 shrink-0 flex-col gap-1 text-sm font-black text-[#6f480f]"><span>Qtde <span className="text-[#b82727]">*</span></span><input inputMode="numeric" value={activeRpncSelection.quantity} onChange={(event) => updateRpncItem(activeRpncChecklist.code, activeRpncItem.code, { quantity: event.target.value.replace(/\D/g, "") })} className="h-12 w-full min-w-0 rounded-lg border-2 border-[#dcb96d] bg-white px-2 text-lg font-black text-[#6f470a]" /></label> : null}{activeRpncChecklist && activeRpncItem && activeRpncSelection ? <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-black text-[#6f480f]"><span>Ação de contenção</span><textarea value={activeRpncSelection.containmentAction} onChange={(event) => updateRpncItem(activeRpncChecklist.code, activeRpncItem.code, { containmentAction: event.target.value })} className="h-12 min-h-12 w-full resize-none rounded-lg border-2 border-[#dfc88e] bg-white px-3 py-2 text-sm font-medium text-[#52432d]" /></label> : <p className="flex-1 self-center text-sm font-bold text-[#806d53]">Selecione um item e altere sua situação para Não Conforme para informar a quantidade e a ação.</p>}<div className="flex shrink-0 gap-3 lg:justify-end"><Button variant="outline" onClick={closeRpnc} className="h-14 border-2 border-[#b8a788] px-5 text-base font-black">Cancelar</Button><Button disabled={rpncInvalid || submitRpnc.isPending || rpncChecklist.isLoading} onClick={confirmRpnc} className="h-14 bg-[#23965c] px-6 text-lg font-black hover:bg-[#177546]"><CheckCircle2 className="mr-2 h-5 w-5" />{submitRpnc.isPending ? "Gravando…" : "Confirmar"}</Button></div></div>
          </DialogContent>
        </Dialog>
        <Dialog open={false} onOpenChange={(open) => { setShowRpnc(open); if (!open) setRpncSelections({}); }}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1320px] overflow-y-auto border-2 border-[#ba7917] bg-[#fffaf1] p-5 sm:p-6">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#784808]"><ClipboardList className="h-6 w-6" />Checklist para inspeção do produto</DialogTitle><DialogDescription className="text-base font-bold text-[#806d53]">Marque somente os itens Não Conforme, informe a quantidade e, quando existir, a causa aparente.</DialogDescription></DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Button onClick={() => changeRpncOrigin("product")} variant="outline" className={`h-14 border-2 text-lg font-black ${rpncOrigin === "product" ? "border-[#a6660e] bg-[#f7cf73] text-[#653a06]" : "border-[#d4c5a9] bg-white text-[#6c6252]"}`}><Package className="mr-2 h-5 w-5" />Produto</Button><Button onClick={() => changeRpncOrigin("raw-material")} variant="outline" className={`h-14 border-2 text-lg font-black ${rpncOrigin === "raw-material" ? "border-[#a6660e] bg-[#f7cf73] text-[#653a06]" : "border-[#d4c5a9] bg-white text-[#6c6252]"}`}><Factory className="mr-2 h-5 w-5" />Matéria-prima (PO)</Button></div>
            {rpncChecklist.data?.origin === "raw-material" ? <div className="mt-3 rounded-xl border-2 border-[#e1c88d] bg-white p-3 text-base font-bold text-[#725926]">Lote identificado: <span className="font-mono text-lg font-black text-[#784808]">{rpncChecklist.data.lot || "—"}</span>{rpncChecklist.data.supplierCode ? <span className="ml-4">Fornecedor: {rpncChecklist.data.supplierCode}</span> : null}</div> : null}
            {rpncChecklist.isLoading ? <p className="mt-5 text-base font-bold text-[#806d53]">Carregando checklist de inspeção…</p> : rpncChecklist.error ? <p className="mt-5 rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-4 text-base font-bold text-[#9b2525]">{rpncChecklist.error.message}</p> : !rpncChecklist.data?.checklists.length ? <p className="mt-5 rounded-xl border-2 border-[#e1c88d] bg-white p-5 text-center text-base font-bold text-[#806d53]">Não há checklist cadastrado para {rpncOrigin === "product" ? "Liberação de Produto" : "Inspeção de Recebimento"}.</p> : <div className="mt-5 space-y-4">{rpncChecklist.data.checklists.map((checklist) => <section key={checklist.code} className="overflow-hidden rounded-2xl border-2 border-[#e3c98d] bg-white"><header className="flex flex-col gap-2 border-b border-[#eee0bf] bg-[#fff6df] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-xs font-black uppercase tracking-[.14em] text-[#987022]">Checklist</p><h3 className="text-xl font-black text-[#6d470e]">{checklist.description}</h3>{checklist.fullDescription ? <p className="mt-1 text-sm font-bold text-[#806d53]">{checklist.fullDescription}</p> : null}</div><span className="rounded-full bg-[#fff] px-3 py-1 text-sm font-black text-[#8a641a]">{checklist.items.filter((checklistItem) => Boolean(rpncSelections[rpncKey(checklist.code, checklistItem.code)])).length}/{checklist.items.length} não conforme(s)</span></header><div className="divide-y divide-[#f0e5cb]">{checklist.items.map((checklistItem) => { const key = rpncKey(checklist.code, checklistItem.code); const selection = rpncSelections[key]; const selected = Boolean(selection); return <div key={checklistItem.code} className={`p-4 ${selected ? "bg-[#fff9ed]" : "bg-white"}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="text-lg font-black text-[#483919]">{checklistItem.description}</p>{checklistItem.definition ? <p className="mt-1 text-sm font-bold text-[#7d725f]">{checklistItem.definition}</p> : null}</div><div className="flex shrink-0 flex-wrap items-center gap-2"><Button variant="outline" onClick={() => toggleRpncItem(checklist.code, checklistItem.code, false)} className={`h-11 border-2 px-4 text-sm font-black ${!selected ? "border-[#9fc3a9] bg-[#ecf7ee] text-[#28613a]" : "border-[#d6dfd5] bg-white text-[#70806f]"}`}><CheckCircle2 className="mr-1.5 h-4 w-4" />Conforme</Button><Button variant="outline" onClick={() => toggleRpncItem(checklist.code, checklistItem.code, true)} className={`h-11 border-2 px-4 text-sm font-black ${selected ? "border-[#c54e39] bg-[#fff0ed] text-[#a33625]" : "border-[#e1c8c2] bg-white text-[#8b675f]"}`}><FileWarning className="mr-1.5 h-4 w-4" />Não Conforme</Button></div></div>{selected ? <div className="mt-4 grid gap-3 rounded-xl border border-[#efdbb1] bg-white p-3 lg:grid-cols-[150px_minmax(0,1fr)]"><label className="grid gap-1 text-sm font-black text-[#6c4c14]">Qtde <span className="text-[#b82727]">*</span><input inputMode="numeric" value={selection.quantity} onChange={(event) => updateRpncItem(checklist.code, checklistItem.code, { quantity: event.target.value.replace(/\D/g, "") })} className="h-12 rounded-lg border-2 border-[#dcb96d] bg-white px-3 text-xl font-black text-[#6f470a]" /></label><div>{checklistItem.causes.length ? <><p className="text-sm font-black text-[#6c4c14]">Causa aparente</p><div className="mt-2 flex flex-wrap gap-2">{checklistItem.causes.map((cause) => <label key={cause.code} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-bold ${selection.causeCodes.includes(cause.code) ? "border-[#c37c20] bg-[#fff0c7] text-[#704608]" : "border-[#e4d8bf] bg-white text-[#726757]"}`}><input type="checkbox" checked={selection.causeCodes.includes(cause.code)} onChange={() => toggleRpncCause(checklist.code, checklistItem.code, cause.code)} className="h-4 w-4 accent-[#b77416]" />{cause.description}</label>)}</div><label className="mt-3 grid gap-1 text-sm font-black text-[#6c4c14]">Ação de contenção<textarea value={selection.containmentAction} onChange={(event) => updateRpncItem(checklist.code, checklistItem.code, { containmentAction: event.target.value })} className="min-h-16 rounded-lg border-2 border-[#dfc88e] bg-white px-3 py-2 text-sm font-medium text-[#52432d]" /></label></> : <p className="rounded-lg bg-[#f9f7f1] p-3 text-sm font-bold text-[#756d60]">Não há causa aparente cadastrada para este item.</p>}</div></div> : null}</div>; })}</div></section>)}</div>}
            <div className="mt-5 flex flex-col gap-3 border-t border-[#e4d5b4] pt-5 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setShowRpnc(false)} className="h-14 border-2 border-[#b8a788] px-6 text-lg font-black">Cancelar</Button><Button disabled={rpncInvalid || submitRpnc.isPending || rpncChecklist.isLoading} onClick={confirmRpnc} className="h-14 bg-[#b87914] px-6 text-lg font-black hover:bg-[#8f5b0c]"><CheckCircle2 className="mr-2 h-5 w-5" />{submitRpnc.isPending ? "Gravando…" : "Confirmar RPNC"}</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={showPalletization} onOpenChange={setShowPalletization}>
          <DialogContent className="!max-h-[calc(100dvh-1.25rem)] !w-[calc(100vw-1.25rem)] !max-w-[1440px] overflow-y-auto border-2 border-[#2a765a] bg-[#f7fbf5] p-4 sm:!max-h-[calc(100dvh-3rem)] sm:!w-[calc(100vw-3rem)] sm:p-6">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#315d2e]"><Package className="h-6 w-6" />Pacotes / Paletização</DialogTitle><DialogDescription className="text-base font-bold text-[#62765d]">Configuração de embalagem da ficha do produto para o cliente atual.</DialogDescription></DialogHeader>
            {palletization.isLoading ? <p className="mt-4 text-base font-bold text-[#62765d]">Consultando configuração de pacotes e palete…</p> : palletization.error ? <p className="mt-4 rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-4 text-base font-bold text-[#9b2525]">{palletization.error.message}</p> : !palletization.data?.registered ? <div className="mt-4 rounded-xl border-2 border-[#a9bda4] bg-white p-6 text-center"><p className="text-xl font-black text-[#3d5c39]">Não cadastrado.</p><p className="mt-2 text-base font-bold text-[#687a67]">Não há configuração de Pacotes / Paletização para este produto, revisão e cliente.</p></div> : <div className={`mt-4 grid min-w-0 gap-4 ${palletization.data.palletized ? "min-[1000px]:grid-cols-[minmax(0,.9fr)_minmax(420px,1.1fr)]" : "grid-cols-1"}`}>
              <div className="space-y-4">
                <section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black text-[#315d2e]">Pacotes</h3><span className="rounded-full bg-[#e4f2df] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#3f6e39]">{palletization.data.customerSpecific ? "Cadastro do cliente" : "Cadastro padrão"}</span></div><div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-base font-bold text-[#3d4f3b]"><LegacyField label="Tipo:" value={palletization.data.packageType} grow /><LegacyField label="Qtde:" value={palletization.data.packageQuantity} /><LegacyField label="Fitas Pacote L:" value={palletization.data.packageStrapsWidth} /><LegacyField label="C:" value={palletization.data.packageStrapsLength} /></div></section>
                {palletization.data.palletized ? <><section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4"><h3 className="text-xl font-black text-[#315d2e]">Palete</h3><div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-base font-bold text-[#3d4f3b]"><LegacyField label="Tipo do Palete:" value={palletization.data.palletDescription} grow /><LegacyField label="Remontado:" value={palletization.data.remounted ? "Sim" : "Não"} /><LegacyField label="Altura Máxima do Palete:" value={palletization.data.maximumHeight} /><span>Medidas (mm):</span><LegacyField label="L:" value={palletization.data.palletWidth} /><LegacyField label="C:" value={palletization.data.palletLength} /><LegacyField label="Lastro L:" value={palletization.data.packagesPerLayer} /><LegacyField label="Qtde de Pacotes na Altura:" value={palletization.data.packagesHigh} /><LegacyField label="Total Pacotes:" value={palletization.data.totalPackages} /><LegacyField label="Total de Unid:" value={palletization.data.totalProducts} /></div></section>
                <section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4"><div className="flex flex-wrap gap-x-7 gap-y-3 text-base font-bold text-[#3d4f3b]"><LegacyCheckbox label="Arqueado" checked={palletization.data.arched} /><LegacyCheckbox label="Espelho" checked={palletization.data.mirrored} /><LegacyCheckbox label="Cantoneira" checked={palletization.data.cornerProtector} /><LegacyCheckbox label="Filme Stretch" checked={palletization.data.stretchFilm} /></div><div className="mt-4 flex flex-wrap items-baseline gap-x-7 gap-y-3 text-base font-bold text-[#3d4f3b]"><LegacyField label="Fitas no Palete: L:" value={palletization.data.palletStrapsWidth} /><LegacyField label="C:" value={palletization.data.palletStrapsLength} /></div></section></> : null}
                <section className="rounded-2xl border-2 border-[#d6c796] bg-[#fffdf3] p-4"><h3 className="text-xl font-black text-[#755c18]">Observação</h3><p className="mt-2 min-h-28 whitespace-pre-wrap rounded-xl border border-[#e5d8a5] bg-white p-3 text-base font-bold leading-relaxed text-[#564818]">{palletization.data.observation || "—"}</p></section>
              </div>
              {palletization.data.palletized ? <PalletizationImage title="Lastro de Amarração" description={palletization.data.layerDescription} imageDataUri={palletization.data.layerImageDataUri} imageError={palletization.data.layerImageError} /> : null}
            </div>}
            <div className="mt-5 flex justify-end"><Button onClick={() => setShowPalletization(false)} className="h-12 rounded-lg bg-[#cf3f3f] px-6 text-base font-black text-white hover:bg-[#ad2e2e]">Fechar</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={showPrintLayout} onOpenChange={(open) => { setShowPrintLayout(open); if (!open) setLayoutDrag(null); }}>
          <DialogContent className="!fixed !inset-0 !h-dvh !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 bg-white p-0 text-white">
            <DialogHeader className="sr-only"><DialogTitle>Layout de impressão</DialogTitle><DialogDescription>Visualização ampliada do layout da ficha de impressão.</DialogDescription></DialogHeader>
            <div className="flex h-full min-h-0 flex-col"><header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#92c7a3] bg-[#d9f2df] px-3 py-2 shadow-sm"><div className="mr-auto flex min-w-0 flex-1 flex-wrap items-center gap-2"><ImageIcon className="h-5 w-5 shrink-0 text-[#176148]" /><span className="text-xs font-black uppercase tracking-wide text-[#356d4a]">Produto</span><span className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm">{item.customerProductCode || item.produto_referencia || "—"}</span><span className="text-xs font-black uppercase tracking-wide text-[#356d4a]">Rev.</span><span className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm">{item.revision ?? "—"}</span>{printLayout.data?.cliches.map((cliche) => <span key={`${cliche.code}-${cliche.series}`} className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm">Clichê {cliche.code}{cliche.series ? `/${cliche.series}` : ""}</span>)}{printLayout.data?.colors.map((color) => <span key={`${color.order}-${color.description}`} data-contrast={colorChipContrastTone(color.hexWhite)} className="layout-color-chip rounded border px-3 py-1 text-sm font-black shadow-sm" style={colorChipStyle(color.hexWhite)}>{color.description}</span>)}</div><div className="flex items-center rounded-lg border border-[#70aa83] bg-white text-[#185d3b] shadow-sm"><Button variant="ghost" onClick={() => changeLayoutZoom(-0.2)} className="h-10 rounded-r-none px-3 text-[#185d3b] hover:bg-[#edf8f0]"><Minus className="h-5 w-5" /></Button><span className="min-w-14 text-center text-sm font-black">{Math.round(layoutZoom * 100)}%</span><Button variant="ghost" onClick={() => changeLayoutZoom(.2)} className="h-10 rounded-l-none px-3 text-[#185d3b] hover:bg-[#edf8f0]"><Plus className="h-5 w-5" /></Button></div><Button variant="outline" onClick={resetLayoutView} className="h-10 border-[#70aa83] bg-white px-3 text-sm font-black text-[#185d3b] shadow-sm hover:bg-[#f1fbf3]"><RotateCcw className="mr-1.5 h-4 w-4" />Ajustar</Button><Button onClick={() => setShowPrintLayout(false)} className="h-10 rounded-lg bg-[#cf3f3f] px-3 text-sm font-black text-white hover:bg-[#ad2e2e]">Fechar</Button></header>
              <div className="relative min-h-0 flex-1 overflow-hidden bg-white" onWheel={(event) => { event.preventDefault(); changeLayoutZoom(event.deltaY < 0 ? 0.15 : -0.15); }} onPointerMove={(event) => { if (!layoutDrag) return; setLayoutPan({ x: layoutDrag.panX + event.clientX - layoutDrag.x, y: layoutDrag.panY + event.clientY - layoutDrag.y }); }} onPointerUp={() => setLayoutDrag(null)} onPointerLeave={() => setLayoutDrag(null)}>
                {printLayout.isLoading ? <p className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#476171]">Carregando layout e recursos de impressão…</p> : printLayout.error ? <p className="absolute inset-0 m-auto h-fit max-w-xl rounded-xl border-2 border-[#e5a6a6] bg-[#fff2f2] p-5 text-center text-base font-bold text-[#a21d1d]">{printLayout.error.message}</p> : printLayout.data?.svgDataUri ? <div className="flex h-full w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setLayoutDrag({ x: event.clientX, y: event.clientY, panX: layoutPan.x, panY: layoutPan.y }); }}><img src={printLayout.data.svgDataUri} alt={`Layout do produto ${printLayout.data.productCode}`} draggable={false} className="max-h-[88vh] max-w-[94vw] select-none object-contain transition-transform duration-75" style={{ transform: `translate(${layoutPan.x}px, ${layoutPan.y}px) scale(${layoutZoom})` }} /></div> : <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-base font-bold text-[#476171]">{printLayout.data?.layoutError || "Não há SVG cadastrado para esta ficha de impressão."}</div>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showInspection}>
          <DialogContent onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()} className="max-h-[88vh] max-w-4xl overflow-y-auto border-2 border-[#24745a] bg-[#eff8f2] p-5 sm:p-6">
            <DialogHeader><DialogTitle className="text-2xl font-black text-[#174a38]">Checklist de liberação de máquina</DialogTitle><DialogDescription className="text-base font-bold text-[#557064]">Confirme todos os itens antes de iniciar a produção.</DialogDescription></DialogHeader>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[#c6ddd0] bg-white px-3 py-2"><p className="text-sm font-bold text-[#557064]">Itens confirmados</p><span className="rounded-full bg-[#e6f4ea] px-3 py-1 text-base font-black text-[#185d45]">{confirmedInspectionCodes.length}/{inspectionChecklist.data?.length ?? 0}</span></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{inspectionChecklist.isLoading ? <p className="text-base font-bold text-[#557064]">Carregando itens de inspeção…</p> : inspectionChecklist.data?.map((inspectionItem) => <label key={inspectionItem.code} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-[#c6ddd0] bg-white px-4 text-lg font-bold leading-tight text-[#254235]"><input type="checkbox" checked={confirmedInspectionCodes.includes(inspectionItem.code)} onChange={() => toggleInspection(inspectionItem.code)} className="h-7 w-7 shrink-0 accent-[#177458]" />{inspectionItem.description}</label>)}</div>
            {inspectionChecklist.error ? <p className="mt-3 text-base font-bold text-[#b82727]">Não foi possível carregar os itens do checklist.</p> : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => { setShowInspection(false); setConfirmedInspectionCodes([]); }} className="h-14 border-2 border-[#95aa9d] px-6 text-lg font-black">Voltar</Button><Button disabled={!allInspectionItemsConfirmed || completeInspection.isPending || inspectionChecklist.isLoading} onClick={() => confirmAction("Confirma todos os itens de liberação de máquina e inicia a produção?", () => completeInspection.mutate({ opCodigo, mpCodigo, confirmedCodes: confirmedInspectionCodes }))} className="h-14 bg-[#177458] px-6 text-lg font-black hover:bg-[#0f6248]">{completeInspection.isPending ? "Confirmando…" : "Confirmar e iniciar produção"}</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={showProcessInspection}>
          <DialogContent onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()} className="!max-h-[calc(100dvh-1.25rem)] !w-[calc(100vw-1.25rem)] !max-w-[1560px] overflow-hidden border-2 border-[#0c9aa8] bg-[#f7feff] p-0 sm:!w-[calc(100vw-3rem)]">
            <DialogHeader className="border-b-4 border-white bg-[#10dfe8] px-5 py-3 text-center sm:px-8"><div className="flex flex-col items-center"><AlertTriangle className="h-7 w-7 text-[#e31919]" /><DialogTitle className="mt-1 text-3xl font-black uppercase tracking-[.08em] text-[#e31919] sm:text-4xl">Atenção</DialogTitle><DialogDescription className="mt-1 text-sm font-black text-[#17404b]">Inspeção de Processo obrigatória</DialogDescription></div></DialogHeader>
            <div className="flex max-h-[calc(100dvh-148px)] min-h-0 flex-col p-4 sm:p-5"><div className="flex shrink-0 flex-col gap-2 rounded-xl border-2 border-[#94d7df] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[11px] font-black uppercase tracking-[.14em] text-[#176b76]">Produção em andamento</p><p className="mt-0.5 text-base font-black text-[#143f47]">Selecione todos os itens antes de retornar ao apontamento.</p></div><span className="self-start rounded-full bg-[#d9fbfd] px-4 py-2 text-base font-black text-[#0d6e79] sm:self-auto">{confirmedProcessInspectionCodes.length}/{processInspectionItems.length}</span></div>
              {processInspectionChecklist.isLoading ? <p className="flex flex-1 items-center justify-center py-8 text-center text-lg font-bold text-[#47757a]">Carregando itens da Inspeção de Processo…</p> : processInspectionChecklist.error ? <p className="mt-3 rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-4 text-base font-bold text-[#9b2525]">Não foi possível carregar os itens: {processInspectionChecklist.error.message}</p> : !processInspectionItems.length ? <p className="mt-3 rounded-xl border-2 border-[#e3ba77] bg-[#fff8e8] p-4 text-base font-bold text-[#7e5008]">Não há itens de Inspeção de Processo cadastrados para o grupo desta máquina. O aviso não será exibido até que os itens sejam cadastrados.</p> : <div className="mt-3 grid flex-1 grid-cols-1 content-start gap-2 sm:grid-cols-2 lg:grid-cols-3">{processInspectionItems.map((inspectionItem) => <label key={inspectionItem.code} className={`flex min-h-[104px] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-base font-black leading-tight transition-colors ${confirmedProcessInspectionCodes.includes(inspectionItem.code) ? "border-[#0b9ba6] bg-[#e2fbfc] text-[#0d5260]" : "border-[#a9d5d9] bg-white text-[#254b52] hover:bg-[#f0fdfe]"}`}><input type="checkbox" checked={confirmedProcessInspectionCodes.includes(inspectionItem.code)} onChange={() => toggleProcessInspection(inspectionItem.code)} className="h-6 w-6 shrink-0 accent-[#089ba7]" /><span title={inspectionItem.description} className="[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{inspectionItem.description}</span></label>)}</div>}
              <div className="mt-3 flex shrink-0 justify-end border-t border-[#c7e7ea] pt-3"><Button disabled={!allProcessInspectionItemsConfirmed || completeProcessInspection.isPending || processInspectionChecklist.isLoading} onClick={() => completeProcessInspection.mutate({ opCodigo, mpCodigo, confirmedCodes: confirmedProcessInspectionCodes })} className="h-12 min-w-72 bg-[#177458] px-6 text-base font-black hover:bg-[#0f6248]">{completeProcessInspection.isPending ? "Registrando inspeção…" : "Confirmar Inspeção de Processo"}</Button></div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
          <DialogContent className="!max-h-[calc(100dvh-1.25rem)] !w-[calc(100vw-1.25rem)] !max-w-[1540px] overflow-hidden border-2 border-[#ba6a15] bg-[#fffaf3] p-5 sm:!w-[calc(100vw-3rem)] sm:p-6">
            <DialogHeader><DialogTitle className="text-2xl font-black text-[#783f08]">Iniciar parada</DialogTitle><DialogDescription className="text-base font-bold text-[#7c6a58]">Escolha o motivo da parada da máquina para registrar no histórico.</DialogDescription></DialogHeader>
            <div className="mt-4 grid max-h-[calc(100dvh-15rem)] gap-3 overflow-hidden min-[820px]:grid-cols-2">{pauseReasons.isLoading ? <p className="text-base font-bold text-[#7c6a58]">Carregando motivos de parada…</p> : pauseReasons.data?.map((reason) => <Button key={reason.code} variant="outline" disabled={startPause.isPending} onClick={() => confirmAction(`Confirma o início da parada pelo motivo: ${reason.description}?`, () => startPause.mutate({ opCodigo, mpCodigo, reasonCode: reason.code }))} className="h-auto min-h-[84px] justify-start whitespace-normal border-2 border-[#dfc19a] bg-white px-5 py-3 text-left text-[17px] font-black leading-[1.18] text-[#783f08] hover:bg-[#fff1dc]"><span title={reason.description} className="[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{reason.description}</span></Button>)}</div>
            {!pauseReasons.isLoading && !pauseReasons.data?.length ? <p className="mt-3 rounded-lg border border-[#dfc19a] bg-white p-3 text-base font-bold text-[#8a4b09]">Não há motivos de parada cadastrados para o grupo desta máquina.</p> : null}
            {pauseReasons.error ? <p className="mt-3 text-base font-bold text-[#b82727]">Não foi possível carregar os motivos de parada.</p> : null}
            <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setPauseModalOpen(false)} className="h-14 border-2 border-[#cf3f3f] bg-[#cf3f3f] px-6 text-lg font-black text-white hover:bg-[#ad2e2e] hover:text-white">Cancelar</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={showTrace} onOpenChange={setShowTrace}>
          <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto border-2 border-[#177458] bg-[#f5fbf6] p-5 sm:max-w-[1120px] sm:p-6">
            <DialogHeader><DialogTitle className="text-2xl font-black text-[#173b2e]">Rastreio de matérias-primas</DialogTitle><DialogDescription className="text-base font-bold text-[#607568]">Informe e valide o lote de cada matéria-prima antes de finalizar a produção.</DialogDescription></DialogHeader>
            <div className="mt-4 grid gap-3">{rawMaterials.isLoading ? <p className="text-base font-bold text-[#607568]">Carregando estrutura da ordem…</p> : traceMaterials.map((material) => { const storedDigits = String(material.lot ?? "").replace(/\D/g, ""); const savedInput = lotInputs[material.structureCode]; const first = savedInput?.first ?? storedDigits.slice(0, 4); const last = savedInput?.last ?? storedDigits.slice(4, 8); const currentLot = first.length === 4 && last.length === 4 ? `${first}.${last}` : ""; const validated = validatedStructures[material.structureCode] === currentLot; return <div key={material.structureCode} className="overflow-x-auto rounded-xl border-2 border-[#c8dfcf] bg-white p-4"><div className="grid min-w-[860px] grid-cols-[minmax(330px,1fr)_auto] items-center gap-4"><p className="whitespace-nowrap text-lg font-black text-[#284535]">{material.productName}</p><div className="flex items-center gap-2"><input inputMode="numeric" pattern="[0-9]*" maxLength={4} value={first} onChange={(event) => setLotInputs((current) => ({ ...current, [material.structureCode]: { first: event.target.value.replace(/\D/g, "").slice(0, 4), last } }))} placeholder="0000" aria-label={`Primeiros quatro dígitos do lote de ${material.productName}`} className="h-12 w-20 rounded-lg border-2 border-[#8ab69a] px-2 text-center font-mono text-base font-black text-[#193d2c]" /><span className="font-mono text-xl font-black text-[#28765d]">.</span><input inputMode="numeric" pattern="[0-9]*" maxLength={4} value={last} onChange={(event) => setLotInputs((current) => ({ ...current, [material.structureCode]: { first, last: event.target.value.replace(/\D/g, "").slice(0, 4) } }))} placeholder="0000" aria-label={`Últimos quatro dígitos do lote de ${material.productName}`} className="h-12 w-20 rounded-lg border-2 border-[#8ab69a] px-2 text-center font-mono text-base font-black text-[#193d2c]" /><Button disabled={validateLot.isPending || !currentLot} onClick={() => confirmAction(`Confirma o lote ${currentLot} para ${material.productName}?`, () => validateLot.mutate({ opCodigo, structureCode: material.structureCode, lot: currentLot }))} className="h-12 min-w-28 bg-[#177458] px-5 text-base font-black hover:bg-[#0f6248]">{validated ? "Validado" : "Validar"}</Button></div></div></div>; })}</div>
            {rawMaterials.error ? <p className="mt-3 rounded-lg border-2 border-[#d68b8b] bg-[#fff1f1] p-3 text-base font-bold text-[#9b2525]">Erro do rastreio: {rawMaterials.error.message}</p> : null}
            {!rawMaterials.isLoading && !traceMaterials.length ? <p className="mt-3 rounded-lg border border-[#c8dfcf] bg-white p-3 text-base font-bold text-[#28765d]">Nenhuma matéria-prima foi encontrada na estrutura desta ordem.</p> : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setShowTrace(false)} className="h-14 border-2 border-[#98b8a3] px-6 text-lg font-black">Voltar</Button><Button disabled={!allLotsRecorded || rawMaterials.isLoading} onClick={() => { setShowTrace(false); setShowFinish(true); }} className="h-14 bg-[#177458] px-6 text-lg font-black hover:bg-[#0f6248]">Avançar para finalização</Button></div>
          </DialogContent>
        </Dialog>
        <Dialog open={showFinish} onOpenChange={setShowFinish}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-4xl overflow-x-hidden overflow-y-auto border-2 border-[#177458] bg-[#f5fbf6] p-3 min-[780px]:p-5">
            <DialogHeader><DialogTitle className="text-xl font-black text-[#173b2e] min-[780px]:text-2xl">Finalizar produção</DialogTitle><DialogDescription className="text-sm font-bold text-[#607568] min-[780px]:text-base">Registre as quantidades e escolha o resultado operacional da produção.</DialogDescription></DialogHeader>
            {reservation.isLoading ? <div className="mt-3 animate-pulse rounded-xl bg-[#e8f5eb] p-3 text-sm font-bold text-[#28613a]">Consultando reserva de estoque…</div> : reservation.data?.applicable ? <div className="mt-3 rounded-xl border-2 border-[#b8d9c0] bg-white p-3"><p className="font-mono text-xs font-black uppercase tracking-[.13em] text-[#4e7a5b]">Reserva de estoque · {reservation.data.groupLabel}</p><div className="mt-1 grid gap-1 min-[780px]:grid-cols-3"><p className="text-base font-black text-[#284535]">Quantidade reservada: <span className="font-mono text-xl text-[#177458]">{reservation.data.quantity}</span></p><p className="text-base font-black text-[#284535]">Saldo reservado: <span className="font-mono text-xl text-[#177458]">{reservation.data.balance}</span></p><p className="text-base font-black text-[#284535]">Arranjo da reserva: <span className="font-mono text-xl text-[#8b6413]">{reservation.data.arrangementLength} × {reservation.data.arrangementColumns}</span></p></div><p className="mt-1 text-xs font-bold text-[#56705c]">Com reserva vinculada, a baixa considera a quantidade informada; o arranjo da reserva calcula a produção quando habilitado pelo processo.</p></div> : <div className="mt-3 rounded-xl border border-[#c8dfcf] bg-white p-3 text-sm font-bold text-[#607568]">Este processo não exige reserva de estoque para finalizar; será usado o saldo geral do processo.</div>}
            {productionMultiplier > 1 || reservationMultiplier > 1 ? <div className="mt-3 grid gap-2 rounded-xl border-2 border-[#94b8a1] bg-[#edf7ef] p-3 text-sm font-bold text-[#284535] min-[780px]:grid-cols-3"><p>Arranjo produtivo: <strong>{productionMultiplier}×</strong></p><p>Produção resultante: <strong className="font-mono text-[#177458]">{productionQuantity}</strong></p><p>Baixa de reserva: <strong className="font-mono text-[#8b6413]">{reservationQuantity}</strong></p></div> : null}
            <div className="mt-3 grid grid-cols-1 gap-3 min-[780px]:grid-cols-2"><label className="grid min-w-0 gap-1 text-base font-black text-[#284535]">Quantidade produzida <span className="text-[#b82727]">*</span><input required inputMode="numeric" value={quantityProduced} onChange={(event) => setQuantityProduced(event.target.value.replace(/\D/g, ""))} className="h-14 w-full min-w-0 rounded-lg border-2 border-[#8ab69a] bg-white px-3 text-2xl font-black" /></label><label className="grid min-w-0 gap-1 text-base font-black text-[#284535]">Perda <span className="text-[#b82727]">*</span><input required inputMode="numeric" value={quantityLost} onChange={(event) => setQuantityLost(event.target.value.replace(/\D/g, ""))} className="h-14 w-full min-w-0 rounded-lg border-2 border-[#8ab69a] bg-white px-3 text-2xl font-black" /></label><label className="grid min-w-0 gap-1 text-sm font-black text-[#284535] min-[780px]:col-span-2">Observação<textarea value={observation} onChange={(event) => setObservation(event.target.value)} className="min-h-16 w-full min-w-0 rounded-lg border-2 border-[#8ab69a] bg-white px-3 py-2 text-sm" /></label></div>
            {invalidQuantity ? <p className="mt-2 rounded-lg border-2 border-[#d68b8b] bg-[#fff1f1] p-2 text-sm font-bold leading-snug text-[#b82727]">Informe quantidade produzida e perda. A produção deve ser maior que zero e a perda não pode superar a quantidade.</p> : null}
            {belowReservation ? <p className="mt-2 rounded-lg border-2 border-[#e3b272] bg-[#fff7e7] p-2 text-sm font-bold leading-snug text-[#985808]">A baixa de reserva calculada é menor que o saldo reservado de {reservationBalance}. Selecione <strong>Parcial</strong> ou <strong>A concluir</strong>; não é possível atender a OP abaixo da reserva.</p> : null}
            {aboveReservation ? <p className="mt-2 rounded-lg border-2 border-[#d68b8b] bg-[#fff1f1] p-2 text-sm font-bold leading-snug text-[#a12727]">A baixa de reserva está {reservationQuantity - reservationBalance} acima da reserva ({excessPercent}% excedente). O sistema permitirá a operação, mas confirmará esse excedente antes da gravação.</p> : null}
            <div className="mt-3"><p className="mb-2 text-base font-black text-[#284535]">Resultado da produção</p><div className="grid grid-cols-1 gap-2 min-[780px]:grid-cols-3"><FinishButton label="Atendido" description="Concluir produção" tone="attended" disabled={invalidQuantity || belowReservation || finishProduction.isPending} onClick={() => finishWith("attended")} /><FinishButton label="A concluir" description="Manter produção pendente" tone="to_conclude" disabled={invalidQuantity || finishProduction.isPending} onClick={() => finishWith("to_conclude")} /><FinishButton label="Parcial" description="Registrar produção parcial" tone="partial" disabled={invalidQuantity || finishProduction.isPending} onClick={() => finishWith("partial")} /></div></div>
            <div className="sticky bottom-0 z-10 -mx-3 mt-3 border-t border-[#c8dfcf] bg-[#f5fbf6] px-3 pt-3"><Button variant="outline" onClick={() => setShowFinish(false)} className="h-12 w-full border-2 border-[#98b8a3] px-6 text-base font-black min-[560px]:ml-auto min-[560px]:w-auto">Voltar</Button></div>
          </DialogContent>
        </Dialog>
        {pendingTraceConformance ? <OperationalConfirmDialog open tone="question" title="Conformidade da produção" description="O processo foi concluído sem não conformidade?" cancelLabel="Não, abrir RPNC" confirmLabel="Sim, seguir para rastreio" onCancel={() => decideTraceConformance(false)} onConfirm={() => decideTraceConformance(true)} /> : null}
        {confirmation ? <OperationalConfirmDialog open tone={confirmation.tone} title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel} pending={startSetup.isPending || finishSetup.isPending || completeInspection.isPending || startPause.isPending || finishPause.isPending || finishProduction.isPending || validateLot.isPending} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.action; setConfirmation(null); action(); }} /> : null}
        {lotValidatedMessage ? <OperationalMessageDialog open title="Lote validado" description={lotValidatedMessage} onClose={() => setLotValidatedMessage(null)} /> : null}
        {lotInvalidMessage ? <OperationalMessageDialog open tone="caution" title="Lote não validado" description={lotInvalidMessage} onClose={() => setLotInvalidMessage(null)} /> : null}
      </> : pointing.isLoading ? <div className="h-[500px] animate-pulse rounded-2xl bg-[#edf0eb]" /> : null}
    </div>
  );
}

function PalletizationImage({ title, description, imageDataUri, imageError }: { title: string; description?: string | null; imageDataUri: string | null; imageError: string | null }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#b8d1b2] bg-white p-3 min-[1000px]:p-4"><div className="mb-3 text-center"><h3 className="text-xl font-black text-[#315d2e]">{title}</h3>{description ? <p className="mt-1 text-sm font-bold text-[#62765d]">{description}</p> : null}</div><div className="flex min-h-[260px] w-full items-center justify-center overflow-auto rounded-xl bg-[#eef3ec] p-3 min-[1000px]:min-h-[340px]">{imageDataUri ? <img src={imageDataUri} alt={title} className="max-h-[38dvh] max-w-full object-contain min-[1000px]:max-h-[46dvh]" /> : <p className="max-w-md rounded-xl border border-dashed border-[#a9bda4] bg-[#f7fbf5] p-5 text-center text-base font-bold text-[#62765d]">{imageError || `Nenhuma imagem foi cadastrada para ${title.toLowerCase()}.`}</p>}</div></section>;
}

function LegacyField({ label, value, grow = false }: { label: string; value: string | number | null | undefined; grow?: boolean }) { return <span className={grow ? "min-w-[220px] flex-1" : undefined}>{label} <strong className="ml-1 text-xl font-black text-[#c83333]">{displayValue(value)}</strong></span>; }
function LegacyCheckbox({ label, checked }: { label: string; checked: boolean }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-[#177458]" /><span>{label}</span></label>; }

function SetupButton({ label, description, shortcut, intent, disabled, onClick }: { label: string; description: string; shortcut: string; intent: SetupOutcome; disabled: boolean; onClick: () => void }) {
  const styles: Record<SetupOutcome, string> = { attended: "bg-[#177458] hover:bg-[#0f6248]", to_conclude: "bg-[#bb7515] hover:bg-[#965b09]", cancelled: "bg-[#b82727] hover:bg-[#951a1a]" };
  return <Button disabled={disabled} onClick={onClick} className={`h-16 flex-col gap-0.5 text-lg font-black ${styles[intent]}`}><span>{label} <ShortcutKey label={shortcut} /></span><span className="text-[11px] font-bold opacity-85">{description}</span></Button>;
}

function FinishButton({ label, description, tone, disabled, onClick }: { label: string; description: string; tone: ProductionOutcome; disabled: boolean; onClick: () => void }) {
  const styles: Record<ProductionOutcome, string> = { attended: "bg-[#177458] hover:bg-[#0f6248]", to_conclude: "bg-[#bb7515] hover:bg-[#965b09]", partial: "bg-[#b82727] hover:bg-[#951a1a]" };
  return <Button disabled={disabled} onClick={onClick} className={`min-h-16 h-auto w-full flex-col gap-0.5 px-3 py-2 text-base font-black ${styles[tone]}`}><span>{label}</span><span className="text-center text-[11px] font-bold leading-tight opacity-85">{description}</span></Button>;
}

function Info({ label, value, prominent = false }: { label: string; value: string | number | null | undefined; prominent?: boolean }) { return <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-[#76877a]">{label}</p><p className={`mt-0.5 font-black leading-tight text-[#294336] ${prominent ? "text-xl" : "text-base"}`}>{displayValue(value)}</p></div>; }
function Measure({ label, value, accent }: { label: string; value: string | number | null | undefined; accent: "blue" | "red" }) { return <div><p className={`text-lg font-black ${accent === "blue" ? "text-[#145fc7]" : "text-[#cc1f2a]"}`}>{label}</p><div className={`mt-1 flex min-h-24 items-center justify-end rounded-lg border-[3px] bg-white px-4 font-mono text-5xl font-black tracking-[.06em] text-[#121613] sm:text-6xl ${accent === "blue" ? "border-[#145fc7]" : "border-[#cc1f2a]"}`}>{displayValue(value)}</div></div>; }
function MeasureWithComplement({ label, value, complement, accent }: { label: string; value: string | number | null | undefined; complement: string | number | null | undefined; accent: "blue" | "red" }) { const border = accent === "blue" ? "border-[#145fc7]" : "border-[#cc1f2a]"; const text = accent === "blue" ? "text-[#145fc7]" : "text-[#cc1f2a]"; return <div><p className={`text-lg font-black ${text}`}>{label}</p><div className="mt-1 grid grid-cols-[minmax(0,1fr)_180px] gap-3 sm:grid-cols-[minmax(0,1fr)_210px]"><div className={`flex min-h-24 items-center justify-end rounded-lg border-[3px] bg-white px-4 font-mono text-5xl font-black tracking-[.06em] text-[#121613] sm:text-6xl ${border}`}>{displayValue(value)}</div><div className={`flex min-h-24 items-center justify-end rounded-lg border-[3px] bg-white px-4 font-mono text-5xl font-black tracking-[.06em] text-[#121613] sm:text-6xl ${border}`}>{displayValue(complement)}</div></div></div>; }
function Timer({ label, value }: { label: string; value: string }) { return <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[#68796e]"><Clock3 className="h-4 w-4" />{label}</p><p className="mt-0.5 font-mono text-3xl font-black tracking-[-.05em] text-[#253d32]">{value}</p></div>; }
function ShortcutKey({ label }: { label: string }) { return <span className="ml-2 rounded border border-current/35 bg-white/55 px-1.5 py-0.5 font-mono text-[11px] font-black leading-none">{label}</span>; }
