import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CheckCircle2, ClipboardList, Eye, Package } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalConfirmDialog, OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { ProductPalletizationDialog, ProductPrintLayoutDialog } from "@/components/ProductVisualDialogs";
import { ProductReleaseRpncDialog } from "@/components/ProductReleaseRpncDialog";
import { ProductFinishedLabelDialog } from "@/components/ProductFinishedLabelDialog";
import { SpecialProductionPanel } from "@/components/SpecialProductionPanel";

type FinishKind = "attended" | "partial";

function readNumber(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isInteger(parsed) ? parsed : NaN;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toDateInput(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString().slice(0, 10) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isPointingGroup(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("pt-BR") === "APONTAMENTO";
}

function isProductReleaseGroup(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR").includes("LIBERACAO DE PRODUTO");
}

export default function ManualPointing() {
  const [, params] = useRoute("/apontamento-manual/:opCodigo/:mpCodigo");
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const opCodigo = Number(params?.opCodigo);
  const mpCodigo = Number(params?.mpCodigo);
  const [quantityProduced, setQuantityProduced] = useState("");
  const [quantityLost, setQuantityLost] = useState("");
  const [quantityPeople, setQuantityPeople] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [finishKind, setFinishKind] = useState<FinishKind | null>(null);
  const [dateConfirmationKind, setDateConfirmationKind] = useState<FinishKind | null>(null);
  const [quantityDeviation, setQuantityDeviation] = useState<{ kind: FinishKind; percent: number; balance: number; processName: string | null } | null>(null);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showRpnc, setShowRpnc] = useState(false);
  const [showProductFinishedLabel, setShowProductFinishedLabel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const manualStartKeyRef = useRef<string | null>(null);
  const isManualUser = ["manual-pointing", "manual-production", "quality-release"].includes(user?.operationalProfile ?? "");
  const requiresPeople = user?.operationalProfile === "manual-production";
  const pointing = trpc.production.pointing.get.useQuery({ opCodigo, mpCodigo }, { enabled: isManualUser && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const specialProduction = trpc.production.pointing.specialProduction.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data), retry: false });
  const isPointingMachineGroup = String(pointing.data?.machineGroup ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR") === "APONTAMENTO";
  const approved = trpc.production.pointing.approvedQuantities.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data), retry: false });
  const palletization = trpc.production.pointing.palletization.useQuery({ opCodigo, mpCodigo }, { enabled: showPalletization, retry: false });
  const printLayout = trpc.production.pointing.printLayout.useQuery({ opCodigo, mpCodigo }, { enabled: showLayout, retry: false });
  const productFinishedLabel = trpc.production.pointing.productFinishedLabel.useQuery({ opCodigo, mpCodigo }, { enabled: showProductFinishedLabel, retry: false });
  const localPrinters = trpc.production.printers.list.useQuery(undefined, { enabled: showProductFinishedLabel, retry: false });
  const startManual = trpc.production.pointing.startManual.useMutation({
    onSuccess: () => pointing.refetch(),
    onError: (error) => { manualStartKeyRef.current = null; setMessage(error.message); },
  });
  const finish = trpc.production.pointing.finishProduction.useMutation({
    onSuccess: (result) => {
      const synchronized = result.specialProduction?.updated?.length ?? 0;
      toast.success(result.status === "Atendido" ? "Processo atendido com sucesso." : "Processo registrado como parcial.", synchronized ? { description: `${synchronized} OP(s) componente(s) da Produção Especial foram atualizadas.` } : undefined);
      if (isPointingMachineGroup) setShowProductFinishedLabel(true);
      else setLocation("/");
    },
    onError: (error) => setMessage(error.message),
  });

  useEffect(() => {
    const startKey = `${opCodigo}:${mpCodigo}:${user?.machine?.code ?? ""}`;
    if (!user || !isManualUser || !pointing.data || pointing.data.status === "Em Produção" || startManual.isPending || manualStartKeyRef.current === startKey) return;
    manualStartKeyRef.current = startKey;
    startManual.mutate({ opCodigo, mpCodigo });
  }, [isManualUser, mpCodigo, opCodigo, pointing.data, startManual, user]);

  useEffect(() => {
    if (!isPointingGroup(pointing.data?.machineGroup) || productionDate) return;
    setProductionDate(toDateInput(pointing.data?.productionDate));
  }, [pointing.data?.machineGroup, pointing.data?.productionDate, productionDate]);

  useEffect(() => {
    if (user && !isManualUser) setLocation("/");
  }, [isManualUser, setLocation, user]);

  useEffect(() => {
    if (isProductReleaseGroup(pointing.data?.machineGroup)) setLocation(`/liberacao-produto/${opCodigo}/${mpCodigo}`);
  }, [mpCodigo, opCodigo, pointing.data?.machineGroup, setLocation]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || finishKind || dateConfirmationKind || showRpnc) return;
      if (event.key === "F7") { event.preventDefault(); requestFinish("attended"); }
      if (event.key === "F9") { event.preventDefault(); requestFinish("partial"); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [dateConfirmationKind, finishKind, quantityLost, quantityPeople, quantityProduced, showRpnc]);

  function requestFinish(kind: FinishKind) {
    const produced = readNumber(quantityProduced); const lost = readNumber(quantityLost);
    if (!Number.isInteger(produced) || produced < 1) return setMessage("Digite uma quantidade produzida válida.");
    if (!Number.isInteger(lost) || lost < 0 || lost > produced) return setMessage("Digite uma quantidade perdida válida, menor ou igual à produzida.");
    if (requiresPeople && (!Number.isInteger(readNumber(quantityPeople)) || readNumber(quantityPeople) < 1)) return setMessage("Informe a quantidade de pessoas que trabalharam no processo manual.");
    if (isPointingGroup(pointing.data?.machineGroup) && !/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) return setMessage("Selecione uma data de produção válida para o Apontamento.");
    const previousBalance = Number(pointing.data?.previousProcessBalance);
    if (Number.isFinite(previousBalance) && previousBalance > 0) {
      const percent = ((produced / previousBalance) * 100) - 100;
      if (Math.abs(percent) > 10) {
        setQuantityDeviation({ kind, percent, balance: previousBalance, processName: pointing.data?.previousProcessName ?? null });
        return;
      }
    }
    continueFinish(kind);
  }

  function continueFinish(kind: FinishKind) {
    if (isPointingGroup(pointing.data?.machineGroup)) { setDateConfirmationKind(kind); return; }
    setFinishKind(kind);
  }

  function confirmFinish() {
    const produced = readNumber(quantityProduced); const lost = readNumber(quantityLost);
    const kind = finishKind;
    setFinishKind(null);
    if (!kind) return;
    finish.mutate({ opCodigo, mpCodigo, quantityProduced: produced, quantityLost: lost, quantityPeople: requiresPeople ? readNumber(quantityPeople) : 0, productionDate: isPointingGroup(pointing.data?.machineGroup) ? productionDate : "", outcome: kind, observation: "Apontamento manual", lotTrace: "" });
  }

  if (!user || !isManualUser) return null;
  if (pointing.isLoading || !pointing.data) return <div className="theme-pointing min-h-dvh bg-[#f4f7f5] p-5"><div className="h-[520px] animate-pulse rounded-2xl bg-white" /></div>;
  const item = pointing.data;
  const pointingGroup = isPointingGroup(item.machineGroup);
  const activeStart = item.activeProcessStartedAt || item.processStartedAt;
  const hasPreviousProcessBalance = item.previousProcessBalance !== null && item.previousProcessBalance !== undefined;

  return <div className="theme-pointing min-h-dvh bg-[#eef4ef] p-3 lg:p-4">
    <header className="manual-pointing-header theme-machine-band rounded-2xl border px-5 py-4 text-white shadow-lg"><p className="text-xs font-black uppercase tracking-[.18em] text-white/75">{requiresPeople ? "Operador Manual · pessoas obrigatórias" : "Grupo Apontamento · acabamento manual"}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Apontamento Manual</h1><p className="mt-1 text-base font-semibold text-white/85">{item.machineDescription}</p></div>{pointingGroup ? <div className="manual-production-date rounded-xl px-4 py-2 text-right"><p className="text-xs font-bold uppercase tracking-wider">Data de produção</p><p className="text-2xl font-black">{productionDate ? productionDate.split("-").reverse().join("/") : "—"}</p></div> : null}</div></header>
    <div className="mt-3"><SpecialProductionPanel data={specialProduction.data} loading={specialProduction.isLoading} error={specialProduction.error} /></div>
    <main className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="space-y-3">
        <section className="theme-surface rounded-2xl border p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[1fr_1fr_90px_1.3fr]"><Meta label="Ordem de produção" value={String(item.op_codigo)} /><Meta label="Produto" value={String(item.productCode ?? "—")} /><Meta label="Revisão" value={String(item.revision ?? "—")} /><Meta label="CPC" value={item.customerProductCode || "—"} /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Meta label="Cliente" value={item.client || item.clientLegalName || "—"} /><Meta label="Referência" value={item.produto_referencia || item.referencia || "—"} /></div></section>
        <section className="theme-surface rounded-2xl border p-4 shadow-sm"><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowPalletization(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><Package className="mr-2 h-5 w-5" />Pacotes / Paletes</Button><Button variant="outline" onClick={() => setShowLayout(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><Eye className="mr-2 h-5 w-5" />Visualizar impressão</Button><Button variant="outline" onClick={() => setShowRpnc(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><ClipboardList className="mr-2 h-5 w-5" />Abrir RPNC</Button><Button variant="outline" onClick={() => setLocation("/")} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button></div><div className={`mt-4 grid gap-3 ${pointingGroup || hasPreviousProcessBalance ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}><TimeCard label="Início" value={formatTime(activeStart)} /><TimeCard label="Final" value={formatTime(new Date().toISOString())} />{hasPreviousProcessBalance ? <PreviousBalanceCard processName={item.previousProcessName} balance={item.previousProcessBalance!} /> : null}{pointingGroup ? <label className="manual-production-date rounded-xl px-5 py-3"><span className="text-sm font-black uppercase tracking-wider">Data de produção</span><Input type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} className="mt-2 h-14 text-xl font-black" /></label> : null}</div></section>
        <section className="theme-surface rounded-2xl border p-5 shadow-sm"><div className={`grid gap-5 ${requiresPeople ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}><Field large autoFocus label="Quantidade produzida" value={quantityProduced} onChange={setQuantityProduced} help={hasPreviousProcessBalance ? `Quantidade a apontar: ${item.previousProcessBalance} · Saldo do processo ${item.previousProcessName || "anterior"}.` : "Informe a produção bruta antes da perda."} /><Field large label="Quantidade perdida" value={quantityLost} onChange={setQuantityLost} />{requiresPeople ? <Field large label="Quantidade de pessoas" value={quantityPeople} onChange={setQuantityPeople} /> : null}</div></section>
      </section>
      <aside className="theme-surface min-h-[370px] rounded-2xl border p-4 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black text-[#234433}"><ClipboardList className="h-5 w-5 text-[#2a7351]" />Quantidades produzidas anteriores</h2><div className="mt-3 overflow-hidden rounded-xl border border-[#d7e3d9]"><div className="grid grid-cols-[1fr_92px] bg-[#f0f6f1] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#42604d]"><span>Processo</span><span className="text-right">Qtde.</span></div>{approved.data?.length ? approved.data.map((row, index) => <div key={`${row.processGroup}-${index}`} className="grid grid-cols-[1fr_92px] border-t border-[#e3ece5] px-3 py-3 text-sm font-bold text-[#354b3b]"><span>{row.processGroup ?? "Processo"} · {row.status || "—"}</span><span className="text-right font-mono">{row.approvedQuantity ?? 0}</span></div>) : <p className="p-5 text-sm font-bold text-[#748477]">Sem quantidades apontadas anteriormente.</p>}</div></aside>
    </main>
    <footer className="mt-3 grid gap-3 sm:grid-cols-2"><Button disabled={finish.isPending || startManual.isPending} onClick={() => requestFinish("attended")} className="theme-btn-primary h-24 text-2xl font-black text-white"><CheckCircle2 className="mr-3 h-9 w-9" />Atendido <span className="ml-2 text-base opacity-80">(F7)</span></Button><Button disabled={finish.isPending || startManual.isPending} onClick={() => requestFinish("partial")} className="manual-partial-action h-24 text-2xl font-black"><CheckCircle2 className="mr-3 h-9 w-9" />Parcial <span className="ml-2 text-base opacity-80">(F9)</span></Button></footer>
    {quantityDeviation ? <OperationalConfirmDialog open tone="caution" title="Quantidade diferente do processo anterior" description={`A quantidade apontada está ${Math.abs(quantityDeviation.percent).toFixed(2)}% ${quantityDeviation.percent > 0 ? "maior" : "menor"} que o saldo de ${quantityDeviation.balance} do processo ${quantityDeviation.processName || "anterior"}. Deseja continuar mesmo assim?`} confirmLabel="Sim, continuar" onCancel={() => setQuantityDeviation(null)} onConfirm={() => { const kind = quantityDeviation.kind; setQuantityDeviation(null); continueFinish(kind); }} /> : null}
    {dateConfirmationKind ? <OperationalConfirmDialog open tone="question" title="Confirmar data de produção" description={`A data de produção ${productionDate.split("-").reverse().join("/")} está correta para esta OP? Ela será usada na validade e na entrada de estoque.`} confirmLabel="Sim, continuar" onCancel={() => setDateConfirmationKind(null)} onConfirm={() => { setFinishKind(dateConfirmationKind); setDateConfirmationKind(null); }} /> : null}
    {finishKind ? <OperationalConfirmDialog open tone="question" title={finishKind === "attended" ? "Atender processo" : "Gerar parcial"} description={`Confirma ${finishKind === "attended" ? "o atendimento" : "a finalização parcial"} com ${quantityProduced || "0"} produzidas e ${quantityLost || "0"} perdidas${requiresPeople ? `, com ${quantityPeople || "0"} pessoa(s)` : ""}${pointingGroup ? `, na data ${productionDate.split("-").reverse().join("/")}` : ""}?`} confirmLabel={finishKind === "attended" ? "Atender" : "Confirmar parcial"} pending={finish.isPending} onCancel={() => setFinishKind(null)} onConfirm={confirmFinish} /> : null}
    <ProductReleaseRpncDialog open={showRpnc} onOpenChange={setShowRpnc} opCodigo={opCodigo} mpCodigo={mpCodigo} onRegistered={(code, year) => toast.success(`RPNC ${code}/${year} registrada.`)} />
    <ProductPalletizationDialog open={showPalletization} onOpenChange={setShowPalletization} data={palletization.data} loading={palletization.isLoading} error={palletization.error} productLabel={item.referencia ?? undefined} />
    <ProductFinishedLabelDialog open={showProductFinishedLabel} onOpenChange={(next) => { setShowProductFinishedLabel(next); if (!next) setLocation("/"); }} data={productFinishedLabel.data} loading={productFinishedLabel.isLoading || localPrinters.isLoading} error={productFinishedLabel.error || localPrinters.error} printers={localPrinters.data?.printers ?? []} printerSource={localPrinters.data?.source} opCodigo={opCodigo} mpCodigo={mpCodigo} />
    <ProductPrintLayoutDialog open={showLayout} onOpenChange={setShowLayout} data={printLayout.data} loading={printLayout.isLoading} error={printLayout.error} productLabel={String(item.productCode ?? "")} revision={item.revision} />
    {message ? <OperationalMessageDialog open tone="caution" title="Apontamento Manual" description={message} onClose={() => setMessage(null)} /> : null}
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><span className="manual-pointing-label block text-xs font-black uppercase tracking-[.12em]">{label}</span><p className="manual-pointing-card mt-1 min-h-11 rounded-lg border px-3 py-2 text-lg font-black">{value}</p></div>; }
function TimeCard({ label, value }: { label: string; value: string }) { return <div className="manual-pointing-card rounded-xl border-2 px-5 py-4"><span className="manual-pointing-label text-sm font-black uppercase tracking-wider">{label}</span><p className="manual-pointing-value mt-1 font-mono text-4xl font-black">{value}</p></div>; }
function PreviousBalanceCard({ processName, balance }: { processName: string | null; balance: number }) { return <div className="manual-production-date rounded-xl px-5 py-4"><span className="text-sm font-black uppercase tracking-wider">Quantidade a apontar</span><p className="mt-1 font-mono text-4xl font-black">{balance}</p><p className="mt-1 text-sm font-bold">Saldo — {processName || "Processo anterior"}</p></div>; }
function Field({ label, value, onChange, large = false, autoFocus = false, help }: { label: string; value: string; onChange: (value: string) => void; large?: boolean; autoFocus?: boolean; help?: string }) { return <label className="manual-pointing-card block rounded-xl border p-3"><span className="manual-pointing-label flex items-center gap-2 text-2xl font-black">{label}</span><Input autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`manual-quantity-input mt-3 text-center font-mono font-black ${large ? "h-32 text-7xl" : "h-20 text-4xl"}`} placeholder="0" />{help ? <p className="manual-pointing-help mt-2 text-sm font-semibold">{help}</p> : null}</label>; }
