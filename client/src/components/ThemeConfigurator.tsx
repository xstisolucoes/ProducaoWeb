import { useTheme, type TypographyFontFamily } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import {
  AArrowUp,
  Bold,
  Check,
  Italic,
  Palette,
  RotateCcw,
  Type,
} from "lucide-react";

const XPAPER_LOGO = XPAPER_LOGO_SRC;

const FONT_OPTIONS: Array<{ value: TypographyFontFamily; label: string }> = [
  { value: "arial", label: "Arial" },
  { value: "tahoma", label: "Tahoma" },
  { value: "verdana", label: "Verdana" },
  { value: "calibri", label: "Calibri" },
];

const SIZE_OPTIONS = [13, 14, 15, 16, 17, 18, 19, 20];

export function ThemeConfigurator({ compact = false }: { compact?: boolean }) {
  const {
    brandTheme,
    setBrandTheme,
    typography,
    setTypography,
    resetTypography,
  } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`theme-config-trigger h-9 shrink-0 rounded-lg border-2 !border-white !bg-white !px-3 text-sm font-black shadow-[0_2px_10px_rgba(0,0,0,.32)] ${brandTheme === "xsti" ? "!text-[#7d1520] hover:!bg-[#ffe9eb] hover:!text-[#530a10]" : "!text-[#123c30] hover:!bg-[#e7f7ed] hover:!text-[#08271e]"}`}
        >
          <Palette className="h-4 w-4" />
          {!compact ? "Configurar Tema" : "Tema"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl theme-typography-dialog">
        <DialogHeader>
          <DialogTitle>Configurador de Temas</DialogTitle>
          <DialogDescription>
            Escolha a Identidade Visual e a Tipografia desta Máquina/Processo.
            Cada Tema Guarda Seu Próprio Padrão Neste Computador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBrandTheme("verde")}
            className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "verde" ? "border-[#177458] ring-2 ring-[#95cfab]" : "border-[#d6e2d9] hover:border-[#76ad89]"}`}
          >
            <div className="h-28 bg-[linear-gradient(112deg,#0b3a30,#1c765a,#0d4e3e)] p-5 text-white">
              <p className="text-xs font-black ''tracking-[.16em] text-[#c6e5d1]">
                Tema Operacional
              </p>
              <p className="mt-2 text-xl font-black">Verde Produção</p>
            </div>
            <div className="flex items-center justify-between bg-white p-4">
              <span className="text-sm font-semibold text-[#385044]">
                Tema Atual do Sistema
              </span>
              {brandTheme === "verde" ? (
                <Check className="h-5 w-5 text-[#177458]" />
              ) : null}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setBrandTheme("xsti")}
            className={`overflow-hidden rounded-xl border-2 text-left transition ${brandTheme === "xsti" ? "border-[#b6222a] ring-2 ring-[#e8a7ab]" : "border-[#ded6d6] hover:border-[#c85b61]"}`}
          >
            <div className="flex h-28 items-center justify-between bg-[linear-gradient(112deg,#0b0b0c,#2a1719,#971f29)] px-5">
              <img
                src={XPAPER_LOGO}
                alt="XPAPER"
                className="h-16 max-w-48 object-contain"
              />
              <div className="text-right text-white">
                <p className="text-xs font-black ''tracking-[.16em] text-red-100">
                  Identidade XPAPER
                </p>
                <p className="mt-2 text-xl font-black">Vermelho XPAPER</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white p-4">
              <span className="text-sm font-semibold text-[#4e3638]">
                Preto, Branco e Vermelho Operacional
              </span>
              {brandTheme === "xsti" ? (
                <Check className="h-5 w-5 text-[#b6222a]" />
              ) : null}
            </div>
          </button>
        </div>
        <section className="rounded-xl border theme-typography-panel">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 theme-typography-panel-header">
            <div>
              <h3 className="flex items-center gap-2 text-base font-black">
                <Type className="h-4 w-4" /> Tipografia
              </h3>
              <p className="mt-1 text-xs">
                Padrão Salvo para o Tema{" "}
                <strong>
                  {brandTheme === "verde"
                    ? "Verde Produção"
                    : "Vermelho XPAPER"}
                </strong>
                .
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetTypography}
              className="theme-typography-reset"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar Tahoma
            </Button>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-[1.25fr_.8fr_1fr]">
            <label className="grid gap-1.5 text-sm font-bold">
              <span>Fonte</span>
              <select
                value={typography.fontFamily}
                onChange={event =>
                  setTypography({
                    fontFamily: event.target.value as TypographyFontFamily,
                  })
                }
                className="h-10 rounded-lg border bg-white px-3 outline-none theme-typography-control"
              >
                {FONT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              <span className="flex items-center gap-1">
                <AArrowUp className="h-4 w-4" /> Tamanho
              </span>
              <select
                value={typography.fontSize}
                onChange={event =>
                  setTypography({ fontSize: Number(event.target.value) })
                }
                className="h-10 rounded-lg border bg-white px-3 outline-none theme-typography-control"
              >
                {SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-1.5 text-sm font-bold">
              <span>Estilo Base</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setTypography({
                      fontWeight:
                        typography.fontWeight === "bold" ? "normal" : "bold",
                    })
                  }
                  aria-pressed={typography.fontWeight === "bold"}
                  className={`h-10 gap-1.5 ${typography.fontWeight === "bold" ? "theme-typography-active" : "theme-typography-control"}`}
                >
                  <Bold className="h-4 w-4" /> Bold
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setTypography({
                      fontStyle:
                        typography.fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                  aria-pressed={typography.fontStyle === "italic"}
                  className={`h-10 gap-1.5 ${typography.fontStyle === "italic" ? "theme-typography-active" : "theme-typography-control"}`}
                >
                  <Italic className="h-4 w-4" /> Itálico
                </Button>
              </div>
            </div>
          </div>
          <div className="mx-4 mb-4 rounded-lg border px-4 py-3 theme-typography-preview">
            <p className="text-xs font-bold ''tracking-[.12em]">
              Prévia Operacional
            </p>
            <p className="mt-1 text-lg">
              Máquina/Processo · OP 8721 · Quantidade a Apontar: 642
            </p>
            <p className="mt-1 text-xs">
              A Alteração é Imediata na Interface Web. Títulos com Destaque
              Operacional Preservam Sua Hierarquia Visual.
            </p>
          </div>
        </section>
        <DialogFooter>
          <span className="mr-auto text-xs font-medium text-[#68736c]">
            A Tipografia das Etiquetas PDF Continua Fixa no Modelo de Impressão.
          </span>
          <DialogClose asChild>
            <Button className="bg-[#cf3f3f] text-white hover:bg-[#ad2e2e]">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
