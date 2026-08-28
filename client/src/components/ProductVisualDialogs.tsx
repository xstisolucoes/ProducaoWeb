import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { colorChipContrastTone, colorChipStyle } from "@/lib/colorContrast";
import {
  Check,
  ImageIcon,
  Minus,
  Package,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";

function value(item: unknown) {
  return item === null || item === undefined || item === ""
    ? "—"
    : String(item);
}

function Field({
  label,
  value: content,
  grow,
}: {
  label: string;
  value: unknown;
  grow?: boolean;
}) {
  return (
    <span className={grow ? "min-w-52 flex-1" : undefined}>
      {label} <strong className="text-[#c83737]">{value(content)}</strong>
    </span>
  );
}

function CheckItem({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex h-4 w-4 items-center justify-center border ${checked ? "border-[#49753e] bg-[#49753e] text-white" : "border-[#9caf98] bg-white"}`}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {label}
    </span>
  );
}

function PalletImagePanel({
  title,
  description,
  imageDataUri,
  imageError,
}: {
  title: string;
  description?: string | null;
  imageDataUri?: string | null;
  imageError?: string | null;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#b8d1b2] bg-white p-4">
      <div className="mb-3 text-center">
        <h3 className="text-xl font-black text-[#315d2e]">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm font-bold text-[#62765d]">{description}</p>
        ) : null}
      </div>
      <div className="flex min-h-[280px] items-center justify-center overflow-auto rounded-xl bg-[#eef3ec] p-3">
        {imageDataUri ? (
          <img
            src={imageDataUri}
            alt={title}
            className="max-h-[42dvh] max-w-full object-contain"
          />
        ) : (
          <p className="max-w-md rounded-xl border border-dashed border-[#a9bda4] bg-[#f7fbf5] p-5 text-center text-base font-bold text-[#62765d]">
            {imageError ||
              `Nenhuma Imagem Foi Cadastrada para ${title.toLowerCase()}.`}
          </p>
        )}
      </div>
    </section>
  );
}

export function ProductPalletizationDialog({
  open,
  onOpenChange,
  data,
  loading,
  error,
  productLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: any;
  loading?: boolean;
  error?: { message: string } | null;
  productLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-h-[calc(100dvh-1.25rem)] !w-[calc(100vw-1.25rem)] !max-w-[1440px] overflow-y-auto border-2 border-[#d6e0d9] bg-[#fbfdfb] p-4 sm:!max-h-[calc(100dvh-3rem)] sm:!w-[calc(100vw-3rem)] sm:p-6">
        <DialogHeader className="-mx-4 -mt-4 border-b border-[#e2eae4] bg-gradient-to-r from-[#f0f8f2] via-white to-[#fff8df] px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#315d2e]">
            <Package className="h-6 w-6" />
            Pacotes / Paletização
          </DialogTitle>
          <DialogDescription className="text-base font-bold text-[#62765d]">
            {productLabel
              ? `Configuração de Embalagem da OP ${productLabel}.`
              : "Configuração de Embalagem da Ficha do Produto para o Cliente Atual."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="mt-4 text-base font-bold text-[#62765d]">
            Consultando Configuração de Pacotes e Palete…
          </p>
        ) : error ? (
          <p className="mt-4 rounded-xl border-2 border-[#d79393] bg-[#fff1f1] p-4 text-base font-bold text-[#9b2525]">
            {error.message}
          </p>
        ) : !data?.registered ? (
          <div className="mt-4 rounded-xl border-2 border-[#a9bda4] bg-white p-6 text-center">
            <p className="text-xl font-black text-[#3d5c39]">Não cadastrado.</p>
            <p className="mt-2 text-base font-bold text-[#687a67]">
              Não Há Configuração de Pacotes / Paletização para Este Produto,
              Revisão e Cliente.
            </p>
          </div>
        ) : (
          <div
            className={`mt-4 grid min-w-0 gap-4 ${data.palletized ? "min-[1000px]:grid-cols-[minmax(0,.9fr)_minmax(440px,1.1fr)]" : "grid-cols-1"}`}
          >
            <div className="space-y-4">
              <section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-[#315d2e]">Pacotes</h3>
                  <span className="rounded-full bg-[#e4f2df] px-3 py-1 text-xs font-black ''tracking-wide text-[#3f6e39]">
                    {data.customerSpecific
                      ? "Cadastro do Cliente"
                      : "Cadastro Padrão"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-base font-bold text-[#3d4f3b]">
                  <Field label="Tipo:" value={data.packageType} grow />
                  <Field label="Qtde:" value={data.packageQuantity} />
                  <Field
                    label="Fitas Pacote L:"
                    value={data.packageStrapsWidth}
                  />
                  <Field label="C:" value={data.packageStrapsLength} />
                </div>
              </section>
              {data.palletized ? (
                <>
                  <section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4">
                    <h3 className="text-xl font-black text-[#315d2e]">
                      Palete
                    </h3>
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-base font-bold text-[#3d4f3b]">
                      <Field
                        label="Tipo do Palete:"
                        value={data.palletDescription}
                        grow
                      />
                      <Field
                        label="Remontado:"
                        value={data.remounted ? "Sim" : "Não"}
                      />
                      <Field
                        label="Altura Máxima do Palete:"
                        value={data.maximumHeight}
                      />
                      <span>Medidas (mm):</span>
                      <Field label="L:" value={data.palletWidth} />
                      <Field label="C:" value={data.palletLength} />
                      <Field label="Lastro L:" value={data.packagesPerLayer} />
                      <Field
                        label="Qtde de Pacotes na Altura:"
                        value={data.packagesHigh}
                      />
                      <Field
                        label="Total Pacotes:"
                        value={data.totalPackages}
                      />
                      <Field
                        label="Total de Unid:"
                        value={data.totalProducts}
                      />
                    </div>
                  </section>
                  <section className="rounded-2xl border-2 border-[#b8d1b2] bg-white p-4">
                    <div className="flex flex-wrap gap-x-7 gap-y-3 text-base font-bold text-[#3d4f3b]">
                      <CheckItem label="Arqueado" checked={data.arched} />
                      <CheckItem label="Espelho" checked={data.mirrored} />
                      <CheckItem
                        label="Cantoneira"
                        checked={data.cornerProtector}
                      />
                      <CheckItem
                        label="Filme Stretch"
                        checked={data.stretchFilm}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-7 gap-y-3 text-base font-bold text-[#3d4f3b]">
                      <Field
                        label="Fitas no Palete: L:"
                        value={data.palletStrapsWidth}
                      />
                      <Field label="C:" value={data.palletStrapsLength} />
                    </div>
                  </section>
                </>
              ) : null}
              <section className="rounded-2xl border-2 border-[#d6c796] bg-[#fffdf3] p-4">
                <h3 className="text-xl font-black text-[#755c18]">
                  Observação
                </h3>
                <p className="mt-2 min-h-28 whitespace-pre-wrap rounded-xl border border-[#e5d8a5] bg-white p-3 text-base font-bold leading-relaxed text-[#564818]">
                  {data.observation || "—"}
                </p>
              </section>
            </div>
            {data.palletized ? (
              <div className="content-start">
                <PalletImagePanel
                  title="Lastro de Amarração"
                  description={data.layerDescription}
                  imageDataUri={data.layerImageDataUri}
                  imageError={data.layerImageError}
                />
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-5 flex justify-end border-t border-[#e2eae4] pt-4">
          <Button
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-lg bg-[#cf3f3f] px-6 text-base font-black text-white hover:bg-[#ad2e2e]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductPrintLayoutDialog({
  open,
  onOpenChange,
  data,
  loading,
  error,
  productLabel,
  revision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: any;
  loading?: boolean;
  error?: { message: string } | null;
  productLabel?: string;
  revision?: unknown;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  useEffect(() => {
    if (!open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDrag(null);
    }
  }, [open]);
  const changeZoom = (delta: number) =>
    setZoom(current => Math.min(3, Math.max(0.4, current + delta)));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !h-dvh !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none border-0 bg-white p-0 text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Layout de Impressão</DialogTitle>
          <DialogDescription>
            Visualização Ampliada do Layout da Ficha de Impressão.
          </DialogDescription>
        </DialogHeader>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#92c7a3] bg-[#d9f2df] px-3 py-2 shadow-sm">
            <div className="mr-auto flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <ImageIcon className="h-5 w-5 shrink-0 text-[#176148]" />
              <span className="text-xs font-black ''tracking-wide text-[#356d4a]">
                Produto
              </span>
              <span className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm">
                {productLabel || data?.productCode || "—"}
              </span>
              <span className="text-xs font-black ''tracking-wide text-[#356d4a]">
                Rev.
              </span>
              <span className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm">
                {value(revision)}
              </span>
              {data?.cliches?.map((cliche: any) => (
                <span
                  key={`${cliche.code}-${cliche.series}`}
                  className="layout-meta-card rounded border border-[#a6cdb1] bg-white px-2 py-1 text-sm font-black text-[#19412a] shadow-sm"
                >
                  Clichê {cliche.code}
                  {cliche.series ? `/${cliche.series}` : ""}
                </span>
              ))}
              {data?.colors?.map((color: any) => (
                <span
                  key={`${color.order}-${color.description}`}
                  data-contrast={colorChipContrastTone(color.hexWhite)}
                  className="layout-color-chip rounded border px-3 py-1 text-sm font-black shadow-sm"
                  style={colorChipStyle(color.hexWhite)}
                >
                  {color.description}
                </span>
              ))}
            </div>
            <div className="flex items-center rounded-lg border border-[#70aa83] bg-white text-[#185d3b] shadow-sm">
              <Button
                variant="ghost"
                onClick={() => changeZoom(-0.2)}
                className="h-10 rounded-r-none px-3 text-[#185d3b] hover:bg-[#edf8f0]"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <span className="min-w-14 text-center text-sm font-black">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                onClick={() => changeZoom(0.2)}
                className="h-10 rounded-l-none px-3 text-[#185d3b] hover:bg-[#edf8f0]"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={reset}
              className="h-10 border-[#70aa83] bg-white px-3 text-sm font-black text-[#185d3b] shadow-sm hover:bg-[#f1fbf3]"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Ajustar
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-lg bg-[#cf3f3f] px-3 text-sm font-black text-white hover:bg-[#ad2e2e]"
            >
              Fechar
            </Button>
          </header>
          <div
            className="relative min-h-0 flex-1 overflow-hidden bg-white"
            onWheel={event => {
              event.preventDefault();
              changeZoom(event.deltaY < 0 ? 0.15 : -0.15);
            }}
            onPointerMove={event => {
              if (!drag) return;
              setPan({
                x: drag.panX + event.clientX - drag.x,
                y: drag.panY + event.clientY - drag.y,
              });
            }}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
          >
            {loading ? (
              <p className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#476171]">
                Carregando Layout e Recursos de Impressão…
              </p>
            ) : error ? (
              <p className="absolute inset-0 m-auto h-fit max-w-xl rounded-xl border-2 border-[#e5a6a6] bg-[#fff2f2] p-5 text-center text-base font-bold text-[#a21d1d]">
                {error.message}
              </p>
            ) : data?.svgDataUri ? (
              <div
                className="flex h-full w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                onPointerDown={event => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDrag({
                    x: event.clientX,
                    y: event.clientY,
                    panX: pan.x,
                    panY: pan.y,
                  });
                }}
              >
                <img
                  src={data.svgDataUri}
                  alt={`Layout do produto ${data.productCode || ""}`}
                  draggable={false}
                  className="max-h-[88vh] max-w-[94vw] select-none object-contain transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                />
              </div>
            ) : (
              <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-base font-bold text-[#607568]">
                {data?.layoutError || "Não Há Layout Cadastrado para Esta OP."}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
