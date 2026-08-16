import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { Hammer, Lightbulb, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RequestType = "maintenance" | "development";

const types: Record<RequestType, { label: string; Icon: typeof Hammer; description: string; selected: string }> = {
  maintenance: { label: "Manutenção", Icon: Hammer, description: "Reparos, ajustes e intervenções de manutenção.", selected: "border-[#cf9823] bg-[#fff7df] text-[#7b5307]" },
  development: { label: "Desenvolvimento", Icon: Lightbulb, description: "Melhorias, produtos e desenvolvimentos técnicos.", selected: "border-[#287aa0] bg-[#eef8ff] text-[#135b7f]" },
};

export function RequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useLocalAuth();
  const [type, setType] = useState<RequestType>("maintenance");
  const [description, setDescription] = useState("");
  const create = trpc.production.requests.create.useMutation({
    onSuccess: (result) => { toast.success(`Solicitação ${result.code} registrada`, { description: "Situação inicial: Aberto." }); setDescription(""); onOpenChange(false); },
    onError: (error) => toast.error("Não foi possível registrar a solicitação", { description: error.message }),
  });
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Usuário";
  const current = types[type];
  const cancel = () => { setDescription(""); onOpenChange(false); };
  const save = () => { if (description.trim().length < 3) return toast.error("Descreva a solicitação antes de salvar."); create.mutate({ type, description: description.trim() }); };

  return <Dialog open={open} onOpenChange={(next) => !next ? cancel() : onOpenChange(true)}><DialogContent className="!flex !w-[calc(100vw-1rem)] !max-w-3xl !flex-col !overflow-hidden border-2 border-[#d6e0d9] bg-[#fbfdfb] p-0 sm:!w-[calc(100vw-2rem)] sm:rounded-2xl"><DialogHeader className="w-full border-b border-[#e2eae4] bg-gradient-to-r from-[#f0f8f2] via-white to-[#fff8df] px-6 py-5"><DialogTitle className="text-2xl font-black text-[#183e30]">Nova solicitação</DialogTitle><DialogDescription className="text-sm font-medium text-[#63756b]">Selecione o destino e descreva a necessidade. O setor será definido automaticamente.</DialogDescription></DialogHeader><div className="w-full space-y-5 bg-[#fbfdfb] px-6 py-5"><div className="grid items-stretch gap-3 min-[560px]:grid-cols-2">{(Object.keys(types) as RequestType[]).map((key) => { const option = types[key]; const Icon = option.Icon; return <button key={key} type="button" onClick={() => setType(key)} className={`min-h-[124px] min-w-0 rounded-xl border-2 p-4 text-left transition ${type === key ? option.selected : "border-[#e0e7e2] bg-white text-[#365047] hover:border-[#b8d0bf]"}`}><div className="grid h-full min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-3"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-white/75"><Icon className="h-6 w-6" /></span><span className="flex min-h-[76px] min-w-0 flex-col justify-center"><b className="block whitespace-nowrap text-[17px] font-black leading-tight">{option.label}</b><span className="mt-1 block text-xs font-medium leading-5 opacity-75">{option.description}</span></span></div></button>; })}</div><div className="rounded-xl border border-[#e5ece6] bg-white p-4"><p className="font-bold text-[#294438]">Solicitação para {current.label}</p><p className="mt-1 text-xs font-medium text-[#748178]">Solicitante: {firstName}{user?.machine ? ` · Máquina ${user.machine.description}` : ""}</p><label className="mt-4 grid gap-2 text-sm font-bold text-[#40564a]"><span>Descrição da solicitação <b className="text-[#bb3434]">*</b></span><Textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 300))} placeholder="Descreva a necessidade, local e impacto na operação…" className="min-h-32 resize-none border-2 border-[#dbe5de] bg-[#fbfdfb] p-3 text-base font-medium focus-visible:ring-[#177458]" /><span className="text-right font-mono text-[11px] text-[#849188]">{description.length}/300</span></label></div><div className="flex items-center justify-end gap-3"><Button variant="outline" onClick={cancel} className="h-11 border-2 border-[#cc3939] bg-[#cc3939] px-5 font-black text-white hover:bg-[#ad2d2d] hover:text-white"><X className="mr-2 h-4 w-4" />Cancelar</Button><Button onClick={save} disabled={create.isPending || description.trim().length < 3} className="h-11 bg-[#177458] px-5 font-black hover:bg-[#105f45]"><Save className="mr-2 h-4 w-4" />{create.isPending ? "Salvando…" : "Salvar solicitação"}</Button></div></div></DialogContent></Dialog>;
}
