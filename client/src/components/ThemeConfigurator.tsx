import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import { Check, Palette } from "lucide-react";

const XPAPER_LOGO = XPAPER_LOGO_SRC;

export function ThemeConfigurator({ compact = false }: { compact?: boolean }) {
  const { brandTheme, setBrandTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className={`theme-config-trigger h-9 shrink-0 rounded-lg border-2 !border-white !bg-white !px-3 text-sm font-black shadow-[0_2px_10px_rgba(0,0,0,.32)] ${brandTheme === "xsti" ? "!text-[#7d1520] hover:!bg-[#ffe9eb] hover:!text-[#530a10]" : "!text-[#123c30] hover:!bg-[#e7f7ed] hover:!text-[#08271e]"} ${compact ? "" : ""}`}>
          <Palette className="h-4 w-4" />
          {!compact ? "Configurar tema" : "Tema"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurador de temas</DialogTitle>
          <DialogDescription>Escolha a identidade visual desta Máquina/Processo. A preferência fica salva neste computador.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setBrandTheme("verde")} className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "verde" ? "border-[#177458] ring-2 ring-[#95cfab]" : "border-[#d6e2d9] hover:border-[#76ad89]"}`}>
            <div className="h-28 bg-[linear-gradient(112deg,#0b3a30,#1c765a,#0d4e3e)] p-5 text-white"><p className="text-xs font-black uppercase tracking-[.16em] text-[#c6e5d1]">Tema operacional</p><p className="mt-2 text-xl font-black">Verde Produção</p></div>
            <div className="flex items-center justify-between bg-white p-4"><span className="text-sm font-semibold text-[#385044]">Tema atual do sistema</span>{brandTheme === "verde" ? <Check className="h-5 w-5 text-[#177458]" /> : null}</div>
          </button>
          <button onClick={() => setBrandTheme("xsti")} className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "xsti" ? "border-[#b6222a] ring-2 ring-[#e8a7ab]" : "border-[#ded6d6] hover:border-[#c85b61]"}`}>
            <div className="flex h-28 items-center justify-between bg-[linear-gradient(112deg,#0b0b0c,#2a1719,#971f29)] px-5"><img src={XPAPER_LOGO} alt="XPAPER" className="h-16 max-w-48 object-contain" /><div className="text-right text-white"><p className="text-xs font-black uppercase tracking-[.16em] text-red-100">Identidade XPAPER</p><p className="mt-2 text-xl font-black">Vermelho XPAPER</p></div></div>
            <div className="flex items-center justify-between bg-white p-4"><span className="text-sm font-semibold text-[#4e3638]">Preto, branco e vermelho operacional</span>{brandTheme === "xsti" ? <Check className="h-5 w-5 text-[#b6222a]" /> : null}</div>
          </button>
        </div>
        <DialogFooter><span className="mr-auto text-xs font-medium text-[#68736c]">O tema é aplicado imediatamente a esta Máquina/Processo.</span><DialogClose asChild><Button className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">Fechar</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
