import {
  Activity,
  CheckCircle2,
  CircleDotDashed,
  ClipboardList,
  PlayCircle,
  TimerReset,
} from "lucide-react";
import {
  ConnectionNotice,
  LoadingRows,
  PageHeading,
  SortableHeader,
  StatusPill,
  displayValue,
  useGridSort,
} from "@/components/ProductionPrimitives";
import { trpc } from "@/lib/trpc";

const metrics = [
  {
    key: "emProducao",
    label: "Em Produção",
    detail: "Processos Ativos",
    icon: PlayCircle,
    tone: "bg-[#e6f4ec] text-[#1c7351]",
  },
  {
    key: "liberado",
    label: "Liberadas",
    detail: "Aguardando Processo",
    icon: CircleDotDashed,
    tone: "bg-[#fff2d7] text-[#a06408]",
  },
  {
    key: "parcial",
    label: "Parciais",
    detail: "Com Saldo Pendente",
    icon: TimerReset,
    tone: "bg-[#e8efff] text-[#4869ae]",
  },
  {
    key: "atendido",
    label: "Atendidas",
    detail: "Processos Concluídos",
    icon: CheckCircle2,
    tone: "bg-[#e5f4f1] text-[#197064]",
  },
] as const;

export default function ProductionDashboard() {
  const dashboard = trpc.production.dashboard.useQuery(undefined, {
    retry: false,
  });
  const orders = trpc.production.orders.list.useQuery(
    { page: 1, limit: 5, search: "" },
    { retry: false }
  );
  const error = dashboard.error || orders.error;
  const data = dashboard.data;
  const { sortedItems, sortKey, sortDirection, toggleSort } = useGridSort(
    orders.data?.items
  );

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Visão Operacional"
        title="Produção em Curso"
        description="Acompanhe a Fila e o Andamento da Operação a Partir das Informações Registradas no Firebird."
      />
      {error && <ConnectionNotice error={error} />}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(metric => {
          const Icon = metric.icon;
          const value = data?.[metric.key];
          return (
            <article
              key={metric.key}
              className="relative overflow-hidden rounded-2xl border border-[#e2e5df] bg-white p-5 shadow-[0_8px_25px_rgba(31,42,34,0.035)]"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-xl ${metric.tone}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <Activity className="h-4 w-4 text-[#b7bdb5]" />
              </div>
              {dashboard.isLoading ? (
                <div className="mt-7 h-8 w-16 animate-pulse rounded-md bg-[#edf0eb]" />
              ) : (
                <p className="mt-7 text-3xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                  {displayValue(value)}
                </p>
              )}
              <p className="mt-1 text-sm font-bold text-[#39443b]">
                {metric.label}
              </p>
              <p className="mt-0.5 text-xs text-[#8a9289]">{metric.detail}</p>
            </article>
          );
        })}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#e1e5de] bg-white shadow-[0_12px_32px_rgba(31,42,34,0.035)]">
        <div className="flex flex-col gap-3 border-b border-[#eceee9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold tracking-[-0.025em] text-[#223027]">
              Ordens em Destaque
            </h2>
            <p className="mt-0.5 text-xs text-[#7d867d]">
              Últimos Processos Registrados na Programação
            </p>
          </div>
          <ClipboardList className="h-5 w-5 text-[#8d968d]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#fafbf9] text-[10px] ''tracking-[0.1em] text-[#899189]">
              <tr>
                <SortableHeader
                  label="Ordem"
                  column="op_codigo"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={key => toggleSort(key as never)}
                />
                <SortableHeader
                  label="Produto"
                  column="referencia"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={key => toggleSort(key as never)}
                />
                <SortableHeader
                  label="Processo"
                  column="processo"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={key => toggleSort(key as never)}
                />
                <SortableHeader
                  label="Fila"
                  column="fila"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={key => toggleSort(key as never)}
                />
                <SortableHeader
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={key => toggleSort(key as never)}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {orders.isLoading ? (
                <LoadingRows columns={5} />
              ) : (
                sortedItems.map(item => (
                  <tr
                    key={`${item.op_codigo}-${item.mp_codigo}`}
                    className="transition-colors hover:bg-[#fbfcfa]"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-[#334139]">
                      OP {item.op_codigo}
                    </td>
                    <td className="px-5 py-3.5 text-[#465148]">
                      {displayValue(item.produto_referencia || item.referencia)}
                    </td>
                    <td className="px-5 py-3.5 text-[#465148]">
                      {displayValue(item.processo)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#617066]">
                      {displayValue(item.fila)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!orders.isLoading && !orders.data?.items.length && (
          <div className="px-5 py-12 text-center text-sm text-[#899189]">
            Os Processos Aparecerão Aqui Quando o Proxy Firebird Local Estiver
            Disponível.
          </div>
        )}
      </section>
    </div>
  );
}
