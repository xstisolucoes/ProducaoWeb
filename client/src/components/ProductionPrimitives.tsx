import { AlertCircle, ChevronLeft, ChevronRight, Search, WifiOff } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PageHeading({ eyebrow, title, description, action, compact = false }: { eyebrow: string; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return (
    <header className={`flex flex-col border-b border-[#e6e7e2] ${compact ? "gap-2 pb-3 lg:flex-row lg:items-end lg:justify-between" : "gap-5 pb-6 lg:flex-row lg:items-end lg:justify-between"}`}>
      <div>
        {eyebrow ? <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.19em] text-[#90978c]">{eyebrow}</p> : null}
        <h1 className={`${compact ? "text-2xl sm:text-[1.7rem]" : "text-3xl sm:text-[2rem]"} font-extrabold tracking-[-0.045em] text-[#17211d]`}>{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e756d]">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function ConnectionNotice({ error, title = "Aguardando o proxy Firebird local" }: { error?: { message?: string } | null; title?: string }) {
  const message = error?.message === "fetch failed"
    ? "Não foi possível alcançar o proxy na rede local. Verifique se o serviço foi iniciado e se o endereço configurado pertence à LAN."
    : error?.message || "Inicie o proxy na LAN e confirme a URL e o token da configuração local para carregar os dados operacionais.";
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
      {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> : <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 leading-5 text-amber-800">{message}</p>
      </div>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = "Pesquisar", inputRef }: { value: string; onChange: (value: string) => void; placeholder?: string; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa198]" />
      <Input ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-lg border-[#dfe2dc] bg-white pl-9 text-sm shadow-sm placeholder:text-[#a4aaa2] focus-visible:ring-[#1c7561]" />
    </div>
  );
}

export function TablePagination({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (page: number) => void }) {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const hasPrevious = page > 1;
  const hasNext = last < total;
  return (
    <div className="flex flex-col gap-3 border-t border-[#eceee9] px-5 py-3.5 text-xs text-[#737b72] sm:flex-row sm:items-center sm:justify-between">
      <span>{total ? `${first}–${last} de ${total} registros` : "Nenhum registro encontrado"}</span>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button variant="outline" size="icon" disabled={!hasPrevious} onClick={() => onChange(page - 1)} className="h-8 w-8 rounded-md border-[#dde1da] bg-white"><ChevronLeft className="h-4 w-4" /><span className="sr-only">Página anterior</span></Button>
        <span className="min-w-14 text-center font-mono text-[11px] text-[#48534b]">PÁG. {page}</span>
        <Button variant="outline" size="icon" disabled={!hasNext} onClick={() => onChange(page + 1)} className="h-8 w-8 rounded-md border-[#dde1da] bg-white"><ChevronRight className="h-4 w-4" /><span className="sr-only">Próxima página</span></Button>
      </div>
    </div>
  );
}

export function processStatusClass(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLocaleLowerCase("pt-BR");
  if (normalized === "em produção") return "bg-[#fff0b8] text-[#805900]";
  if (normalized === "liberado") return "bg-[#dceeff] text-[#155c99]";
  if (normalized === "atendido") return "bg-[#dcf5e7] text-[#176b43]";
  if (normalized === "cancelado" || normalized === "setup cancelado" || normalized === "parado") return "bg-[#ffe1e1] text-[#a42c2c]";
  if (normalized === "a concluir" || normalized === "setup a concluir") return "bg-[#ffe7bd] text-[#a55b00]";
  if (normalized === "parcial") return "bg-[#e5edff] text-[#34549b]";
  return "bg-[#eff1ee] text-[#687169]";
}

export function StatusPill({ status, label }: { status: string | null | undefined; label?: string }) {
  const style = processStatusClass(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{label || status || "Sem status"}</span>;
}

export const displayValue = (value: string | number | null | undefined, fallback = "—") => value === null || value === undefined || value === "" ? fallback : String(value);

export function LoadingRows({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return <>{Array.from({ length: rows }).map((_, row) => <tr key={row} className="animate-pulse">{Array.from({ length: columns }).map((__, column) => <td className="px-5 py-4" key={column}><div className="h-3.5 rounded bg-[#edf0eb]" style={{ width: `${58 + ((row + column) % 4) * 10}%` }} /></td>)}</tr>)}</>;
}
