import { describe, expect, it, vi } from "vitest";

const proxy = vi.hoisted(() => ({
  firebirdProxyHealthCheck: vi.fn(),
  getOrders: vi.fn(),
  getProgramming: vi.fn(),
  getControlledMachines: vi.fn(),
  getPointingOrder: vi.fn(),
  getProcessOptions: vi.fn(),
  getRpncChecklist: vi.fn(),
  getProducts: vi.fn(),
  getProductionDashboard: vi.fn(),
  getStock: vi.fn(),
  getStockHistory: vi.fn(),
  updateOrderStatus: vi.fn(),
  changeOrderProcess: vi.fn(),
  startSetup: vi.fn(),
  finishSetup: vi.fn(),
  getPauseReasons: vi.fn(),
  getProcessLabel: vi.fn(),
  getProductFinishedLabel: vi.fn(),
  getApprovedProcessQuantities: vi.fn(),
  getPrintLayout: vi.fn(),
  getPalletization: vi.fn(),
  startPause: vi.fn(),
  submitRpnc: vi.fn(),
  finishPause: vi.fn(),
  finishProduction: vi.fn(),
}));

vi.mock("../firebirdProxy", () => proxy);

import { productionRouter } from "./production";

const ctx = {
  user: { id: 1, openId: "operador", role: "user" },
  localUser: { id: 1, login: "programador", name: "Programador", email: null, groupCode: 3, employeeCode: null, sectorCode: null, companyCode: null, permissions: ["PRODUCAO_STATUS_UPDATE"], operationalProfile: "programmer", machine: null },
  req: {},
  res: {},
} as never;

const operatorCtx = {
  ...ctx,
  localUser: {
    ...ctx.localUser,
    login: "operador",
    name: "Operador",
    groupCode: 1,
    operationalProfile: "operator",
    machine: { code: 14, description: "Máquina de teste", groupCode: 1, followsQueue: true, manualProcess: false },
  },
} as never;

