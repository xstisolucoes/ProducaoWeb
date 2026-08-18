import { z } from "zod";
import {
  firebirdProxyHealthCheck,
  getActiveProduction,
  getControlledMachines,
  getOrders,
  getPointingOrder,
  getProcessLabel,
  getPrintLayout,
  getPalletization,
  getRpncChecklist,
  getProcessOptions,
  getEligibleProcessMachines,
  getPauseReasons,
  getInspectionChecklist,
  getProcessInspectionChecklist,
  getRawMaterialTrace,
  getProductionReservation,
  completeInspectionChecklist,
  completeProcessInspection,
  finishSetup,
  finishPause,
  finishProduction,
  getProducts,
  getProductionDashboard,
  getLocalPrinters,
  getProgramming,
  getCleaningReasons,
  getQueue,
  getQueueProcesses,
  getQueueReservations,
  getRequestSectors,
  createRequest,
  getApprovedProcessQuantities,
  getStock,
  getStockHistory,
  changeOrderProcess,
  changeOrderQueue,
  startSetup,
  startManualPointing,
  startPause,
  submitRpnc,
  updateOrderStatus,
  validateRawMaterialLot,
} from "../firebirdProxy";
import { localProtectedProcedure, operatorProcedure, programmerProcedure, router } from "../_core/trpc";

