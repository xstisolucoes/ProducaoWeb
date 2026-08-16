import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const proxy = readFileSync(resolve(root, "local-firebird-proxy/server.mjs"), "utf8");
const contracts = readFileSync(resolve(root, "server/firebirdProxy.ts"), "utf8");
const router = readFileSync(resolve(root, "server/routers/production.ts"), "utf8");
const pointing = readFileSync(resolve(root, "client/src/pages/Pointing.tsx"), "utf8");
const dialog = readFileSync(resolve(root, "client/src/components/QueueConsultationDialog.tsx"), "utf8");
const queueRoute = proxy.slice(proxy.indexOf('app.get("/v1/queue",'), proxy.indexOf('app.get("/v1/queue/:opCodigo/processes"'));

describe("Consulta de Fila", () => {
  it("consulta a fila por máquina, limite menor que mil e reserva com saldo da OP", () => {
    expect(proxy).toContain('app.get("/v1/queue", ensureAuthorized');
    expect(proxy).toContain('const filterParts = ["mp.mqp_codigo = ?", "mp.mp_fila < 1000"]');
    expect(proxy).toContain("coalesce(pv.pv_referencia, '') containing ?");
    expect(queueRoute).not.toContain("? = '' or cast(mp.op_codigo");
    expect(proxy).toContain("select count(*) as total from mov_processos mp left join produtos_vendas pv");
    expect(proxy).not.toContain("coalesce(mp.mp_fantasia, '') containing ?");
    expect(proxy).toContain('app.get("/v1/queue/:opCodigo/processes", ensureAuthorized');
    expect(proxy).toContain('app.get("/v1/queue/:opCodigo/reservations", ensureAuthorized');
    expect(proxy).toContain("where er.er_saldo > 0 and er.op_codigo = ?");
  });

  it("ordena os processos da OP por MP_CODIGO conforme a consulta legada", () => {
    expect(proxy).toContain("where mp.op_codigo = ? and mp.mp_op_mestre = ?");
    expect(proxy).toContain("order by mp.mp_codigo");
    expect(proxy).not.toContain("order by case when mp.mp_status = 'Em Produção'");
  });

  it("expõe contratos protegidos e oferece grid, detalhes e reserva no apontamento", () => {
    expect(contracts).toContain("export type QueueOrder");
    expect(contracts).toContain("export const getQueue");
    expect(router).toContain("queue: router({");
    expect(router).toContain("return getQueue(ctx.localUser.machine.code");
    expect(router).toContain("getQueueProcesses(input.opCode, input.masterOrder)");
    expect(pointing).toContain("QueueConsultationDialog");
    expect(pointing).toContain("Consultar fila");
    expect(dialog).toContain("Reserva");
    expect(dialog).toContain("Ajuste L:");
    expect(dialog).toContain("ProductPalletizationDialog");
    expect(dialog).toContain("ProductPrintLayoutDialog");
    expect(dialog).toContain("ProductReservationDialog");
    expect(dialog).toContain("Processos da OP");
    expect(dialog).toContain("Ferramentais");
    expect(dialog).toContain("Pacotes / Paletização");
    expect(dialog).toContain("Visualizar layout");
    expect(dialog).toContain("Não foi possível consultar a Fila da máquina");
    expect(dialog).not.toContain('event.key === "F1"');
    expect(dialog).not.toContain('event.key === "F6"');
    expect(dialog).not.toContain("ShortcutKey");
    expect(dialog).toContain("bg-[#cf3f3f]");
    expect(dialog).toContain("hover:bg-[#ad2e2e]");
  });
});