describe("procedimentos de produção", () => {
  it("encaminha paginação e pesquisa da listagem de ordens ao proxy local", async () => {
    proxy.getOrders.mockResolvedValue({ items: [], total: 0, page: 2, limit: 20 });
    const caller = productionRouter.createCaller(ctx);

    await expect(caller.orders.list({ page: 2, limit: 20, search: "OP 210" })).resolves.toMatchObject({ total: 0 });
    expect(proxy.getOrders).toHaveBeenCalledWith(2, 20, "OP 210");
  });

  it("encaminha somente status permitidos para a ordem identificada", async () => {
    proxy.updateOrderStatus.mockResolvedValue({ success: true });
    const caller = productionRouter.createCaller(ctx);

    await expect(caller.orders.updateStatus({ opCodigo: 21, mpCodigo: 8, fila: 2, status: "Em Produção" })).resolves.toEqual({ success: true });
    expect(proxy.updateOrderStatus).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, fila: 2, status: "Em Produção" });
  });

  it("rejeita status fora da terminologia operacional definida", async () => {
    const caller = productionRouter.createCaller(ctx);
    await expect(caller.orders.updateStatus({ opCodigo: 21, mpCodigo: 8, status: "Cancelada" } as never)).rejects.toThrow();
  });

  it("propaga a indisponibilidade do proxy local para a camada protegida", async () => {
    proxy.getProducts.mockRejectedValueOnce(new Error("Firebird indisponível"));
    const caller = productionRouter.createCaller(ctx);

    await expect(caller.products.list({ page: 1, limit: 20, search: "" })).rejects.toThrow("Firebird indisponível");
  });

  it("filtra a programação pela máquina vinculada ao operador", async () => {
    proxy.getProgramming.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const caller = productionRouter.createCaller(operatorCtx);

    await expect(caller.programming.list({ page: 1, limit: 20, search: "" })).resolves.toMatchObject({ total: 0 });
    expect(proxy.getProgramming).toHaveBeenCalledWith(14, 1, 20, "", true, "Todos");
  });

  it("encaminha o filtro manual do Apontador sem impor a fila padrão do Operador", async () => {
    proxy.getProgramming.mockResolvedValue({ items: [], total: 0, page: 1, limit: 7 });
    const caller = productionRouter.createCaller({
      ...operatorCtx,
      localUser: { ...operatorCtx.localUser, operationalProfile: "manual-pointing" },
    });

    await expect(caller.programming.list({ page: 1, limit: 7, search: "", status: "Liberado/Parcial/Em Produção" })).resolves.toMatchObject({ total: 0 });
    expect(proxy.getProgramming).toHaveBeenCalledWith(14, 1, 7, "", false, "Liberado/Parcial/Em Produção");
  });

  it("permite que Programador sem MQP_LOGON selecione uma máquina controlada", async () => {
    proxy.getControlledMachines.mockResolvedValue([{ code: 21, description: "Impressora de teste", manualProcess: null }]);
    proxy.getProgramming.mockResolvedValue({ items: [], total: 0, page: 1, limit: 7 });
    const caller = productionRouter.createCaller(ctx);

    await expect(caller.programming.machines()).resolves.toEqual([{ code: 21, description: "Impressora de teste", manualProcess: null }]);
    await expect(caller.programming.list({ page: 1, limit: 7, search: "", machineCode: 21, status: "Liberado" })).resolves.toMatchObject({ total: 0 });
    expect(proxy.getProgramming).toHaveBeenCalledWith(21, 1, 7, "", false, "Liberado");
  });

  it("encaminha o início de setup com operador e máquina da sessão", async () => {
    proxy.startSetup.mockResolvedValue({ success: true, state: "SI" });
    const caller = productionRouter.createCaller(operatorCtx);

    await expect(caller.pointing.startSetup({ opCodigo: 21, mpCodigo: 8 })).resolves.toEqual({ success: true, state: "SI" });
    expect(proxy.startSetup).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, operatorId: 1, machineCode: 14 });
  });

  it("impede que o perfil de programador inicie um setup", async () => {
    const caller = productionRouter.createCaller(ctx);
    await expect(caller.pointing.startSetup({ opCodigo: 21, mpCodigo: 8 })).rejects.toThrow("operadores");
  });

  it("permite que o Programador consulte dados da OP sem máquina vinculada à sessão", async () => {
    proxy.getProcessLabel.mockResolvedValue({ opCode: 21 });
    proxy.getApprovedProcessQuantities.mockResolvedValue({ items: [] });
    proxy.getPrintLayout.mockResolvedValue({ colors: [] });
    proxy.getPalletization.mockResolvedValue({ packageType: "Pacote" });
    const caller = productionRouter.createCaller(ctx);

    await expect(caller.pointing.processLabel({ opCodigo: 21, mpCodigo: 8 })).resolves.toMatchObject({ opCode: 21 });
    await expect(caller.pointing.approvedQuantities({ opCodigo: 21, mpCodigo: 8 })).resolves.toMatchObject({ items: [] });
    await expect(caller.pointing.printLayout({ opCodigo: 21, mpCodigo: 8 })).resolves.toMatchObject({ colors: [] });
    await expect(caller.pointing.palletization({ opCodigo: 21, mpCodigo: 8 })).resolves.toMatchObject({ packageType: "Pacote" });
    expect(proxy.getProcessLabel).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, companyCode: null });
    expect(proxy.getApprovedProcessQuantities).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8 });
    expect(proxy.getPrintLayout).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8 });
    expect(proxy.getPalletization).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8 });
  });

  it("consulta a Etiqueta de Produto Acabado com a empresa da sessão local", async () => {
    proxy.getProductFinishedLabel.mockResolvedValue({ operationCode: 21, stockQuantity: 600, quantityPerPallet: 300 });
    const caller = productionRouter.createCaller({ ...ctx, localUser: { ...ctx.localUser, companyCode: 4 } });

    await expect(caller.pointing.productFinishedLabel({ opCodigo: 21, mpCodigo: 8 })).resolves.toMatchObject({ operationCode: 21, stockQuantity: 600 });
    expect(proxy.getProductFinishedLabel).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, companyCode: 4 });
  });

  it("encaminha a finalização de setup com o resultado escolhido pelo operador", async () => {
    proxy.finishSetup.mockResolvedValue({ success: true, state: "PI" });
    const caller = productionRouter.createCaller(operatorCtx);
    await expect(caller.pointing.finishSetup({ opCodigo: 21, mpCodigo: 8, outcome: "attended" })).resolves.toEqual({ success: true, state: "PI" });
    expect(proxy.finishSetup).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, machineCode: 14, outcome: "attended" });
  });

  it("encaminha o motivo e a identificação do operador ao iniciar uma parada", async () => {
    proxy.startPause.mockResolvedValue({ success: true });
    const caller = productionRouter.createCaller(operatorCtx);
    await expect(caller.pointing.startPause({ opCodigo: 21, mpCodigo: 8, reasonCode: 7 })).resolves.toEqual({ success: true });
    expect(proxy.startPause).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, reasonCode: 7, operatorId: 1, machineCode: 14 });
  });

  it("encaminha quantidades e rastreio para finalizar a produção", async () => {
    proxy.finishProduction.mockResolvedValue({ success: true, status: "Atendido", balance: 0, reservation: 120, allocated: 120 });
    const caller = productionRouter.createCaller(operatorCtx);
    await expect(caller.pointing.finishProduction({ opCodigo: 21, mpCodigo: 8, quantityProduced: 120, quantityLost: 5, outcome: "attended", observation: "", lotTrace: "L-01" })).resolves.toEqual({ success: true, status: "Atendido", balance: 0, reservation: 120, allocated: 120 });
    expect(proxy.finishProduction).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, machineCode: 14, operatorId: 1, quantityProduced: 120, quantityLost: 5, quantityPeople: 0, productionDate: "", outcome: "attended", observation: "", lotTrace: "L-01" });
  });

  it("consulta o checklist RPNC pela origem e máquina vinculada ao operador", async () => {
    proxy.getRpncChecklist.mockResolvedValue({ origin: "product", checklists: [] });
    const caller = productionRouter.createCaller(operatorCtx);

    await expect(caller.pointing.rpncChecklist({ opCodigo: 21, mpCodigo: 8, origin: "product" })).resolves.toMatchObject({ origin: "product" });
    expect(proxy.getRpncChecklist).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, origin: "product", machineCode: 14 });
  });

  it("encaminha somente itens não conformes validados para a gravação de RPNC", async () => {
    proxy.submitRpnc.mockResolvedValue({ success: true, rpncCode: 18, year: 2026, nonconformityCount: 1, totalQuantity: 1000 });
    const caller = productionRouter.createCaller(operatorCtx);
    const input = { opCodigo: 21, mpCodigo: 8, origin: "product" as const, checklists: [{ checklistCode: 5, items: [{ itemCode: 11, quantity: 1000, causeCodes: [7], containmentAction: "Separar lote" }] }] };

    await expect(caller.pointing.submitRpnc(input)).resolves.toMatchObject({ success: true, rpncCode: 18 });
    expect(proxy.submitRpnc).toHaveBeenCalledWith({ opCodigo: 21, mpCodigo: 8, machineCode: 14, userId: 1, employeeCode: 1, submission: { origin: "product", transitionToGeneralSampling: false, checklists: input.checklists } });
  });
});
