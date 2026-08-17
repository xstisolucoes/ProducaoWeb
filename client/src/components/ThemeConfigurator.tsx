import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, Palette } from "lucide-react";

const XSTI_LOGO = "/manus-storage/xsti-logo_fe74654b.png";

export function ThemeConfigurator({ compact = false }: { compact?: boolean }) {
  const { brandTheme, setBrandTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className={`theme-config-trigger h-9 shrink-0 rounded-lg border-2 px-3 text-sm font-semibold ${compact ? "" : ""}`}>
          <Palette className="h-4 w-4" />
          {!compact ? "Configurar tema" : "Tema"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurador de temas</DialogTitle>
          <DialogDescription>Escolha a identidade visual desta estação. A preferência fica salva neste computador.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setBrandTheme("verde")} className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "verde" ? "border-[#177458] ring-2 ring-[#95cfab]" : "border-[#d6e2d9] hover:border-[#76ad89]"}`}>
            <div className="h-28 bg-[linear-gradient(112deg,#0b3a30,#1c765a,#0d4e3e)] p-5 text-white"><p className="text-xs font-black uppercase tracking-[.16em] text-[#c6e5d1]">Tema operacional</p><p className="mt-2 text-xl font-black">Verde Produção</p></div>
            <div className="flex items-center justify-between bg-white p-4"><span className="text-sm font-semibold text-[#385044]">Tema atual do sistema</span>{brandTheme === "verde" ? <Check className="h-5 w-5 text-[#177458]" /> : null}</div>
          </button>
          <button onClick={() => setBrandTheme("xsti")} className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "xsti" ? "border-[#b6222a] ring-2 ring-[#e8a7ab]" : "border-[#ded6d6] hover:border-[#c85b61]"}`}>
            <div className="flex h-28 items-center justify-between bg-[linear-gradient(112deg,#1b1b1d,#372226,#971f29)] px-5"><img src={XSTI_LOGO} alt="XSTI" className="h-16 w-auto rounded bg-white p-1.5 object-contain" /><div className="text-right text-white"><p className="text-xs font-black uppercase tracking-[.16em] text-red-100">Identidade XSTI</p><p className="mt-2 text-xl font-black">Vermelho XSTI</p></div></div>
            <div className="flex items-center justify-between bg-white p-4"><span className="text-sm font-semibold text-[#4e3638]">Soluções em tecnologia</span>{brandTheme === "xsti" ? <Check className="h-5 w-5 text-[#b6222a]" /> : null}</div>
          </button>
        </div>
        <DialogFooter><span className="mr-auto text-xs font-medium text-[#68736c]">O tema é aplicado imediatamente a esta estação.</span><DialogClose asChild><Button className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Fechar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