const pageInput = z.object({
  page: z.number().int().min(1).max(100000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
});
const programmingInput = pageInput.extend({
  machineCode: z.number().int().positive().optional(),
  status: z.string().trim().max(60).default("Todos"),
});

const processInput = z.object({
  opCodigo: z.number().int().positive(),
  mpCodigo: z.number().int().positive(),
});

export const productionRouter = router({
  health: localProtectedProcedure.query(() => firebirdProxyHealthCheck()),
  printers: router({
    list: localProtectedProcedure.query(() => getLocalPrinters()),
  }),
  dashboard: localProtectedProcedure.query(() => getProductionDashboard()),
  orders: router({
    list: localProtectedProcedure.input(pageInput).query(({ input }) => getOrders(input.page, input.limit, input.search)),
    updateStatus: programmerProcedure
      .input(processInput.extend({
        fila: z.number().int().positive().optional(),
        status: z.enum(["Liberado", "Em Produção", "Parcial", "Atendido", "Parado"]),
      }))
      .mutation(({ input }) => updateOrderStatus(input)),
  }),
  programming: router({
    list: localProtectedProcedure.input(programmingInput).query(({ ctx, input }) => {
      const manualPointing = ctx.localUser.operationalProfile === "manual-pointing";
      const operatorOnly = ctx.localUser.operationalProfile === "operator";
      const machineCode = operatorOnly || manualPointing ? ctx.localUser.machine?.code : (input.machineCode ?? ctx.localUser.machine?.code);
      if (!machineCode) throw new Error(operatorOnly || manualPointing ? "Nenhuma máquina foi vinculada a este operador." : "Selecione uma máquina controlada.");
      return getProgramming(machineCode, input.page, input.limit, input.search, operatorOnly, manualPointing ? input.status : operatorOnly ? "Todos" : input.status);
    }),
    machines: programmerProcedure.query(() => getControlledMachines()),
    active: operatorProcedure.query(({ ctx }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getActiveProduction(ctx.localUser.machine.code);
    }),
    cleaningReasons: operatorProcedure.query(({ ctx }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getCleaningReasons(ctx.localUser.machine.code);
    }),
    processes: programmerProcedure.query(() => getProcessOptions()),
    eligibleMachines: programmerProcedure.input(processInput).query(({ input }) => getEligibleProcessMachines(input)),
    changeProcess: programmerProcedure.input(processInput.extend({ machineCode: z.number().int().positive() })).mutation(({ input }) => changeOrderProcess(input)),
    changeQueue: programmerProcedure.input(processInput.extend({ machineCode: z.number().int().positive(), queue: z.number().int().positive() })).mutation(({ input }) => changeOrderQueue(input)),
  }),
  queue: router({
    list: localProtectedProcedure.input(pageInput).query(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getQueue(ctx.localUser.machine.code, input.page, input.limit, input.search);
    }),
    reservations: localProtectedProcedure.input(z.object({ opCode: z.number().int().positive() })).query(({ input }) => getQueueReservations(input.opCode)),
    processes: localProtectedProcedure.input(z.object({ opCode: z.number().int().positive(), masterOrder: z.number().int().nonnegative().nullable() })).query(({ input }) => getQueueProcesses(input.opCode, input.masterOrder)),
  }),
  requests: router({
    sectors: localProtectedProcedure.query(() => getRequestSectors()),
    create: localProtectedProcedure.input(z.object({ type: z.enum(["maintenance", "development"]), description: z.string().trim().min(3).max(300) })).mutation(({ ctx, input }) =>
      createRequest({ type: input.type, requesterId: ctx.localUser.id, requesterSectorCode: ctx.localUser.sectorCode, machineCode: ctx.localUser.machine?.code ?? null, description: input.description })),
  }),
  pointing: router({
    get: operatorProcedure.input(processInput).query(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getPointingOrder(input.opCodigo, input.mpCodigo, ctx.localUser.machine.code);
    }),
    processLabel: localProtectedProcedure.input(processInput).query(({ ctx, input }) => {
      return getProcessLabel({ ...input, companyCode: ctx.localUser.companyCode });
    }),
    approvedQuantities: localProtectedProcedure.input(processInput).query(({ ctx, input }) => {
      return getApprovedProcessQuantities(input);
    }),
    printLayout: localProtectedProcedure.input(processInput).query(({ ctx, input }) => {
      return getPrintLayout(input);
    }),
    palletization: localProtectedProcedure.input(processInput).query(({ ctx, input }) => {
      return getPalletization(input);
    }),
    rpncChecklist: operatorProcedure.input(processInput.extend({ origin: z.enum(["product", "raw-material"]) })).query(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getRpncChecklist({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    submitRpnc: operatorProcedure.input(processInput.extend({
      origin: z.enum(["product", "raw-material"]),
      checklists: z.array(z.object({
        checklistCode: z.number().int().positive(),
        items: z.array(z.object({
          itemCode: z.number().int().positive(),
          quantity: z.number().int().positive(),
          causeCodes: z.array(z.number().int().positive()).max(100).default([]),
          containmentAction: z.string().trim().max(1000).default(""),
        })).min(1).max(100),
      })).min(1).max(100),
    })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return submitRpnc({
        opCodigo: input.opCodigo,
        mpCodigo: input.mpCodigo,
        machineCode: ctx.localUser.machine.code,
        userId: ctx.localUser.id,
        employeeCode: ctx.localUser.employeeCode ?? ctx.localUser.id,
        submission: { origin: input.origin, checklists: input.checklists },
      });
    }),
    startSetup: operatorProcedure.input(processInput).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return startSetup({ ...input, operatorId: ctx.localUser.id, machineCode: ctx.localUser.machine.code });
    }),
    startManual: operatorProcedure.input(processInput).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      if (ctx.localUser.operationalProfile !== "manual-pointing") throw new Error("Ação disponível apenas para o grupo Apontamento.");
      return startManualPointing({ ...input, operatorId: ctx.localUser.id, machineCode: ctx.localUser.machine.code });
    }),
    finishSetup: operatorProcedure.input(processInput.extend({ outcome: z.enum(["attended", "to_conclude", "cancelled"]) })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return finishSetup({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    inspectionChecklist: operatorProcedure.query(({ ctx }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getInspectionChecklist(ctx.localUser.machine.code);
    }),
    completeInspection: operatorProcedure.input(processInput.extend({ confirmedCodes: z.array(z.number().int().positive()).max(100) })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return completeInspectionChecklist({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    processInspectionChecklist: operatorProcedure.query(({ ctx }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getProcessInspectionChecklist(ctx.localUser.machine.code);
    }),
    completeProcessInspection: operatorProcedure.input(processInput.extend({ confirmedCodes: z.array(z.number().int().positive()).min(1).max(100) })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return completeProcessInspection({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    rawMaterials: operatorProcedure.input(processInput).query(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getRawMaterialTrace({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    validateLot: operatorProcedure.input(z.object({ opCodigo: z.number().int().positive(), structureCode: z.number().int().positive(), lot: z.string().trim().min(3).max(80) })).mutation(({ input }) => validateRawMaterialLot(input)),
    pauseReasons: operatorProcedure.query(({ ctx }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getPauseReasons(ctx.localUser.machine.code);
    }),
    startPause: operatorProcedure.input(processInput.extend({ reasonCode: z.number().int().positive() })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return startPause({ ...input, operatorId: ctx.localUser.id, machineCode: ctx.localUser.machine.code });
    }),
    finishPause: operatorProcedure.input(processInput).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return finishPause({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    reservation: operatorProcedure.input(processInput).query(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      return getProductionReservation({ ...input, machineCode: ctx.localUser.machine.code });
    }),
    finishProduction: operatorProcedure.input(processInput.extend({ quantityProduced: z.number().int().positive(), quantityLost: z.number().int().min(0), outcome: z.enum(["attended", "to_conclude", "partial"]), observation: z.string().max(500).default(""), lotTrace: z.string().max(500).default("") })).mutation(({ ctx, input }) => {
      if (!ctx.localUser.machine) throw new Error("Nenhuma máquina foi vinculada a este operador.");
      if (input.quantityLost > input.quantityProduced) throw new Error("A perda não pode ser maior que a quantidade produzida.");
      return finishProduction({ ...input, machineCode: ctx.localUser.machine.code, operatorId: ctx.localUser.employeeCode ?? ctx.localUser.id });
    }),
  }),
  products: router({
    list: localProtectedProcedure.input(pageInput).query(({ input }) => getProducts(input.page, input.limit, input.search)),
  }),
  stock: router({
    list: localProtectedProcedure.input(pageInput).query(({ input }) => getStock(input.page, input.limit, input.search)),
    history: localProtectedProcedure.input(pageInput.pick({ page: true, limit: true })).query(({ input }) => getStockHistory(input.page, input.limit)),
  }),
});
