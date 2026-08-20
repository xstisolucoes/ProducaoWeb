import "dotenv/config";

export type FirebirdProxyHealth = {
  status: "ok";
  database: "reachable";
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ProductionDashboard = {
  total: number;
  emProducao: number;
  liberado: number;
  parcial: number;
  atendido: number;
};

export type ProductionOrder = {
  op_codigo: number;
  mp_codigo: number;
  fila: number | null;
  status: string | null;
  data: string | null;
  data_entrega: string | null;
  saldo: number | null;
  quantidade_produzida: number | null;
  quantidade_perdida: number | null;
  referencia: string | null;
  processo: string | null;
  produto_referencia: string | null;
};

export type Product = {
  codigo: number;
  revisao: number | null;
  referencia: string | null;
  codigo_cliente: string | null;
  largura: number | null;
  comprimento: number | null;
  altura: number | null;
  fechamento: string | null;
  impressao: string | null;
};

export type StockBalance = {
  produto_codigo: number;
  codigo_estoque: number;
  saldo_1: number | null;
  saldo_2: number | null;
  referencia: string | null;
  cliente: string | null;
};

export type StockMovement = {
  codigo: number;
  produto_codigo: number;
  revisao: number | null;
  ordem_producao: number | null;
  quantidade: number | null;
  saldo: number | null;
  data_producao: string | null;
  lote: string | null;
};

export type LocalOperator = {
  id: number;
  login: string;
  name: string;
  email: string | null;
  groupCode: number | null;
  groupDescription: string | null;
  employeeCode: number | null;
  sectorCode: number | null;
  companyCode: number | null;
  permissions: string[];
  operationalProfile: "operator" | "programmer" | "manual-pointing" | "manual-production" | "quality-release";
  canConfigureStation: boolean;
  machine: ProductionMachine | null;
};

export type ProductionMachine = {
  code: number;
  description: string;
  groupCode: number | null;
  groupDescription: string | null;
  followsQueue: boolean;
  manualProcess: boolean;
};

export type LoginStation = ProductionMachine;

export type ProcessOption = Pick<ProductionMachine, "code" | "description" | "groupCode">;
export type ActiveProductionRecovery = {
  opCodigo: number;
  mpCodigo: number;
  status: string | null;
  queue: number | null;
  reference: string | null;
  machineDescription: string | null;
};
export type PauseReason = { code: number; description: string };
export type InspectionChecklistItem = { code: number; description: string };
export type ProcessInspectionChecklist = { intervalMinutes: number; items: InspectionChecklistItem[] };
export type ProcessLabel = {
  operationCode: number;
  productCode: number;
  revision: number;
  customerName: string | null;
  orderedQuantity: number | null;
  reference: string | null;
  currentProcess: string | null;
  nextProcess: string | null;
  operatorName: string | null;
  jointPosition: string | null;
  resin: string | null;
  companyName: string | null;
  companyLogoDataUri: string | null;
  companyLogoError: string | null;
  printerOptions: string[];
};
export type ProductFinishedLabel = {
  stockCode: number;
  operationCode: number;
  productCode: number;
  revision: number;
  customerLegalName: string | null;
  customerName: string | null;
  reference: string | null;
  stockQuantity: number;
  lot: string | null;
  manufacturingDate: string | null;
  internalMeasures: string | null;
  quantityPerPallet: number | null;
  companyName: string | null;
  companyLogoDataUri: string | null;
  companyLogoError: string | null;
  printerOptions: string[];
};
export type LocalPrinter = { name: string; isDefault: boolean; offline: boolean };
export type LocalCompany = { code: number; fantasyName: string | null; legalName: string | null };
export type RawMaterialTraceItem = { structureCode: number; productCode: number; productName: string; lot: string | null; requiresValidity: boolean };
export type ProductionReservation = { applicable: boolean; groupLabel: string | null; quantity: number; balance: number; arrangementLength: number; arrangementColumns: number; arrangementTotal: number; indicatorLabel: string | null; indicatorQuantity: number | null; previousProcessDescription: string | null };
export type PrintLayoutColor = { order: number; description: string; hexWhite: string | null; hexKraft: string | null };
export type PrintLayout = { productCode: number; revision: number; svgDataUri: string | null; layoutAvailable: boolean; layoutError: string | null; loosePlate: string | null; cliches: { code: number; series: string }[]; facas: { code: number }[]; colors: PrintLayoutColor[] };
export type PalletizationPlan = {
  registered: boolean;
  customerSpecific: boolean;
  packageType: string | null;
  packageWidth: number | null;
  packageLength: number | null;
  packageHeight: number | null;
  packageQuantity: number | null;
  packageWeight: number | null;
  packageStrapsWidth: number | null;
  packageStrapsLength: number | null;
  palletized: boolean;
  remounted: boolean;
  palletDescription: string | null;
  palletLength: number | null;
  palletWidth: number | null;
  palletHeight: number | null;
  layerDescription: string | null;
  packagesPerLayer: number | null;
  packagesHigh: number | null;
  maximumHeight: number | null;
  totalPackages: number | null;
  totalProducts: number | null;
  areaUse: number | null;
  areaPercent: number | null;
  arched: boolean;
  mirrored: boolean;
  cornerProtector: boolean;
  stretchFilm: boolean;
  palletStrapsWidth: number | null;
  palletStrapsLength: number | null;
  labelWidth: number | null;
  labelLength: number | null;
  observation: string | null;
  palletImageDataUri: string | null;
  palletImageError: string | null;
  layerImageDataUri: string | null;
  layerImageError: string | null;
  imageDataUri: string | null;
  imageError: string | null;
};

export type RpncOrigin = "product" | "raw-material";
export type RpncCause = { code: number; description: string; status: string | null };
export type RpncChecklistItem = { code: number; checklistCode: number; description: string; definition: string | null; documentPath: string | null; status: string | null; causes: RpncCause[] };
export type RpncChecklist = { code: number; description: string; fullDescription: string | null; status: string | null; inspectionType: string | null; items: RpncChecklistItem[] };
export type RpncChecklistData = { origin: RpncOrigin; originLabel: string; inspectionType: string; lot: string | null; supplierCode: number | null; checklists: RpncChecklist[] };
export type RpncSubmission = { origin: RpncOrigin; transitionToGeneralSampling?: boolean; checklists: { checklistCode: number; items: { itemCode: number; quantity: number; causeCodes: number[]; containmentAction: string }[] }[] };

export type ProgrammingOrder = ProductionOrder & {
  machineCode: number;
  productCode: number | null;
  client: string | null;
  customerProductCode: string | null;
  revision: number | null;
  quantity: number | null;
  shipmentDate: string | null;
  queuePosition: string | null;
  processPosition: string | null;
  processSituation: string | null;
  requestStatus: string | null;
  reservedStatus: string | null;
  adjustmentWidth: string | null;
  adjustmentLength: string | null;
  adjustmentWidthTotal: string | null;
  adjustmentLengthTotal: string | null;
  master_order: number | null;
};
export type ControlledMachine = { code: number; description: string; manualProcess: string | null };
export type EligibleProcessMachine = { code: number; description: string };

export type QueueOrder = {
  queue: number | null;
  opCode: number;
  mpCode: number;
  productCode: number | null;
  revision: number | null;
  reference: string | null;
  customer: string | null;
  quantity: number | null;
  shipmentDate: string | null;
  deliveryDate: string | null;
  status: string | null;
  reservationStatus: string | null;
  reservationRequestStatus: string | null;
  machineDescription: string | null;
  adjustmentWidth: string | null;
  adjustmentLength: string | null;
  colorCount: number;
  layoutPath: string | null;
  masterOrder: number | null;
};

export type QueueReservation = {
  product: string | null;
  lot: string | null;
  measures: string | null;
  arrangement: string | null;
  boardType: string | null;
  composition: string | null;
  quantity: number | null;
  balance: number | null;
};

export type QueueProcess = {
  machineCode: number;
  machineDescription: string;
  status: string | null;
  queue: number | null;
  opCode: number;
  mpCode: number;
};

export type RequestSector = { code: number; description: string; areaCode: number | null };
export type ApprovedProcessQuantity = { processGroup: number | null; arrangement: string | null; approvedQuantity: number | null; status: string | null };
export type ProductReleaseSamplingPlan = { lotSize: number; sampleSize: number | null; acceptableLimit: number | null; nonConformingLimit: number | null; planCode: number | null; stage: "1º Amostragem" | "Amostragem Geral" };

export type PointingOrder = ProgrammingOrder & {
  productCode: number | null;
  machineDescription: string;
  machineGroup: string | null;
  productionDate: string | null;
  previousProcessBalance: number | null;
  previousProcessName: string | null;
  clientLegalName: string | null;
  clientFantasy: string | null;
  internalComposition: string | null;
  corrugatedBoard: string | null;
  waveDirection: string | null;
  closing: string | null;
  lapClosing: string | null;
  print: string | null;
  colorCount: number | null;
  stapleQuantity: number | null;
  setupStartedAt: string | null;
  setupFinishedAt: string | null;
  processStartedAt: string | null;
  processFinishedAt: string | null;
  activeSetupStartedAt: string | null;
  activeProcessStartedAt: string | null;
  cutSheetWidth: string | null;
  cutSheetLength: string | null;
  processProductionCode: number;
  productionArrangementTotal: number;
  calculateProductionArrangement: boolean;
  calculateReservationArrangement: boolean;
  activePause: boolean;
};

type ProxyEnvironment = {
  FIREBIRD_PROXY_URL?: string;
  FIREBIRD_PROXY_TOKEN?: string;
};

export function getFirebirdProxyConfiguration(env: ProxyEnvironment = process.env as ProxyEnvironment) {
  const rawUrl = env.FIREBIRD_PROXY_URL?.trim();
  const token = env.FIREBIRD_PROXY_TOKEN?.trim();
  if (!rawUrl) throw new Error("FIREBIRD_PROXY_URL não foi configurada.");
  if (!token) throw new Error("FIREBIRD_PROXY_TOKEN não foi configurada.");

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("FIREBIRD_PROXY_URL deve conter http:// ou https://.");
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("FIREBIRD_PROXY_URL deve usar http:// ou https://.");
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), token };
}

