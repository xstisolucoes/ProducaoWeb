import { SortableHeader, useGridSort } from "@/components/ProductionPrimitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3, CheckCircle2 } from "lucide-react";

type ApprovedProcessQuantity = {
  processGroup: number | null;
  arrangement: string | null;
  approvedQuantity: number | null;
  status: string | null;
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined || input === ""
    ? "—"
    : String(input);
}

export function ApprovedProcessQuantitiesDialog({
  open,
  onOpenChange,
  data,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ApprovedProcessQuantity[] | undefined;
  loading: boolean;
  error: { message: string } | null;
}) {
  const totalApproved =
    data?.reduce((total, item) => total + (item.approvedQuantity ?? 0), 0) ?? 0;
  const { sortedItems, sortKey, sortDirection, toggleSort } = useGridSort(data);
  const header = (
    label: string,
    column: keyof ApprovedProcessQuantity,
    alignment = ""
  ) => (
    <SortableHeader
      label={label}
      column={column}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={key => toggleSort(key as keyof ApprovedProcessQuantity & string)}
      className={alignment}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-surface !flex !w-[calc(100vw-1rem)] !max-w-4xl !flex-col !overflow-hidden border-2 border-[#d5b85f] bg-[#fffdf6] p-0 shadow-2xl sm:!w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b-2 border-[#ead69c] bg-gradient-to-r from-[#fff6d9] via-[#f5fbf3] to-white px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black text-[#3f513a]">
                <BarChart3 className="h-6 w-6 text-[#b88014]" />
                Quantidades Aprovadas
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm font-bold text-[#697a67]">
                Histórico Consolidado da OP por Grupo de Processo, Arranjo e
                Situação.
              </DialogDescription>
            </div>
            <div className="reservation-total rounded-xl border px-4 py-2 text-right">
              <p className="text-[12px] font-black tracking-[.14em]">
                Total Aprovado
              </p>
              <p className="mt-1 font-mono text-2xl font-black">
                {totalApproved}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="w-full bg-[#fffdf6] p-4 sm:p-6">
          {loading ? (
            <p className="rounded-xl bg-[#f4f8f1] p-5 text-base font-bold text-[#52705a]">
              Consultando Quantidades Aprovadas…
            </p>
          ) : error ? (
            <p className="rounded-xl border-2 border-[#e3abab] bg-[#fff2f2] p-5 text-base font-bold text-[#a23434]">
              {error.message}
            </p>
          ) : !data?.length ? (
            <p className="rounded-xl border-2 border-dashed border-[#d8c783] bg-white p-6 text-center text-base font-bold text-[#7a6937]">
              Ainda Não Há Quantidades Aprovadas Registradas para Esta OP.
            </p>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border-2 border-[#dfe7df] bg-white">
              <table className="w-full min-w-[650px] text-left text-base">
                <thead className="theme-grid-header sticky top-0 z-10 border-b-2 border-[#e0c976] bg-[#fff2c9] font-['Tahoma'] text-xs font-black tracking-[.12em] text-[#705719]">
                  <tr className="justify-self-center">
                    {header("Processo", "processGroup")}
                    {header("Arranjo", "arrangement")}
                    {header("Q. Aprovada", "approvedQuantity", "text-center")}
                    {header("Status", "status", "text-center")}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((row, index) => (
                    <tr
                      key={`${row.processGroup}-${row.arrangement}-${row.status}-${index}`}
                      className={`theme-grid-row ${index % 2 ? "bg-[#fbfdfb]" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-[#355044]">
                        {value(row.processGroup)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#56685f]">
                        {value(row.arrangement)}
                      </td>
                      <td className="px-4 py-3 font-mono text-lg font-black text-[#177458] text-center">
                        {row.approvedQuantity ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex w-full items-center justify-between border-t border-[#e7ebdf] bg-[#fffdf6] px-5 py-4">
          <p className="approved-help flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="h-5 w-5" />A tabela exibe quantidades
            aprovadas consolidadas por processo e arranjo.
          </p>
          <Button
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-lg bg-[#cf3f3f] px-7 text-base font-black text-white hover:bg-[#ad2e2e]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
