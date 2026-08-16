import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { ClipboardPenLine, Hammer, Lightbulb, Save, Send, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RequestType = "maintenance" | "development";

const typeInfo: Record<RequestType, { label: string; areaCode: number; icon: typeof Wrench; description: string; selected: string }> = {
  maintenance: { label: "Manutenção", areaCode: 9, icon: Wrench, description: "Solicite reparos, ajustes e intervenções de manutenção.", selected: "border-[#d39a24] bg-[#fff7df] text-[#7a5105]" },
  development: { label: "Desenvolvimento", areaCode: 3, icon: Lightbulb, description: "Solicite melhorias, produtos e desenvolvimentos técnicos.", selected: "border-[#267ca4] bg-[#eef9ff] text-[#155b7e]" },
};

export default function Requests() {
  const { user } = useLocalAuth();
  const [type, setType] = useState<RequestType>("maintenance");
  const [description, setDescription] = useState("");
  const create = trpc.production.requests.create.useMutation({
    onSuccess: (result) => {
      toast.success(`Solicitação ${result.code} registrada`, { description: "Status inicial: Aberto." });
      setDescription("");
    },
    onError: (error) => toast.error("Não foi possível registrar a solicitação", { description: error.message }),
  });
  const current = typeInfo[type];
  const CurrentIcon = current.icon;

  const chooseType = (next: RequestType) => {
    setType(next);
  };

  const submit = () => {
    if (description.trim().length < 3) return toast.error("Descreva a solicitação antes de salvar.");
    create.mutate({ type, description: description.trim() });
  };

  return <div className="mx-auto max-w-5xl space-y-6 px-1 pb-8">
    <section className="rounded-2xl border border-[#d9e3dc] bg-gradient-to-r from-[#f1faf4] via-white to-[#fff8e4] p-6 shadow-[0_14px_30px_rgba(28,76,56,.06)]">
      <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#177458] text-white shadow-lg shadow-[#177458]/20"><ClipboardPenLine className="h-6 w-6" /></div><div><p className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-[#5f7d6d]">Solicitações internas</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em] text-[#193d2f]">Nova solicitação</h1><p className="mt-2 max-w-2xl text-sm font-medium text-[#65766d]">Escolha entre Manutenção e Desenvolvimento, informe o setor e descreva objetivamente a necessidade.</p></div></div>
    </section>

    <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 shadow-[0_12px_28px_rgba(31,42,34,.04)]">
      <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[.15em] text-[#66766d]">Solicitar para</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(typeInfo) as RequestType[]).map((key) => {
          const option = typeInfo[key]; const Icon = option.icon; const selected = type === key;
          return <button key={key} type="button" onClick={() => chooseType(key)} className={`group rounded-2xl border-2 p-5 text-left transition-all ${selected ? option.selected : "border-[#e2e8e4] bg-white text-[#385047] hover:border-[#b9d1c1] hover:bg-[#f7fbf8]"}`}>
            <div className="flex items-center gap-4"><div className={`flex h-14 w-14 items-center justify-center rounded-xl ${selected ? "bg-white/75" : "bg-[#eff7f1]"}`}><Icon className={`h-7 w-7 ${key === "maintenance" ? "text-[#c17714]" : "text-[#20749c]"}`} /></div><div><p className="text-xl font-black">{option.label}</p><p className="mt-1 text-sm font-medium opacity-75">{option.description}</p></div></div>
          </button>;
        })}
      </div>
    </section>

    <section className="rounded-2xl border border-[#e1e7e2] bg-white p-5 shadow-[0_12px_28px_rgba(31,42,34,.04)]">
      <div className="mb-5 flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${type === "maintenance" ? "bg-[#fff3cf] text-[#9a640e]" : "bg-[#eaf7ff] text-[#206f95]"}`}><CurrentIcon className="h-5 w-5" /></div><div><p className="font-bold text-[#294438]">Solicitação para {current.label}</p><p className="text-xs font-medium text-[#7a887f]">Solicitante: {user?.name ?? "Usuário local"}{user?.machine ? ` · Máquina ${user.machine.description}` : ""}</p></div></div>
      <div><p className="mb-3 text-xs font-medium text-[#718078]">O setor de destino é definido automaticamente pela opção Manutenção ou Desenvolvimento.</p><label className="grid gap-2 text-sm font-bold text-[#40564a]"><span>Descrição da solicitação <b className="text-[#bb3434]">*</b></span><Textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 300))} placeholder="Descreva a necessidade, local e impacto na operação…" className="min-h-32 resize-none border-2 border-[#dbe5de] bg-[#fbfdfb] p-3 text-base font-medium focus-visible:ring-[#177458]" /><span className="text-right font-mono text-[11px] text-[#849188]">{description.length}/300</span></label></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ee] pt-5"><p className="text-xs font-medium text-[#718078]">A solicitação será registrada com situação inicial <b>Aberto</b>.</p><Button onClick={submit} disabled={create.isPending || description.trim().length < 3} className="h-12 bg-[#177458] px-6 text-base font-black hover:bg-[#105f45]"><Save className="mr-2 h-5 w-5" />{create.isPending ? "Salvando…" : "Salvar solicitação"}</Button></div>
    </section>

    <section className="rounded-2xl border border-[#ead9aa] bg-[#fffaf0] px-5 py-4"><div className="flex items-center gap-3"><Send className="h-5 w-5 text-[#a56c13]" /><p className="text-sm font-bold text-[#6a531f]">Os campos de setor e descrição são obrigatórios. A criação só ocorre após confirmação visual do sistema.</p></div></section>
  </div>;
}