async function request<T>(path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const { baseUrl, token } = getFirebirdProxyConfiguration();
  const response = await fetcher(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const detail = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new Error(detail || `O proxy Firebird respondeu com HTTP ${response.status}.`);
  }
  return body as T;
}

export const firebirdProxyHealthCheck = () => request<FirebirdProxyHealth>("/health");
export const getLocalPrinters = () => request<{ printers: LocalPrinter[]; source: "windows" | "unsupported" }>("/v1/system/printers");
export const getLocalCompanies = () => request<LocalCompany[]>("/v1/companies");
export const getLoginStations = () => request<LoginStation[]>("/v1/stations");
export const loginLocalOperator = (login: string, password: string, machineCode: number | null = null) =>
  request<LocalOperator>("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password, machineCode }),
  });
export const getProductionDashboard = () => request<ProductionDashboard>("/v1/dashboard");
export const getOrders = (page: number, limit: number, search: string) =>
  request<PagedResult<ProductionOrder>>(`/v1/orders?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
export const updateOrderStatus = (input: { opCodigo: number; mpCodigo: number; status: string; fila?: number }) =>
  request<{ success: true }>(`/v1/orders/${input.opCodigo}/${input.mpCodigo}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const getProducts = (page: number, limit: number, search: string) =>
  request<PagedResult<Product>>(`/v1/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
export const getStock = (page: number, limit: number, search: string) =>
  request<PagedResult<StockBalance>>(`/v1/stock?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
export const getStockHistory = (page: number, limit: number) =>
  request<PagedResult<StockMovement>>(`/v1/stock/history?page=${page}&limit=${limit}`);
export const getProgramming = (machineCode: number, page: number, limit: number, search: string, operatorOnly = false, status = "Todos") =>
  request<PagedResult<ProgrammingOrder>>(`/v1/programming?machineCode=${machineCode}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&operatorOnly=${operatorOnly}&status=${encodeURIComponent(status)}`);
export const getControlledMachines = () => request<ControlledMachine[]>("/v1/programming/machines");
export const getCleaningReasons = (machineCode: number) => request<PauseReason[]>(`/v1/programming/cleaning-reasons?machineCode=${machineCode}`);
export const getActiveProduction = (machineCode: number) =>
  request<ActiveProductionRecovery | null>(`/v1/programming/active?machineCode=${machineCode}`);
export const getQueue = (machineCode: number, page: number, limit: number, search: string) =>
  request<PagedResult<QueueOrder>>(`/v1/queue?machineCode=${machineCode}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
export const getQueueReservations = (opCode: number) => request<QueueReservation[]>(`/v1/queue/${opCode}/reservations`);
export const getQueueProcesses = (opCode: number, masterOrder: number | null) =>
  request<QueueProcess[]>(`/v1/queue/${opCode}/processes?masterOrder=${masterOrder ?? 0}`);
export const getRequestSectors = () => request<RequestSector[]>("/v1/requests/sectors");
export const createRequest = (input: { type: "maintenance" | "development"; requesterId: number; requesterSectorCode: number | null; machineCode: number | null; description: string }) =>
  request<{ success: true; code: number; status: string }>("/v1/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const getApprovedProcessQuantities = (input: { opCodigo: number; mpCodigo: number }) =>
  request<ApprovedProcessQuantity[]>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/approved-quantities`);
export const getPointingOrder = (opCodigo: number, mpCodigo: number, machineCode: number) =>
  request<PointingOrder>(`/v1/pointing/${opCodigo}/${mpCodigo}?machineCode=${machineCode}`);
export const getProductReleaseSamplingPlan = (input: { opCodigo: number; mpCodigo: number; machineCode: number }) =>
  request<ProductReleaseSamplingPlan>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/product-release-plan?machineCode=${input.machineCode}`);
export const finishProductRelease = (input: { opCodigo: number; mpCodigo: number; machineCode: number; operatorId: number; outcome: "attended" | "partial"; conformity: "Conforme" | "Não Conforme"; stage: "1º Amostragem" | "Amostragem Geral"; lotSize: number; quantityLost: number; quantityReworked: number }) =>
  request<{ success: true; status: string; conformity: string; stage: string; producedQuantity: number }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/product-release`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const getProcessLabel = (input: { opCodigo: number; mpCodigo: number; companyCode: number | null }) =>
  request<ProcessLabel>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/process-label?companyCode=${input.companyCode ?? ""}`);
export const printProcessLabelPdf = (input: { printer: string; copies: number; pdfBase64: string }) =>
  request<{ success: true }>("/v1/process-label/print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const getProductFinishedLabel = (input: { opCodigo: number; mpCodigo: number; companyCode: number | null }) =>
  request<ProductFinishedLabel>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/product-finished-label?companyCode=${input.companyCode ?? ""}`);
export const printProductFinishedLabelPdf = (input: { printer: string; copies: number; pdfBase64: string }) =>
  request<{ success: true }>("/v1/product-finished-label/print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const getPrintLayout = (input: { opCodigo: number; mpCodigo: number }) =>
  request<PrintLayout>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/print-layout`);
export const getPalletization = (input: { opCodigo: number; mpCodigo: number }) =>
  request<PalletizationPlan>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/palletization`);
export const getRpncChecklist = (input: { opCodigo: number; mpCodigo: number; machineCode: number; origin: RpncOrigin }) =>
  request<RpncChecklistData>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/rpnc?machineCode=${input.machineCode}&origin=${input.origin}`);
export const submitRpnc = (input: { opCodigo: number; mpCodigo: number; machineCode: number; userId: number; employeeCode: number; submission: RpncSubmission }) =>
  request<{ success: true; rpncCode: number; year: number; nonconformityCount: number; totalQuantity: number; generalSampling?: boolean }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/rpnc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const startSetup = (input: { opCodigo: number; mpCodigo: number; operatorId: number; machineCode: number }) =>
  request<{ success: true; state: "SI" | "RESUMED" }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/start-setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const startManualPointing = (input: { opCodigo: number; mpCodigo: number; operatorId: number; machineCode: number }) =>
  request<{ success: true; resumed: boolean; startedAt?: string }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/start-manual`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const finishSetup = (input: { opCodigo: number; mpCodigo: number; machineCode: number; outcome: "attended" | "to_conclude" | "cancelled" }) =>
  request<{ success: true; state: "PI" | "SF" }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/finish-setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const getInspectionChecklist = (machineCode: number) => request<InspectionChecklistItem[]>(`/v1/pointing/inspection-checklist?machineCode=${machineCode}`);
export const completeInspectionChecklist = (input: { opCodigo: number; mpCodigo: number; machineCode: number; confirmedCodes: number[] }) =>
  request<{ success: true; state: "PI" }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/complete-inspection`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const getProcessInspectionChecklist = (machineCode: number) => request<ProcessInspectionChecklist>(`/v1/pointing/process-inspection-checklist?machineCode=${machineCode}`);
export const completeProcessInspection = (input: { opCodigo: number; mpCodigo: number; machineCode: number; confirmedCodes: number[] }) =>
  request<{ success: true; recordedAt: string; intervalMinutes: number }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/complete-process-inspection`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const getPauseReasons = (machineCode: number) => request<PauseReason[]>(`/v1/pointing/pause-reasons?machineCode=${machineCode}`);
export const getRawMaterialTrace = (input: { opCodigo: number; mpCodigo: number; machineCode: number }) =>
  request<RawMaterialTraceItem[]>(`/v1/order-structure/${input.opCodigo}/raw-materials?mpCodigo=${input.mpCodigo}&machineCode=${input.machineCode}`);
export const getProductionReservation = (input: { opCodigo: number; mpCodigo: number; machineCode: number }) =>
  request<ProductionReservation>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/reservation?machineCode=${input.machineCode}`);
export const validateRawMaterialLot = (input: { opCodigo: number; structureCode: number; lot: string }) =>
  request<{ success: true; lot: string }>(`/v1/order-structure/${input.opCodigo}/${input.structureCode}/validate-lot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const startPause = (input: { opCodigo: number; mpCodigo: number; machineCode: number; operatorId: number; reasonCode: number }) =>
  request<{ success: true }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/pause/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const finishPause = (input: { opCodigo: number; mpCodigo: number; machineCode: number }) =>
  request<{ success: true }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/pause/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const finishProduction = (input: { opCodigo: number; mpCodigo: number; machineCode: number; operatorId: number; quantityProduced: number; quantityLost: number; quantityPeople: number; productionDate: string; outcome: "attended" | "to_conclude" | "partial"; observation: string; lotTrace: string }) =>
  request<{ success: true; status: string; balance: number; reservation: number; allocated: number; processProductionCode: number; arrangementTotal: number; calculateProductionArrangement: boolean; calculateReservationArrangement: boolean; enteredQuantity: number; productionMultiplier: number; productionQuantity: number; reservationMultiplier: number; reservationQuantity: number }>(`/v1/pointing/${input.opCodigo}/${input.mpCodigo}/finish-production`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
export const getProcessOptions = () => request<ProcessOption[]>("/v1/programming/processes");
export const getEligibleProcessMachines = (input: { opCodigo: number; mpCodigo: number }) =>
  request<EligibleProcessMachine[]>(`/v1/programming/${input.opCodigo}/${input.mpCodigo}/eligible-machines`);
export const changeOrderProcess = (input: { opCodigo: number; mpCodigo: number; machineCode: number }) =>
  request<{ success: true; queue: number }>(`/v1/programming/${input.opCodigo}/${input.mpCodigo}/process`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
export const changeOrderQueue = (input: { opCodigo: number; mpCodigo: number; machineCode: number; queue: number }) =>
  request<{ success: true; queue: number; status: string; releasedFromQueue2000: boolean }>(`/v1/programming/${input.opCodigo}/${input.mpCodigo}/queue`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
