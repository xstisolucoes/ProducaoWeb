import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { CheckCircle2, ClipboardCheck, Eye, Package, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalConfirmDialog, OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { ProductPalletizationDialog, ProductPrintLayoutDialog } from "@/components/ProductVisualDialogs";
import { ProductReleaseRpncDialog } from "@/components/ProductReleaseRpncDialog";
import { SpecialProductionPanel } from "@/components/SpecialProductionPanel";

type Outcome = "attended" | "partial";
type Conformity = "Conforme" | "Não Conforme";
type Stage = "1º Amostragem" | "Amostragem Geral";

function numberValue(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isInteger(parsed) ? parsed : 0;
}

function isReleaseGroup(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR").includes("LIBERACAO DE PRODUTO");
}

export default function ProductReleasePointing() {
  const [, params] = useRoute("/liberacao-produto/:opCodigo/:mpCodigo");
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const opCodigo = Number(params?.opCodigo);
  const mpCodigo = Number(params?.mpCodigo);
  const [conformity, setConformity] = useState<Conformity | null>(null);
  const [stage, setStage] = useState<Stage>("1º Amostragem");
  const [lotSize, setLotSize] = useState("");
  const [quantityLost, setQuantityLost] = useState("0");
  const [quantityReworked, setQuantityReworked] = useState("0");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showRpnc, setShowRpnc] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [returnedFromRpnc, setReturnedFromRpnc] = useState(false);
  const releaseStartKeyRef = useRef<string | null>(null);
  const isManualUser = ["manual-pointing", "manual-production", "quality-release"].includes(user?.operationalProfile ?? "");
  const pointing = trpc.production.pointing.get.useQuery({ opCodigo, mpCodigo }, { enabled: isManualUser && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const specialProduction = trpc.production.pointing.specialProduction.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data), retry: false });
  const plan = trpc.production.pointing.productReleasePlan.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data && isReleaseGroup(pointing.data.machineGroup)), retry: false });
  const approved = trpc.production.pointing.approvedQuantities.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data), retry: false });
  const palletization = trpc.production.pointing.palletization.useQuery({ opCodigo, mpCodigo }, { enabled: showPalletization, retry: false });
  const printLayout = trpc.production.pointing.printLayout.useQuery({ opCodigo, mpCodigo }, { enabled: showLayout, retry: false });
  const startManual = trpc.production.pointing.startManual.useMutation({ onSuccess: () => pointing.refetch(), onError: error => { releaseStartKeyRef.current = null; setMessage(error.message); } });
  const finish = trpc.production.pointing.finishProductRelease.useMutation({
    onSuccess: result => {
      const synchronized = result.specialProduction?.updated?.length ?? 0;
      toast.success(result.status === "Liberado" ? "Produto encaminhado para Amostragem Geral." : "Liberação de Produto finalizada.", synchronized ? { description: `${synchronized} OP(s) componente(s) da Produção Especial foram atualizadas.` } : undefined);
      setLocation("/");
    },
    onError: error => setMessage(error.message),
  });

  useEffect(() => {
    const startKey = `${opCodigo}:${mpCodigo}:${user?.machine?.code ?? ""}`;
    if (!user || !isManualUser || !pointing.data || returnedFromRpnc || pointing.data.status === "Em Produção" || startManual.isPending || releaseStartKeyRef.current === startKey) return;
    releaseStartKeyRef.current = startKey;
    startManual.mutate({ opCodigo, mpCodigo });
  }, [isManualUser, mpCodigo, opCodigo, pointing.data, returnedFromRpnc, startManual, user]);

  useEffect(() => {
    if (plan.data && !lotSize) setLotSize(String(plan.data.lotSize));
  }, [lotSize, plan.data]);

  useEffect(() => {
    if (plan.data?.stage === "Amostragem Geral") setStage("Amostragem Geral");
  }, [plan.data?.stage]);

  useEffect(() => {
    if (user && !isManualUser) setLocation("/");
  }, [isManualUser, setLocation, user]);

  useEffect(() => {
    if (pointing.data && !isReleaseGroup(pointing.data.machineGroup)) setLocation(`/apontamento-manual/${opCodigo}/${mpCodigo}`);
  }, [mpCodigo, opCodigo, pointing.data, setLocation]);

  function chooseConformity(value: Conformity) {
    setConformity(value);
    if (value === "Não Conforme") setShowRpnc(true);
  }


  function requestFinish(nextOutcome: Outcome) {
    if (!generalSampling && !conformity) return setMessage("Informe se a amostragem está Conforme ou Não Conforme.");
    if (numberValue(lotSize) < 1) return setMessage("Informe o tamanho do lote para a liberação.");
    if (numberValue(quantityLost) > numberValue(lotSize)) return setMessage("A quantidade perdida não pode ser maior que o tamanho do lote.");
    setOutcome(nextOutcome);
  }

  function confirmFinish() {
    const releaseConformity: Conformity | null = generalSampling ? "Não Conforme" : conformity;
    if (!outcome || !releaseConformity) return;
    finish.mutate({ opCodigo, mpCodigo, outcome, conformity: releaseConformity, stage, lotSize: numberValue(lotSize), quantityLost: numberValue(quantityLost), quantityReworked: numberValue(quantityReworked) });
    setOutcome(null);
  }

  if (!user || !isManualUser) return null;
  if (pointing.isLoading || !pointing.data) return <div className="theme-pointing min-h-dvh bg-[#eef4ef] p-5"><div className="h-[520px] animate-pulse rounded-2xl bg-white" /></div>;
  const item = pointing.data;
  if (!isReleaseGroup(item.machineGroup)) return null;
  const generalSampling = stage === "Amostragem Geral";
  const releaseBalance = Math.max(0, numberValue(lotSize) || Number(item.saldo ?? plan.data?.lotSize ?? 0));

  return (
    <div className="theme-pointing min-h-dvh bg-[#eef4ef] p-3 lg:p-4">
      <header className="product-release-header rounded-2xl border px-5 py-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-white/75">Processo manual · controle de qualidade</p>
            <h1 className="mt-1 text-3xl font-black">Liberação de Produto</h1>
            <p className="mt-1 text-base font-semibold text-white/85">Nível de Inspeção Geral II · N.Q.A. 1,5 · {item.machineDescription}</p>
          </div>
          <div className="product-release-balance rounded-xl px-5 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-wider">Saldo a liberar</p>
            <p className="mt-1 font-mono text-4xl font-black">{releaseBalance}</p>
          </div>
        </div>
      </header>

      <div className="mt-3"><SpecialProductionPanel data={specialProduction.data} loading={specialProduction.isLoading} error={specialProduction.error} /></div>

      <main className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="space-y-3">
          <section className="theme-surface rounded-2xl border p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_90px_1.3fr]"><Meta label="Ordem de produção" value={String(item.op_codigo)} /><Meta label="Produto" value={String(item.productCode ?? "—")} /><Meta label="Revisão" value={String(item.revision ?? "—")} /><Meta label="CPC" value={item.customerProductCode || "—"} /></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2"><Meta label="Cliente" value={item.client || item.clientLegalName || "—"} /><Meta label="Referência" value={item.produto_referencia || item.referencia || "—"} /></div>
          </section>

          <section className="theme-surface rounded-2xl border p-4 shadow-sm">
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowPalletization(true)} className="theme-btn-soft h-14 px-5 text-base font-black"><Package className="mr-2 h-5 w-5" />Pacotes / Paletes</Button><Button variant="outline" onClick={() => setShowLayout(true)} className="theme-btn-soft h-14 px-5 text-base font-black"><Eye className="mr-2 h-5 w-5" />Visualizar impressão</Button><Button variant="outline" onClick={() => setLocation("/")} className="theme-btn-soft h-14 px-5 text-base font-black">Voltar</Button></div>
          </section>

          <section className="theme-surface rounded-2xl border p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border-2 border-[#cabfd0] p-5"><div className="flex items-center gap-3"><ClipboardCheck className="h-8 w-8 text-[#8a1d28]" /><div><h2 className="text-2xl font-black">Nível de Inspeção Geral II</h2><p className="mt-1 text-lg font-bold text-[#b2242f]">N.Q.A. 1,5 · {stage}</p></div></div><div className="mt-5 grid grid-cols-4 gap-3"><Metric label="Tamanho do lote" value={lotSize || "—"} editable onChange={setLotSize} /><Metric label="Tamanho amostra" value={plan.data?.sampleSize ?? "—"} /><Metric label="C" value={plan.data?.acceptableLimit ?? "—"} /><Metric label="NC" value={plan.data?.nonConformingLimit ?? "—"} /></div>{!plan.data?.planCode ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Nenhum plano de amostragem foi localizado para o tamanho de lote informado.</p> : null}</div>
              <div className="flex flex-col justify-center gap-3">{generalSampling ? <div className="rounded-2xl border-2 border-[#d1b25f] bg-[#fff8df] p-5 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-[#9c7115]" /><p className="mt-2 text-xl font-black text-[#735211]">Amostragem Geral</p><p className="mt-1 text-sm font-bold text-[#87671c]">Aponte a amostra geral da Qualidade. A liberação Conforme não se aplica nesta etapa.</p></div> : <><Button onClick={() => chooseConformity("Não Conforme")} className={`h-16 text-xl font-black ${conformity === "Não Conforme" ? "bg-[#c92f38] text-white" : "border border-[#c92f38] bg-white text-[#c92f38] hover:bg-[#fff2f2]"}`}><XCircle className="mr-2 h-6 w-6" />Não Conforme</Button><Button onClick={() => chooseConformity("Conforme")} className={`h-16 text-xl font-black ${conformity === "Conforme" ? "bg-[#177458] text-white" : "border border-[#177458] bg-white text-[#177458] hover:bg-[#edf9f1]"}`}><CheckCircle2 className="mr-2 h-6 w-6" />Conforme</Button></>}</div>
            </div>
            {generalSampling ? <div className="mt-5 grid gap-4 md:grid-cols-3"><Metric label="Saldo a liberar" value={lotSize || releaseBalance} editable onChange={setLotSize} /><Metric label="Quantidade perdida" value={quantityLost} editable onChange={setQuantityLost} /><Metric label="Quantidade retrabalhada" value={quantityReworked} editable onChange={setQuantityReworked} /></div> : null}
          </section>
        </section>

        <aside className="theme-surface min-h-[470px] rounded-2xl border p-4 shadow-sm"><h2 className="text-xl font-black">Quantidades produzidas anteriores</h2><div className="mt-3 overflow-hidden rounded-xl border">{approved.data?.length ? approved.data.map((row, index) => <div key={`${row.processGroup}-${index}`} className="grid grid-cols-[1fr_92px] border-b px-3 py-3 text-sm font-bold"><span>{row.processGroup ?? "Processo"} · {row.status || "—"}</span><span className="text-right font-mono">{row.approvedQuantity ?? 0}</span></div>) : <p className="p-5 text-sm font-bold">Sem quantidades apontadas anteriormente.</p>}</div></aside>
      </main>

      <footer className="mt-3 grid gap-3 sm:grid-cols-2"><Button disabled={(!generalSampling && !conformity) || finish.isPending} onClick={() => requestFinish("attended")} className="theme-btn-primary h-24 text-2xl font-black text-white">Atendido <span className="ml-2 text-base opacity-80">(F7)</span></Button><Button disabled={(!generalSampling && !conformity) || finish.isPending} onClick={() => requestFinish("partial")} className="manual-partial-action h-24 text-2xl font-black">Parcial <span className="ml-2 text-base opacity-80">(F9)</span></Button></footer>
      {outcome && (conformity || generalSampling) ? <OperationalConfirmDialog open tone="question" title={outcome === "attended" ? "Atender liberação" : "Gerar liberação parcial"} description={`Confirma ${outcome === "attended" ? "o atendimento" : "a parcial"} da ${stage}, lote ${lotSize} e ${quantityLost || "0"} perdas?`} confirmLabel={outcome === "attended" ? "Atender" : "Confirmar parcial"} pending={finish.isPending} onCancel={() => setOutcome(null)} onConfirm={confirmFinish} /> : null}
      <ProductReleaseRpncDialog open={showRpnc} onOpenChange={setShowRpnc} opCodigo={opCodigo} mpCodigo={mpCodigo} transitionToGeneralSampling onRegistered={(code, year) => { setReturnedFromRpnc(true); setConformity(null); setStage("Amostragem Geral"); toast.success(`RPNC ${code}/${year} registrada. Processo encaminhado para Amostragem Geral.`); setLocation("/"); }} />
      <ProductPalletizationDialog open={showPalletization} onOpenChange={setShowPalletization} data={palletization.data} loading={palletization.isLoading} error={palletization.error} productLabel={item.referencia ?? undefined} />
      <ProductPrintLayoutDialog open={showLayout} onOpenChange={setShowLayout} data={printLayout.data} loading={printLayout.isLoading} error={printLayout.error} productLabel={String(item.productCode ?? "")} revision={item.revision} />
      {message ? <OperationalMessageDialog open tone="caution" title="Liberação de Produto" description={message} onClose={() => setMessage(null)} /> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><span className="manual-pointing-label block text-xs font-black uppercase tracking-[.12em]">{label}</span><p className="manual-pointing-card mt-1 min-h-11 rounded-lg border px-3 py-2 text-lg font-black">{value}</p></div>;
}

function Metric({ label, value, editable = false, onChange }: { label: string; value: string | number; editable?: boolean; onChange?: (value: string) => void }) {
  return <label className="product-release-metric manual-pointing-card rounded-xl border p-3 text-center"><span className="manual-pointing-label block min-h-10 text-sm font-black uppercase">{label}</span>{editable ? <Input value={String(value)} onChange={event => onChange?.(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-2 h-20 text-center font-mono !text-5xl font-black leading-none" /> : <p className="mt-2 h-20 rounded-lg border bg-white px-2 py-4 font-mono text-5xl font-black leading-none">{value}</p>}</label>;
}
