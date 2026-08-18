import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CheckCircle2, ClipboardList, Eye, Package } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OperationalConfirmDialog, OperationalMessageDialog } from "@/components/OperationalConfirmDialog";
import { ProductPalletizationDialog, ProductPrintLayoutDialog } from "@/components/ProductVisualDialogs";

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

export default function ManualPointing() {
  const [, params] = useRoute("/apontamento-manual/:opCodigo/:mpCodigo");
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const opCodigo = Number(params?.opCodigo);
  const mpCodigo = Number(params?.mpCodigo);
  const [quantityProduced, setQuantityProduced] = useState("");
  const [quantityLost, setQuantityLost] = useState("");
  const [finishKind, setFinishKind] = useState<FinishKind | null>(null);
  const [showPalletization, setShowPalletization] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showRpnc, setShowRpnc] = useState(false);
  const [rpncQuantities, setRpncQuantities] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const isManualUser = user?.operationalProfile === "manual-pointing";
  const pointing = trpc.production.pointing.get.useQuery({ opCodigo, mpCodigo }, { enabled: isManualUser && Number.isInteger(opCodigo) && Number.isInteger(mpCodigo), retry: false });
  const approved = trpc.production.pointing.approvedQuantities.useQuery({ opCodigo, mpCodigo }, { enabled: Boolean(pointing.data), retry: false });
  const palletization = trpc.production.pointing.palletization.useQuery({ opCodigo, mpCodigo }, { enabled: showPalletization, retry: false });
  const printLayout = trpc.production.pointing.printLayout.useQuery({ opCodigo, mpCodigo }, { enabled: showLayout, retry: false });
  const rpncChecklist = trpc.production.pointing.rpncChecklist.useQuery({ opCodigo, mpCodigo, origin: "product" }, { enabled: showRpnc, retry: false });
  const startManual = trpc.production.pointing.startManual.useMutation({
    onSuccess: () => pointing.refetch(),
    onError: (error) => setMessage(error.message),
  });
  const finish = trpc.production.pointing.finishProduction.useMutation({
    onSuccess: (result) => {
      toast.success(result.status === "Atendido" ? "Processo atendido com sucesso." : "Processo registrado como parcial.");
      setLocation("/");
    },
    onError: (error) => setMessage(error.message),
  });
  const submitRpnc = trpc.production.pointing.submitRpnc.useMutation({
    onSuccess: (result) => { setShowRpnc(false); setRpncQuantities({}); toast.success(`RPNC ${result.rpncCode}/${result.year} registrada.`); },
    onError: (error) => setMessage(error.message),
  });

  useEffect(() => {
    if (!user || !isManualUser || !pointing.data || pointing.data.status === "Em Produção" || startManual.isPending) return;
    startManual.mutate({ opCodigo, mpCodigo });
  }, [isManualUser, mpCodigo, opCodigo, pointing.data, startManual, user]);

  useEffect(() => {
    if (user && !isManualUser) setLocation("/");
  }, [isManualUser, setLocation, user]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || finishKind || showRpnc) return;
      if (event.key === "F7") { event.preventDefault(); requestFinish("attended"); }
      if (event.key === "F9") { event.preventDefault(); requestFinish("partial"); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [finishKind, quantityLost, quantityProduced, showRpnc]);

  const rpncItems = useMemo(() => (rpncChecklist.data?.checklists ?? []).flatMap((checklist) => checklist.items.map((item) => ({ checklistCode: checklist.code, itemCode: item.code, description: item.description }))), [rpncChecklist.data]);
  const selectedRpncItems = rpncItems.filter((item) => readNumber(rpncQuantities[item.itemCode] ?? "") > 0);

  function requestFinish(kind: FinishKind) {
    const produced = readNumber(quantityProduced); const lost = readNumber(quantityLost);
    if (!Number.isInteger(produced) || produced < 1) return setMessage("Digite uma quantidade produzida válida.");
    if (!Number.isInteger(lost) || lost < 0 || lost > produced) return setMessage("Digite uma quantidade perdida válida, menor ou igual à produzida.");
    setFinishKind(kind);
  }

  function confirmFinish() {
    const produced = readNumber(quantityProduced); const lost = readNumber(quantityLost);
    const kind = finishKind;
    setFinishKind(null);
    if (!kind) return;
    finish.mutate({ opCodigo, mpCodigo, quantityProduced: produced, quantityLost: lost, outcome: kind, observation: "Apontamento manual", lotTrace: "" });
  }

  function confirmRpnc() {
    if (!selectedRpncItems.length) return setMessage("Selecione ao menos uma não conformidade e informe sua quantidade.");
    const grouped = (rpncChecklist.data?.checklists ?? []).map((checklist) => ({
      checklistCode: checklist.code,
      items: selectedRpncItems.filter((item) => item.checklistCode === checklist.code).map((item) => ({ itemCode: item.itemCode, quantity: readNumber(rpncQuantities[item.itemCode]), causeCodes: [], containmentAction: "" })),
    })).filter((checklist) => checklist.items.length);
    submitRpnc.mutate({ opCodigo, mpCodigo, origin: "product", checklists: grouped });
  }

  if (!user || !isManualUser) return null;
  if (pointing.isLoading || !pointing.data) return <div className="theme-pointing min-h-dvh bg-[#f4f7f5] p-5"><div className="h-[520px] animate-pulse rounded-2xl bg-white" /></div>;
  const item = pointing.data;
  const activeStart = item.activeProcessStartedAt || item.processStartedAt;

  return <div className="theme-pointing min-h-dvh bg-[#eef4ef] p-3 lg:p-4">
    <header className="manual-pointing-header theme-machine-band rounded-2xl border px-5 py-4 text-white shadow-lg"><p className="text-xs font-black uppercase tracking-[.18em] text-white/75">Grupo Apontamento · acabamento manual</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Apontamento Manual</h1><p className="mt-1 text-base font-semibold text-white/85">{item.machineDescription}</p></div><div className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-right"><p className="text-xs font-bold uppercase tracking-wider text-white/75">Data de produção</p><p className="text-xl font-black">{new Date().toLocaleDateString("pt-BR")}</p></div></div></header>
    <main className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="space-y-3">
        <section className="theme-surface rounded-2xl border p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[1fr_1fr_90px_1.3fr]"><Meta label="Ordem de produção" value={String(item.op_codigo)} /><Meta label="Produto" value={String(item.productCode ?? "—")} /><Meta label="Revisão" value={String(item.revision ?? "—")} /><Meta label="CPC" value={item.customerProductCode || "—"} /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Meta label="Cliente" value={item.client || item.clientLegalName || "—"} /><Meta label="Referência" value={item.produto_referencia || item.referencia || "—"} /></div></section>
        <section className="theme-surface rounded-2xl border p-4 shadow-sm"><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowPalletization(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><Package className="mr-2 h-5 w-5" />Pacotes / Paletes</Button><Button variant="outline" onClick={() => setShowLayout(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><Eye className="mr-2 h-5 w-5" />Visualizar impressão</Button><Button variant="outline" onClick={() => setShowRpnc(true)} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><ClipboardList className="mr-2 h-5 w-5" />Abrir RPNC</Button><Button variant="outline" onClick={() => setLocation("/")} className="manual-pointing-action theme-btn-soft h-14 px-5 text-base font-black"><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><TimeCard label="Início" value={formatTime(activeStart)} /><TimeCard label="Final" value={formatTime(new Date().toISOString())} /></div></section>
        <section className="theme-surface rounded-2xl border p-5 shadow-sm"><div className="grid gap-5 lg:grid-cols-2"><div><label className="manual-pointing-label block text-2xl font-black">Qtde. produzida</label><Input value={quantityProduced} onChange={(event) => setQuantityProduced(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoFocus className="manual-quantity-input mt-3 h-32 border-2 text-center font-mono text-7xl font-black" placeholder="0" /><p className="manual-pointing-help mt-2 text-sm font-semibold">Informe a produção bruta antes da perda.</p></div><Field large label="Qtde. perdida" value={quantityLost} onChange={setQuantityLost} /></div></section>
      </section>
      <aside className="theme-surface min-h-[370px] rounded-2xl border p-4 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black text-[#234433}"><ClipboardList className="h-5 w-5 text-[#2a7351]" />Quantidades produzidas anteriores</h2><div className="mt-3 overflow-hidden rounded-xl border border-[#d7e3d9]"><div className="grid grid-cols-[1fr_92px] bg-[#f0f6f1] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#42604d]"><span>Processo</span><span className="text-right">Qtde.</span></div>{approved.data?.length ? approved.data.map((row, index) => <div key={`${row.processGroup}-${index}`} className="grid grid-cols-[1fr_92px] border-t border-[#e3ece5] px-3 py-3 text-sm font-bold text-[#354b3b]"><span>{row.processGroup ?? "Processo"} · {row.status || "—"}</span><span className="text-right font-mono">{row.approvedQuantity ?? 0}</span></div>) : <p className="p-5 text-sm font-bold text-[#748477]">Sem quantidades apontadas anteriormente.</p>}</div></aside>
    </main>
    <footer className="mt-3 grid gap-3 sm:grid-cols-2"><Button disabled={finish.isPending || startManual.isPending} onClick={() => requestFinish("attended")} className="theme-btn-primary h-24 text-2xl font-black text-white"><CheckCircle2 className="mr-3 h-9 w-9" />Atendido <span className="ml-2 text-base opacity-80">(F7)</span></Button><Button disabled={finish.isPending || startManual.isPending} onClick={() => requestFinish("partial")} className="manual-partial-action h-24 text-2xl font-black"><CheckCircle2 className="mr-3 h-9 w-9" />Parcial <span className="ml-2 text-base opacity-80">(F9)</span></Button></footer>
    {finishKind ? <OperationalConfirmDialog open tone="question" title={finishKind === "attended" ? "Atender processo" : "Gerar parcial"} description={`Confirma ${finishKind === "attended" ? "o atendimento" : "a finalização parcial"} com ${quantityProduced || "0"} produzidas e ${quantityLost || "0"} perdidas?`} confirmLabel={finishKind === "attended" ? "Atender" : "Confirmar parcial"} pending={finish.isPending} onCancel={() => setFinishKind(null)} onConfirm={confirmFinish} /> : null}
    <Dialog open={showRpnc} onOpenChange={(open) => { if (!open && !submitRpnc.isPending) setShowRpnc(false); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Abrir RPNC</DialogTitle><DialogDescription>Marque as não conformidades encontradas e informe suas quantidades.</DialogDescription></DialogHeader>{rpncChecklist.isLoading ? <p className="p-5 font-bold">Carregando checklist…</p> : <div className="max-h-[52vh] space-y-3 overflow-auto">{rpncItems.map((item) => <div key={`${item.checklistCode}-${item.itemCode}`} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-xl border p-3"><label className="text-sm font-bold text-[#33483a]">{item.description}</label><Input inputMode="numeric" value={rpncQuantities[item.itemCode] ?? ""} onChange={(event) => setRpncQuantities((current) => ({ ...current, [item.itemCode]: event.target.value.replace(/\D/g, "") }))} placeholder="Qtde" /></div>)}{!rpncItems.length ? <p className="rounded-xl bg-[#fff8e9] p-4 font-bold text-[#765811]">Não há itens de RPNC cadastrados para este processo.</p> : null}</div>}<DialogFooter><Button onClick={() => setShowRpnc(false)} className="bg-[#c93232] text-white hover:bg-[#a91f1f]">Cancelar</Button><Button disabled={submitRpnc.isPending || !selectedRpncItems.length} onClick={confirmRpnc} className="bg-[#177458] text-white hover:bg-[#105f49]">Registrar RPNC</Button></DialogFooter></DialogContent></Dialog>
    <ProductPalletizationDialog open={showPalletization} onOpenChange={setShowPalletization} data={palletization.data} loading={palletization.isLoading} error={palletization.error} productLabel={item.referencia ?? undefined} />
    <ProductPrintLayoutDialog open={showLayout} onOpenChange={setShowLayout} data={printLayout.data} loading={printLayout.isLoading} error={printLayout.error} productLabel={String(item.productCode ?? "")} revision={item.revision} />
    {message ? <OperationalMessageDialog open tone="caution" title="Apontamento Manual" description={message} onClose={() => setMessage(null)} /> : null}
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><span className="manual-pointing-label block text-xs font-black uppercase tracking-[.12em]">{label}</span><p className="manual-pointing-card mt-1 min-h-11 rounded-lg border px-3 py-2 text-lg font-black">{value}</p></div>; }
function TimeCard({ label, value }: { label: string; value: string }) { return <div className="manual-pointing-card rounded-xl border-2 px-5 py-4"><span className="manual-pointing-label text-sm font-black uppercase tracking-wider">{label}</span><p className="manual-pointing-value mt-1 font-mono text-4xl font-black">{value}</p></div>; }
function Field({ label, value, onChange, large = false }: { label: string; value: string; onChange: (value: string) => void; large?: boolean }) { return <label className="manual-pointing-card block rounded-xl border p-3"><span className="manual-pointing-label flex items-center gap-2 text-sm font-black uppercase tracking-wide">{label}</span><Input value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`manual-quantity-input mt-2 text-center font-mono font-black ${large ? "h-32 text-7xl" : "h-20 text-4xl"}`} placeholder="0" /></label>; }
