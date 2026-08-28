import "dotenv/config";
import express from "express";
import Firebird from "node-firebird";
import bcrypt from "bcryptjs";
import os from "node:os";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { reservePolicy, selectApplicableReservations } from "./reservationPolicy.mjs";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
};

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`Valor inválido para ${name}`);
  return value;
};

const proxyToken = required("FIREBIRD_PROXY_TOKEN");
const proxyHost = process.env.FIREBIRD_PROXY_HOST?.trim() || "127.0.0.1";
const proxyPort = numberFromEnv("FIREBIRD_PROXY_PORT", 8787);
const firebirdEncoding = process.env.FIREBIRD_ENCODING?.trim() || "WIN1252";
const proxyBuild = "2026-08-20-product-label-v1";
const processInspectionIntervalMinutes = numberFromEnv("PRODUCTION_PROCESS_INSPECTION_INTERVAL_MINUTES", 20);
const processInspectionTimestampSql = "substring(cast(current_timestamp as varchar(24)) from 9 for 2) || '/' || substring(cast(current_timestamp as varchar(24)) from 6 for 2) || '/' || substring(cast(current_timestamp as varchar(24)) from 1 for 4) || ' - ' || substring(cast(current_timestamp as varchar(24)) from 12 for 8)";
const processLabelPrinters = String(process.env.PRODUCTION_LABEL_PRINTERS ?? "").split(/[;,]/).map((printer) => printer.trim()).filter(Boolean);
const execFileAsync = promisify(execFile);

async function printPdfDirectly(pdfBuffer, printer, copies) {
  if (process.platform !== "win32") throw new Error("A impressão direta está disponível somente no proxy instalado no Windows.");
  const module = await import("pdf-to-printer");
  const print = module.print ?? module.default?.print ?? module.default;
  if (typeof print !== "function") throw new Error("Não foi encontrada a função de impressão do conector Windows.");
  const temporaryPath = path.join(tmpdir(), `xpaper-etiqueta-${randomUUID()}.pdf`);
  await writeFile(temporaryPath, pdfBuffer);
  try { await print(temporaryPath, { printer, copies, silent: true, scale: "noscale" }); }
  finally { await unlink(temporaryPath).catch(() => undefined); }
}

const pool = Firebird.pool(5, {
  host: required("FIREBIRD_HOST"),
  port: numberFromEnv("FIREBIRD_PORT", 3050),
  database: required("FIREBIRD_DATABASE"),
  user: required("FIREBIRD_USER"),
  password: required("FIREBIRD_PASSWORD"),
  lowercase_keys: true,
  encoding: firebirdEncoding,
  connectTimeout: 5000,
  wireCrypt: Firebird.WIRE_CRYPT_ENABLE,
  idleTimeoutMillis: 30000,
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));

function ensureAuthorized(req, res, next) {
  const authorization = req.get("authorization");
  if (authorization !== `Bearer ${proxyToken}`) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  return next();
}

function pageValue(value, fallback, max) {
  const numeric = Number(value ?? fallback);
  return Number.isInteger(numeric) ? Math.max(1, Math.min(numeric, max)) : fallback;
}

function listPage(req) {
  const limit = pageValue(req.query.limit, 20, 100);
  const page = pageValue(req.query.page, 1, 100000);
  return { limit, offset: (page - 1) * limit };
}

async function query(sql, params = []) {
  return pool.withConnection((db) => db.queryAsync(sql, params));
}

async function getWindowsPrinters() {
  if (process.platform !== "win32") return [];
  const command = "Get-CimInstance -ClassName Win32_Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 6000, maxBuffer: 512 * 1024 });
  const result = JSON.parse(stdout || "[]");
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  return rows.map((printer) => ({ name: String(printer.Name ?? "").trim(), isDefault: Boolean(printer.Default), offline: Boolean(printer.WorkOffline) })).filter((printer) => printer.name);
}

const imageMimeTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
async function readLocalImageDataUri(imagePath, label) {
  if (!imagePath) return { dataUri: null, error: null };
  const extension = path.extname(imagePath).toLowerCase();
  if (!imageMimeTypes[extension]) return { dataUri: null, error: `A imagem cadastrada para ${label} deve ser JPG, PNG ou SVG.` };
  try { const image = await readFile(imagePath); return { dataUri: `data:${imageMimeTypes[extension]};base64,${image.toString("base64")}`, error: null }; }
  catch { return { dataUri: null, error: `Não foi possível abrir a imagem de ${label} no caminho cadastrado.` }; }
}

function imageMimeFromBuffer(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return "image/png";
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) return "image/jpeg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.length >= 2 && buffer.subarray(0, 2).equals(Buffer.from([0x42, 0x4D]))) return "image/bmp";
  return null;
}

async function readBlobImageDataUri(blob, label) {
  if (!blob) return { dataUri: null, error: null };
  const toDataUri = (buffer) => {
    const mime = imageMimeFromBuffer(buffer);
    return mime ? { dataUri: `data:${mime};base64,${buffer.toString("base64")}`, error: null } : { dataUri: null, error: `O BLOB de ${label} não contém uma imagem PNG, JPG, GIF ou BMP válida.` };
  };
  if (Buffer.isBuffer(blob)) return toDataUri(blob);
  if (typeof blob !== "function") return { dataUri: null, error: `Não foi possível ler o BLOB de ${label}.` };
  return new Promise((resolve) => {
    blob((error, _name, stream) => {
      if (error || !stream) return resolve({ dataUri: null, error: `Não foi possível ler o BLOB de ${label}.` });
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", () => resolve({ dataUri: null, error: `Não foi possível ler o BLOB de ${label}.` }));
      stream.on("end", () => resolve(toDataUri(Buffer.concat(chunks))));
    });
  });
}

async function withTransaction(work) {
  return pool.withConnection((db) => db.withTransaction(work));
}

async function ensureDailyClock(executor, machineCode) {
  const rows = await executor.queryAsync(`select first 1 cdp_codigo as counter_code, cdp_cronometro as clock_value
    from contador_diario_processos
    where mqp_codigo = ? and cdp_status = 'Iniciado' and cdp_data = current_date
    order by cdp_codigo desc`, [machineCode]);
  if (rows[0]) return rows[0];

  await executor.queryAsync(`update contador_diario_processos
    set cdp_fim = coalesce(cdp_cronometro, current_timestamp), cdp_status = 'Finalizado'
    where mqp_codigo = ? and cdp_status = 'Iniciado' and cdp_data < current_date`, [machineCode]);
  await executor.queryAsync(`insert into contador_diario_processos (mqp_codigo, cdp_data, cdp_inicio, cdp_cronometro, cdp_status)
    values (?, current_date, current_timestamp, current_timestamp, 'Iniciado')`, [machineCode]);
  const createdRows = await executor.queryAsync(`select first 1 cdp_codigo as counter_code, cdp_cronometro as clock_value
    from contador_diario_processos
    where mqp_codigo = ? and cdp_status = 'Iniciado' and cdp_data = current_date
    order by cdp_codigo desc`, [machineCode]);
  if (!createdRows[0]) throw Object.assign(new Error("Não foi possível iniciar o contador diário da máquina."), { statusCode: 500 });
  return createdRows[0];
}

async function consumeDailyClock(executor, machineCode) {
  const counter = await ensureDailyClock(executor, machineCode);
  const counterCode = Number(counter?.counter_code ?? counter?.COUNTER_CODE);
  if (!Number.isInteger(counterCode) || counterCode < 1) {
    throw Object.assign(new Error("Não foi encontrado um contador diário Iniciado para esta máquina. Inicie o período antes de apontar a produção."), { statusCode: 409 });
  }
  const currentRows = await executor.queryAsync(`select current_timestamp as clock_value from rdb$database`);
  const currentClock = currentRows[0]?.clock_value ?? currentRows[0]?.CLOCK_VALUE;
  if (!currentClock) throw Object.assign(new Error("Não foi possível obter o horário atual do Firebird para a máquina."), { statusCode: 500 });
  await executor.queryAsync(`update contador_diario_processos set cdp_cronometro = ? where cdp_codigo = ?`, [currentClock, counterCode]);
  return currentClock;
}

async function consumeDailyClockForMachine(machineCode) {
  return pool.withConnection((db) => consumeDailyClock(db, machineCode));
}

async function initializeDailyClockForMachine(machineCode) {
  return pool.withConnection((db) => ensureDailyClock(db, machineCode));
}

async function reservationContext(executor, opCodigo, mpCodigo, machineCode, forceManualReservation = false) {
  const processRows = await executor.queryAsync(`select first 1 mp.mqp_codigo as machine_code, mq.gmq_codigo as group_code, mq.mqp_descricao as machine_description
    from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
    where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
  const processRow = processRows[0];
  if (!processRow) throw Object.assign(new Error("Processo não encontrado para a máquina atual."), { statusCode: 404 });
  const machineLabel = String(processRow.machine_description ?? processRow.MACHINE_DESCRIPTION ?? "");
  const policy = reservePolicy(processRow.group_code ?? processRow.GROUP_CODE, machineLabel);
  if (!policy.applies && !forceManualReservation) {
    const previousRows = await executor.queryAsync(`select first 1 mv.mp_qtdeapontada as previous_quantity, machine.mqp_descricao as previous_process
      from mov_processos mv inner join maquinas_processos machine on machine.mqp_codigo = mv.mqp_codigo
      where mv.op_codigo = ? and mv.mp_codigo < ? and coalesce(mv.mp_qtdeapontada, 0) > 0
      order by mv.mp_codigo desc`, [opCodigo, mpCodigo]);
    const currentRows = await executor.queryAsync(`select coalesce(mv.mp_qtdeapontada, 0) as current_quantity
      from mov_processos mv where mv.op_codigo = ? and mv.mp_codigo = ?`, [opCodigo, mpCodigo]);
    const previous = previousRows[0] ?? null;
    const previousQuantity = Number(previous?.previous_quantity ?? previous?.PREVIOUS_QUANTITY ?? 0);
    const currentQuantity = Number(currentRows[0]?.current_quantity ?? currentRows[0]?.CURRENT_QUANTITY ?? 0);
    const previousProcessDescription = previous ? String(previous.previous_process ?? previous.PREVIOUS_PROCESS ?? "").trim() || null : null;
    const quantityToPoint = previous ? Math.max(0, previousQuantity - currentQuantity) : null;
    return {
      applies: false, groupLabel: null, quantity: 0, balance: 0, arrangementLength: 1, arrangementColumns: 1, arrangementTotal: 1,
      indicatorLabel: previousProcessDescription ? `Quantidade a apontar · ${previousProcessDescription}` : null,
      indicatorQuantity: quantityToPoint, previousProcessDescription, rows: [],
    };
  }
  const rows = await executor.queryAsync(`select er.er_codigo as reserve_code, er.er_quantidade as quantity, er.er_saldo as balance, er.er_lote as lot, er.er_data_fabricacao as manufacturing_date,
      er.pc_tipo as reserve_type,
      er.pc_codigo as product_code, pcf.pcf_codigo as supplier_code, pcf.pes_codigo as person_code,
      coalesce(pcf.pcf_estoque_zerado, 'N') as stock_zeroed, coalesce(pcf.pcf_situacao_estoque, '') as stock_status,
      coalesce(er.er_arranjo_l, 1) as arrangement_length, coalesce(er.er_arranjo_c, 1) as arrangement_columns
    from estoque_reservado er
    left join prod_compras_fornecedor pcf on pcf.pc_codigo = er.pc_codigo and pcf.pcf_codigo = er.pcf_codigo
    where er.op_codigo = ? and coalesce(er.er_status, '') <> 'Atendido'
    order by er.er_codigo`, [opCodigo]);
  const normalized = rows.map((row) => ({
    reserveCode: Number(row.reserve_code ?? row.RESERVE_CODE), quantity: Number(row.quantity ?? row.QUANTITY ?? 0), balance: Number(row.balance ?? row.BALANCE ?? 0),
    type: String(row.reserve_type ?? row.RESERVE_TYPE ?? ""), lot: String(row.lot ?? row.LOT ?? ""), manufacturingDate: row.manufacturing_date ?? row.MANUFACTURING_DATE ?? null, productCode: Number(row.product_code ?? row.PRODUCT_CODE), supplierCode: Number(row.supplier_code ?? row.SUPPLIER_CODE ?? 0),
    personCode: Number(row.person_code ?? row.PERSON_CODE ?? 0), stockZeroed: String(row.stock_zeroed ?? row.STOCK_ZEROED ?? "N"), stockStatus: String(row.stock_status ?? row.STOCK_STATUS ?? ""),
    arrangementLength: Math.max(1, Number(row.arrangement_length ?? row.ARRANGEMENT_LENGTH ?? 1) || 1), arrangementColumns: Math.max(1, Number(row.arrangement_columns ?? row.ARRANGEMENT_COLUMNS ?? 1) || 1),
  }));
  const processGroupCode = Number(processRow.group_code ?? processRow.GROUP_CODE ?? 0);
  const applicableRows = policy.applies
    ? selectApplicableReservations(normalized, policy)
    : processGroupCode === 9
      ? normalized.filter((row) => String(row.type).trim().toLocaleUpperCase("pt-BR") === "CORTADA/VINCADA")
      : normalized;
  const reservedQuantity = applicableRows.reduce((total, row) => total + row.quantity, 0);
  const balance = applicableRows.reduce((total, row) => total + row.balance, 0);
  const arrangementLength = applicableRows[0]?.arrangementLength ?? 1;
  const arrangementColumns = applicableRows[0]?.arrangementColumns ?? 1;
  const arrangementTotal = Math.max(1, arrangementLength * arrangementColumns);
  if (balance <= 0) {
    const previousRows = await executor.queryAsync(`select first 1 mv.mp_qtdeapontada as previous_quantity, machine.mqp_descricao as previous_process
      from mov_processos mv inner join maquinas_processos machine on machine.mqp_codigo = mv.mqp_codigo
      where mv.op_codigo = ? and mv.mp_codigo < ? and coalesce(mv.mp_qtdeapontada, 0) > 0
      order by mv.mp_codigo desc`, [opCodigo, mpCodigo]);
    const currentRows = await executor.queryAsync(`select coalesce(mv.mp_qtdeapontada, 0) as current_quantity
      from mov_processos mv where mv.op_codigo = ? and mv.mp_codigo = ?`, [opCodigo, mpCodigo]);
    const previous = previousRows[0] ?? null;
    const previousQuantity = Number(previous?.previous_quantity ?? previous?.PREVIOUS_QUANTITY ?? 0);
    const currentQuantity = Number(currentRows[0]?.current_quantity ?? currentRows[0]?.CURRENT_QUANTITY ?? 0);
    const previousProcessDescription = previous ? String(previous.previous_process ?? previous.PREVIOUS_PROCESS ?? "").trim() || null : null;
    const quantityToPoint = previous ? Math.max(0, previousQuantity - currentQuantity) : null;
    return {
      applies: false, groupLabel: null, quantity: 0, balance: 0, arrangementLength: 1, arrangementColumns: 1, arrangementTotal: 1,
      indicatorLabel: previousProcessDescription ? `Quantidade a apontar · ${previousProcessDescription}` : null,
      indicatorQuantity: quantityToPoint, previousProcessDescription, rows: [],
    };
  }
  const previousRows = await executor.queryAsync(`select mv.mp_qtdeapontada as previous_quantity, machine.mqp_descricao as previous_process, machine.gmq_codigo as previous_group
    from mov_processos mv inner join maquinas_processos machine on machine.mqp_codigo = mv.mqp_codigo
    where mv.op_codigo = ? and mv.mp_codigo = ?`, [opCodigo, mpCodigo - 1]);
  const currentRows = await executor.queryAsync(`select coalesce(mv.mp_qtdeapontada, 0) as current_quantity
    from mov_processos mv where mv.op_codigo = ? and mv.mp_codigo = ?`, [opCodigo, mpCodigo]);
  const previous = previousRows[0] ?? null;
  const previousQuantity = Number(previous?.previous_quantity ?? previous?.PREVIOUS_QUANTITY ?? 0);
  const previousGroup = Number(previous?.previous_group ?? previous?.PREVIOUS_GROUP ?? 0);
  const previousProcessDescription = previous ? String(previous.previous_process ?? previous.PREVIOUS_PROCESS ?? "").trim() || null : null;
  const currentQuantity = Number(currentRows[0]?.current_quantity ?? currentRows[0]?.CURRENT_QUANTITY ?? 0);
  let indicatorLabel = null;
  let indicatorQuantity = null;
  if (reservedQuantity > 0 && previousGroup !== 1) {
    indicatorLabel = reservedQuantity === balance ? "Quantidade reservada" : "Reserva menos produção parcial";
    indicatorQuantity = reservedQuantity === balance ? reservedQuantity : balance;
  } else if (previous && currentQuantity === 0) {
    indicatorLabel = `Quantidade ${previousProcessDescription ?? "processo anterior"}`;
    indicatorQuantity = previousQuantity;
  } else if (previous && currentQuantity > 0) {
    indicatorLabel = `Saldo ${previousProcessDescription ?? "processo anterior"}`;
    indicatorQuantity = Math.max(0, previousQuantity - currentQuantity);
  }
  return { applies: true, groupLabel: policy.label ?? "Reserva do processo manual", quantity: reservedQuantity, balance, arrangementLength, arrangementColumns, arrangementTotal, indicatorLabel, indicatorQuantity, previousProcessDescription, rows: applicableRows };
}

async function paged(sql, countSql, params, req) {
  const { limit, offset } = listPage(req);
  const [items, countRows] = await Promise.all([
    query(sql(limit, offset), params),
    query(countSql, params),
  ]);
  return { items, total: Number(countRows[0]?.total ?? 0), page: Math.floor(offset / limit) + 1, limit };
}

function canConfigureStation(groupCode, groupDescription = "") {
  const programmerGroups = (process.env.PRODUCTION_PROGRAMMER_GROUPS || "3,4,6")
    .split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
  const configuratorGroups = (process.env.PRODUCTION_STATION_CONFIGURATOR_GROUPS || programmerGroups.join(","))
    .split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
  const normalizedDescription = String(groupDescription ?? "").trim().toLocaleUpperCase("pt-BR");
  return configuratorGroups.includes(Number(groupCode)) || /\b(PCP|PROGRAMADOR|ADMINISTRADOR|ADMIN)\b/.test(normalizedDescription);
}

function operationalProfile(groupCode, groupDescription = "") {
  const manualGroups = (process.env.PRODUCTION_MANUAL_POINTING_GROUPS || "")
    .split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
  const normalizedDescription = String(groupDescription ?? "").trim().toLocaleUpperCase("pt-BR");
  if (/\bQUALIDADE\b/.test(normalizedDescription)) return "quality-release";
  if (manualGroups.includes(Number(groupCode)) || normalizedDescription === "APONTADOR") return "manual-pointing";
  if (normalizedDescription === "MANUAL") return "manual-production";
  return canConfigureStation(groupCode, groupDescription) ? "programmer" : "operator";
}

function isManualPointingMachine(machine) {
  const description = String(machine?.description ?? "").trim().toLocaleUpperCase("pt-BR");
  return Boolean(machine?.manualProcess) || description.includes("APONTAMENTO");
}

function isPointingMachineGroup(groupName) {
  return String(groupName ?? "").trim().toLocaleUpperCase("pt-BR") === "APONTAMENTO";
}

function isProductReleaseMachine(machine) {
  return isManualPointingMachine(machine) && isProductReleaseMachineGroup(machine?.groupDescription);
}

function isProductReleaseMachineGroup(groupName) {
  return String(groupName ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR").includes("LIBERACAO DE PRODUTO");
}

function isColadeiraMachineGroup(groupName) {
  return String(groupName ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR").includes("COLADEIRA");
}

function isSpecialProductionMachine(machine) {
  if (!isManualPointingMachine(machine)) return false;
  const groupName = String(machine?.groupDescription ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR");
  return groupName === "APONTAMENTO" || groupName === "MANUAL" || groupName.includes("LIBERACAO DE PRODUTO");
}

function specialField(row, ...keys) {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return null;
}

function specialNumber(row, ...keys) {
  const value = Number(specialField(row, ...keys));
  return Number.isFinite(value) ? value : 0;
}

async function getSpecialProductionDetails(runQuery, opCodigo, machineCode) {
  const mainRows = await runQuery(`select first 1 op.op_especial as special_code, coalesce(op.op_principal, 'N') as principal from ordens_producao op where op.op_codigo = ?`, [opCodigo]);
  const main = mainRows[0];
  const specialCode = specialNumber(main, "special_code", "SPECIAL_CODE");
  const principal = String(specialField(main, "principal", "PRINCIPAL") ?? "N").trim().toUpperCase();
  if (!specialCode || principal === "N") return { isSpecial: false, specialCode: null, primaryOpCode: opCodigo, components: [] };
  const rows = await runQuery(`select mp.op_codigo, mp.mp_codigo, mp.pv_codigo as product_code, mp.mp_fantasia as product, mp.pv_revisao as revision, mp.pes_codigo as person_code,
      mp.mp_status as status, mp.mp_posicao as queue_position, mp.mp_saldo as balance, mp.mp_qtde_produzida as produced_quantity,
      coalesce(mp.mp_pcs_conjunto, 1) as pieces_per_set, coalesce(mp.mp_referencia, pv.pv_referencia) as reference, pv.pv_cod_prod_cli as customer_product_code,
      coalesce(pes.pes_fantasia, pes.pes_razao_social, mp.mp_cliente) as client,
      mq.mqp_descricao as machine_description
      from ordens_producao op
      inner join mov_processos mp on mp.op_codigo = op.op_codigo
      inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
      left join pessoa pes on pes.pes_codigo = op.pes_codigo
      where op.op_especial = ? and coalesce(op.op_principal, 'N') = 'N' and op.op_codigo <> ? and mp.mqp_codigo = ?
      order by mp.op_codigo, mp.mp_codigo`, [specialCode, opCodigo, machineCode]);
  return {
    isSpecial: true,
    specialCode,
    primaryOpCode: opCodigo,
    components: rows.map((row) => ({
      opCode: specialNumber(row, "op_codigo", "OP_CODIGO"), mpCode: specialNumber(row, "mp_codigo", "MP_CODIGO"),
      productCode: specialNumber(row, "product_code", "PRODUCT_CODE") || null, product: specialField(row, "product", "PRODUCT") ?? null, revision: specialNumber(row, "revision", "REVISION") || null, customerProductCode: specialField(row, "customer_product_code", "CUSTOMER_PRODUCT_CODE") ?? null, client: specialField(row, "client", "CLIENT") ?? null, personCode: specialNumber(row, "person_code", "PERSON_CODE"),
      status: specialField(row, "status", "STATUS") ?? null, queuePosition: specialField(row, "queue_position", "QUEUE_POSITION") ?? null,
      balance: specialNumber(row, "balance", "BALANCE"), producedQuantity: specialNumber(row, "produced_quantity", "PRODUCED_QUANTITY"),
      piecesPerSet: Math.max(1, specialNumber(row, "pieces_per_set", "PIECES_PER_SET") || 1),
      reference: specialField(row, "reference", "REFERENCE") ?? null, machineDescription: specialField(row, "machine_description", "MACHINE_DESCRIPTION") ?? null,
    })),
  };
}

async function synchronizeSpecialProductionComponents(transaction, input) {
  const special = await getSpecialProductionDetails((sql, params) => transaction.queryAsync(sql, params), input.opCodigo, input.machineCode);
  if (!special.isSpecial || !special.components.length) return { ...special, updated: [], skipped: [] };
  const updated = []; const skipped = [];
  for (const component of special.components) {
    const normalizedStatus = String(component.status ?? "").trim().toLocaleUpperCase("pt-BR");
    if (["ATENDIDO", "CANCELADO", "SETUP CANCELADO"].includes(normalizedStatus)) { skipped.push(component.opCode); continue; }
    const factor = Math.max(1, Number(component.piecesPerSet) || 1);
    const produced = input.producedQuantity * factor;
    const lost = input.lostQuantity * factor;
    const net = Math.max(0, produced - lost);
    const balance = Math.max(0, Number(component.balance ?? 0) - net);
    await transaction.queryAsync(`update mov_processos set mp_fila = ?, mp_qtde_produzida = coalesce(mp_qtde_produzida, 0) + ?, mp_qtde_perdida = coalesce(mp_qtde_perdida, 0) + ?, mp_qtdeapontada = coalesce(mp_qtdeapontada, 0) + ?, mp_saldo = ?, mp_status = ?, mp_posicao = ?, mp_fim = ?, mp_data_atendido = ?, mp_observacao = ?, mp_situacao_lib = coalesce(?, mp_situacao_lib) where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [input.queue, net, lost, produced, balance, input.status, input.position, input.finishedAt, input.finishedAt, input.observation, input.releaseSituation ?? null, component.opCode, component.mpCode, input.machineCode]);
    const activeRows = await transaction.queryAsync(`select first 1 mph_codigo as schedule_code from mov_processos_horarios where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A' order by mph_codigo desc`, [component.opCode, component.mpCode, input.machineCode]);
    if (activeRows[0]) {
      await transaction.queryAsync(`update mov_processos_horarios set mph_fim = ?, mph_qtde_produzida = coalesce(mph_qtde_produzida, 0) + ?, mph_qtde_perdida = coalesce(mph_qtde_perdida, 0) + ?, mph_qtde_fun = ?, mph_observacao = ?, mph_verificador = 'F', mph_status = ?, mph_situacao = 'A', mph_rastreio_lotes = ?, mph_situacao_insp = coalesce(?, mph_situacao_insp), mph_situacao_lib = coalesce(?, mph_situacao_lib) where mph_codigo = ?`, [input.finishedAt, net, lost, input.quantityPeople, input.observation, input.status, input.lotTrace ?? "", input.conformity ?? null, input.releaseSituation ?? null, specialNumber(activeRows[0], "schedule_code", "SCHEDULE_CODE")]);
    } else {
      const sequenceRows = await transaction.queryAsync(`select coalesce(max(mph_numero_processo), 0) + 1 as process_number from mov_processos_horarios where op_codigo = ? and mqp_codigo = ?`, [component.opCode, input.machineCode]);
      const processNumber = specialNumber(sequenceRows[0], "process_number", "PROCESS_NUMBER") || 1;
      await transaction.queryAsync(`insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, mph_fim, op_codigo, pv_codigo, pv_revisao, mqp_codigo, mph_verificador, mp_codigo, mph_numero_processo, mph_qtde_produzida, mph_qtde_perdida, mph_qtde_fun, mph_observacao, mph_status, mph_situacao, mph_rastreio_lotes, mph_situacao_insp, mph_situacao_lib) values (?, ?, ?, ?, ?, ?, ?, ?, 'F', ?, ?, ?, ?, ?, ?, ?, 'A', ?, ?, ?)`, [input.finishedAt, input.operatorId, input.finishedAt, input.finishedAt, component.opCode, component.productCode, component.revision, input.machineCode, component.mpCode, processNumber, net, lost, input.quantityPeople, input.observation, input.status, input.lotTrace ?? "", input.conformity ?? null, input.releaseSituation ?? null]);
    }
    await transaction.queryAsync(`update ordens_producao set op_produzido = coalesce(op_produzido, 0) + ?, op_status = ? where op_codigo = ?`, [net, input.status, component.opCode]);
    if (input.insertFinishedStock && net > 0) await transaction.queryAsync(`execute procedure movimenta_estoque (?, ?, 1, ?, 'AP', 'N', 'S', 0, '', ?, 0, ?, ?, 3, ?, '', 'Não Conferido', '', ?)`, [component.productCode, component.revision, net, component.personCode, component.opCode, input.operatorId, input.productionDate]);
    updated.push({ opCode: component.opCode, mpCode: component.mpCode, factor, producedQuantity: produced, lostQuantity: lost, netQuantity: net });
  }
  return { ...special, updated, skipped };
}

async function startSpecialProductionComponents(transaction, input) {
  const special = await getSpecialProductionDetails((sql, params) => transaction.queryAsync(sql, params), input.opCodigo, input.machineCode);
  if (!special.isSpecial || !special.components.length) return { ...special, started: [], skipped: [] };
  const started = []; const skipped = [];
  for (const component of special.components) {
    const currentRows = await transaction.queryAsync(`select first 1 mp_status as status, pv_codigo as product_code, pv_revisao as revision from mov_processos where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? with lock`, [component.opCode, component.mpCode, input.machineCode]);
    const current = currentRows[0];
    if (!current) { skipped.push(component.opCode); continue; }
    const status = String(specialField(current, "status", "STATUS") ?? "").trim().toLocaleUpperCase("pt-BR");
    if (["ATENDIDO", "CANCELADO", "SETUP CANCELADO"].includes(status)) { skipped.push(component.opCode); continue; }
    await transaction.queryAsync(`update mov_processos set mp_data = current_date, mp_status = 'Em Produção', mp_posicao = 'PI', mp_inicio = ?, mp_fim = null, usu_codigo = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [input.startedAt, input.operatorId, component.opCode, component.mpCode, input.machineCode]);
    const activeRows = await transaction.queryAsync(`select first 1 mph_codigo as schedule_code from mov_processos_horarios where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A' order by mph_codigo desc`, [component.opCode, component.mpCode, input.machineCode]);
    if (!activeRows[0]) {
      const sequenceRows = await transaction.queryAsync(`select coalesce(max(mph_numero_processo), 0) + 1 as process_number from mov_processos_horarios where op_codigo = ? and mqp_codigo = ?`, [component.opCode, input.machineCode]);
      const processNumber = specialNumber(sequenceRows[0], "process_number", "PROCESS_NUMBER") || 1;
      await transaction.queryAsync(`insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, op_codigo, pv_codigo, pv_revisao, mqp_codigo, mph_verificador, mp_codigo, mph_numero_processo) values (?, ?, ?, ?, ?, ?, ?, 'A', ?, ?)`, [input.startedAt, input.operatorId, input.startedAt, component.opCode, specialNumber(current, "product_code", "PRODUCT_CODE") || component.productCode, specialNumber(current, "revision", "REVISION") || component.revision, input.machineCode, component.mpCode, processNumber]);
    }
    started.push({ opCode: component.opCode, mpCode: component.mpCode });
  }
  return { ...special, started, skipped };
}

async function findMachineForOperator(userId, selectedMachineCode = null) {
  const selectedCode = Number(selectedMachineCode);
  const hasSelectedCode = Number.isInteger(selectedCode) && selectedCode > 0;
  const configuredCode = Number(process.env.FIREBIRD_MACHINE_CODE);
  const configuredMachineCode = Number.isInteger(configuredCode) && configuredCode > 0 ? configuredCode : null;
  const machineCode = hasSelectedCode ? selectedCode : configuredMachineCode;
  const byCode = machineCode !== null;
  const configuredLogon = process.env.FIREBIRD_MACHINE_LOGON?.trim();
  const localHostname = process.platform === "win32"
    ? process.env.COMPUTERNAME?.trim() || os.hostname()
    : process.env.HOSTNAME?.trim() || os.hostname();
  const logonCandidates = [...new Set([configuredLogon, localHostname].filter((value) => Boolean(value)))];
  try {
    let machine = null;
    if (byCode) {
      const rows = await query(`select first 1 mq.mqp_codigo as code, mq.mqp_descricao as description, mq.gmq_codigo as group_code, gm.gmq_grupo as group_description,
        mq.mqp_segue_fila as follows_queue, mq.mqp_processo_manual as manual_process
        from maquinas_processos mq left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mq.mqp_codigo = ? and mq.mqp_status = 'Ativo'`, [machineCode]);
      machine = rows[0] ?? null;
    } else {
      for (const logonName of logonCandidates) {
        const rows = await query(`select first 1 mq.mqp_codigo as code, mq.mqp_descricao as description, mq.gmq_codigo as group_code, gm.gmq_grupo as group_description,
          mq.mqp_segue_fila as follows_queue, mq.mqp_processo_manual as manual_process
          from maquinas_processos mq left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where upper(trim(mq.mqp_logon)) = upper(trim(?))`, [logonName]);
        if (rows[0]) { machine = rows[0]; break; }
      }
    }
    if (!machine && !byCode) {
      const fallbackRows = await query(`
        select first 1 mq.mqp_codigo as code, mq.mqp_descricao as description, mq.gmq_codigo as group_code, gm.gmq_grupo as group_description,
               mq.mqp_segue_fila as follows_queue, mq.mqp_processo_manual as manual_process
        from usuarios_maquinas um
        inner join maquinas_processos mq on mq.mqp_codigo = um.mqp_codigo
        left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
        where um.usu_codigo = ? order by um.mqp_codigo
      `, [userId]);
      machine = fallbackRows[0];
    }
    if (!machine) return null;
    return { code: Number(machine.code), description: String(machine.description ?? "Máquina sem descrição"), groupCode: machine.group_code == null ? null : Number(machine.group_code), groupDescription: machine.group_description ? String(machine.group_description) : null, followsQueue: String(machine.follows_queue ?? "S").toUpperCase() !== "N", manualProcess: String(machine.manual_process ?? "N").toUpperCase() === "S" };
  } catch (error) {
    console.warn("[Firebird Proxy] Não foi possível identificar a máquina do operador:", error instanceof Error ? error.message : error);
    return null;
  }
}

app.get("/health", ensureAuthorized, async (_req, res, next) => {
  try {
    await query("select 1 as alive from rdb$database");
    res.json({ status: "ok", database: "reachable" });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/system/printers", ensureAuthorized, async (_req, res, next) => {
  try {
    if (process.platform !== "win32") return res.json({ printers: [], source: "unsupported" });
    res.json({ printers: await getWindowsPrinters(), source: "windows" });
  } catch (error) { next(error); }
});

app.get("/v1/companies", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`select emp_codigo as code, emp_fantasia as fantasy_name, emp_razao_social as legal_name
      from empresa order by emp_fantasia, emp_razao_social`);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), fantasyName: row.fantasy_name ?? row.FANTASY_NAME ?? null, legalName: row.legal_name ?? row.LEGAL_NAME ?? null })));
  } catch (error) { next(error); }
});

app.get("/v1/stations", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`select mqp_codigo as code, mqp_descricao as description, gmq_codigo as group_code,
      mqp_segue_fila as follows_queue, mqp_processo_manual as manual_process
      from maquinas_processos where mqp_status = 'Ativo' order by mqp_descricao`);
    res.json(rows.map((machine) => ({
      code: Number(machine.code ?? machine.CODE),
      description: String(machine.description ?? machine.DESCRIPTION ?? "Máquina sem descrição"),
      groupCode: machine.group_code == null && machine.GROUP_CODE == null ? null : Number(machine.group_code ?? machine.GROUP_CODE),
      followsQueue: String(machine.follows_queue ?? machine.FOLLOWS_QUEUE ?? "S").toUpperCase() !== "N",
      manualProcess: String(machine.manual_process ?? machine.MANUAL_PROCESS ?? "N").toUpperCase() === "S",
    })));
  } catch (error) { next(error); }
});

app.get("/v1/manual-machines", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`select mq.mqp_codigo as code, mq.mqp_descricao as description, mq.gmq_codigo as group_code,
      gm.gmq_grupo as group_description, mq.mqp_segue_fila as follows_queue, mq.mqp_processo_manual as manual_process
      from maquinas_processos mq
      left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
      where mq.mqp_status = 'Ativo' and coalesce(mq.mqp_processo_manual, 'N') = 'S'
      order by mq.mqp_descricao`);
    const blockedGroups = new Set(["LIBERACAO DE PRODUTO", "APONTAMENTO"]);
    const normalizeGroup = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    res.json(rows
      .filter((machine) => !blockedGroups.has(normalizeGroup(machine.group_description ?? machine.GROUP_DESCRIPTION)))
      .map((machine) => ({
        code: Number(machine.code ?? machine.CODE),
        description: String(machine.description ?? machine.DESCRIPTION ?? "Máquina sem descrição"),
        groupCode: machine.group_code == null && machine.GROUP_CODE == null ? null : Number(machine.group_code ?? machine.GROUP_CODE),
        groupDescription: machine.group_description ?? machine.GROUP_DESCRIPTION ?? null,
        followsQueue: String(machine.follows_queue ?? machine.FOLLOWS_QUEUE ?? "S").toUpperCase() !== "N",
        manualProcess: true,
      })));
  } catch (error) { next(error); }
});

app.post("/v1/auth/login", ensureAuthorized, async (req, res, next) => {
  try {
    const login = String(req.body?.login ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!login || !password) return res.status(400).json({ error: "Informe usuário e senha." });
    const userCode = /^\d+$/.test(login) ? Number(login) : -1;

    const users = await query(`
      select usu.usu_codigo, usu.usu_email, usu.usu_login, usu.usu_senha,
             usu.fun_codigo, usu.gu_codigo, gu.gu_usuario as group_description, fun.fun_nome, fun.fun_sobrenome,
             fun.se_codigo, fun.c_codigo
      from usuarios usu
      left join funcionarios fun on fun.fun_codigo = usu.fun_codigo
      left join grupo_usuarios gu on gu.gu_codigo = usu.gu_codigo
      where lower(usu.usu_login) = lower(?) or lower(usu.usu_email) = lower(?) or usu.usu_codigo = ?
    `, [login, login, userCode]);
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, String(user.usu_senha ?? "").trim()))) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }
    const permissionRows = await query(`
      select perm.perm_name
      from permissoes perm
      left join usuarios_permissoes up on up.perm_codigo = perm.perm_codigo and up.usu_codigo = ?
      left join usuarios usu on usu.usu_codigo = ?
      left join grupo_permissoes gpe on gpe.gpe_cod_permissao = perm.perm_codigo and gpe.gpe_cod_grupo = usu.gu_codigo
      where iif(up.perm_codigo > 0, up.up_inserir, gpe.gpe_inserir) = 'S'
    `, [user.usu_codigo, user.usu_codigo]);
    const profile = operationalProfile(user.gu_codigo, user.group_description);
    const canConfigure = canConfigureStation(user.gu_codigo, user.group_description);
    const selectedMachineCode = Number(req.body?.machineCode);
    const hasSelectedMachine = Number.isInteger(selectedMachineCode) && selectedMachineCode > 0;
    if (!hasSelectedMachine && !canConfigure) {
      return res.status(403).json({ error: "Esta estação ainda não está configurada. Solicite ao PCP, Programador ou Administrador que configure a estação." });
    }
    const machine = await findMachineForOperator(Number(user.usu_codigo), hasSelectedMachine ? selectedMachineCode : null);
    if (machine?.code) await initializeDailyClockForMachine(Number(machine.code));
    if (["manual-pointing", "manual-production"].includes(profile) && !isManualPointingMachine(machine)) {
      return res.status(403).json({ error: "Usuários Apontador e Manual só podem acessar máquinas marcadas como Processo Manual." });
    }
    if (profile === "quality-release" && !isProductReleaseMachine(machine)) {
      return res.status(403).json({ error: "Usuários Qualidade só podem acessar a máquina manual de Liberação de Produto." });
    }
    if (profile === "operator" && isManualPointingMachine(machine)) {
      return res.status(403).json({ error: "Máquinas de Processo Manual são exclusivas para usuários Apontador ou Manual." });
    }
    res.json({
      id: Number(user.usu_codigo),
      login: String(user.usu_login),
      name: [user.fun_nome, user.fun_sobrenome].filter(Boolean).join(" ") || String(user.usu_login),
      email: user.usu_email ? String(user.usu_email) : null,
      groupCode: user.gu_codigo === null || user.gu_codigo === undefined ? null : Number(user.gu_codigo),
      groupDescription: user.group_description ? String(user.group_description) : null,
      employeeCode: user.fun_codigo === null || user.fun_codigo === undefined ? null : Number(user.fun_codigo),
      sectorCode: user.se_codigo === null || user.se_codigo === undefined ? null : Number(user.se_codigo),
      companyCode: user.c_codigo === null || user.c_codigo === undefined ? null : Number(user.c_codigo),
      permissions: permissionRows.map((row) => String(row.perm_name)).filter(Boolean),
      operationalProfile: profile,
      canConfigureStation: canConfigure,
      machine,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/dashboard", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`
      select
        count(*) as total,
        sum(case when mp_status = 'Em Produção' then 1 else 0 end) as em_producao,
        sum(case when mp_status = 'Liberado' then 1 else 0 end) as liberado,
        sum(case when mp_status = 'Parcial' then 1 else 0 end) as parcial,
        sum(case when mp_status = 'Atendido' then 1 else 0 end) as atendido
      from mov_processos
    `);
    const row = rows[0] ?? {};
    res.json({
      total: Number(row.total ?? 0),
      emProducao: Number(row.em_producao ?? 0),
      liberado: Number(row.liberado ?? 0),
      parcial: Number(row.parcial ?? 0),
      atendido: Number(row.atendido ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/orders", ensureAuthorized, async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const filter = `(? = '' or cast(mp.op_codigo as varchar(20)) containing ? or coalesce(mp.mp_referencia, '') containing ? or coalesce(pv.pv_referencia, '') containing ?)`;
    const params = [search, search, search, search];
    const result = await paged(
      (limit, offset) => `
        select first ${limit} skip ${offset}
          mp.op_codigo as op_codigo, mp.mp_codigo as mp_codigo, mp.mp_fila as fila,
          mp.mp_status as status, mp.mp_data as data, mp.mp_data_entrega as data_entrega,
          mp.mp_saldo as saldo, mp.mp_qtde_produzida as quantidade_produzida,
          mp.mp_qtde_perdida as quantidade_perdida, mp.mp_referencia as referencia,
          mq.mqp_descricao as processo, pv.pv_referencia as produto_referencia
        from mov_processos mp
        left join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
        left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
        where ${filter}
        order by mp.mp_data desc, mp.op_codigo desc
      `,
      `select count(*) as total from mov_processos mp left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao where ${filter}`,
      params,
      req,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/v1/orders/:opCodigo/:mpCodigo/status", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo);
    const mpCodigo = Number(req.params.mpCodigo);
    const status = String(req.body?.status ?? "").trim();
    const fila = Number(req.body?.fila);
    if (!Number.isInteger(opCodigo) || !Number.isInteger(mpCodigo) || !status) {
      return res.status(400).json({ error: "Dados de ordem inválidos." });
    }
    await query(
      `update mov_processos set mp_status = ?, mp_fila = case when ? > 0 then ? else mp_fila end where op_codigo = ? and mp_codigo = ?`,
      [status, fila, fila, opCodigo, mpCodigo],
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/programming", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    const search = String(req.query.search ?? "").trim();
    const operatorOnly = String(req.query.operatorOnly ?? "false").toLowerCase() === "true";
    const statusFilter = String(req.query.status ?? "Todos").trim();
    const releaseStartedOnly = String(req.query.releaseStartedOnly ?? "false").toLowerCase() === "true";
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const machineRows = await query(`select first 1 mq.mqp_descricao as description, mq.mqp_processo_manual as manual_process, gm.gmq_grupo as group_description from maquinas_processos mq left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mq.mqp_codigo = ?`, [machineCode]);
    const currentMachine = machineRows[0] ? { description: machineRows[0].description ?? machineRows[0].DESCRIPTION, manualProcess: String(machineRows[0].manual_process ?? machineRows[0].MANUAL_PROCESS ?? "N").toUpperCase() === "S", groupDescription: machineRows[0].group_description ?? machineRows[0].GROUP_DESCRIPTION ?? null } : null;
    const specialSetMachine = isSpecialProductionMachine(currentMachine);
    const coladeiraMachine = isColadeiraMachineGroup(currentMachine?.groupDescription);
    const filterParts = ["mp.mqp_codigo = ?"];
    if (specialSetMachine) filterParts.push("(coalesce(op.op_especial, 0) = 0 or coalesce(op.op_principal, 'N') <> 'N')");
    if (releaseStartedOnly) filterParts.push("(mp.mp_inicio is not null or upper(trim(coalesce(mp.mp_status, ''))) in ('EM PRODUÇÃO', 'PARCIAL', 'ATENDIDO') or exists (select 1 from mov_processos mp_anterior where mp_anterior.op_codigo = mp.op_codigo and mp_anterior.mp_codigo < mp.mp_codigo and upper(trim(coalesce(mp_anterior.mp_status, ''))) = 'ATENDIDO'))");
    const params = [machineCode];
    if (search) {
      filterParts.push("(cast(mp.op_codigo as varchar(20)) containing ? or cast(mp.pv_codigo as varchar(20)) containing ? or cast(coalesce(pv.pv_cod_prod_cli, '') as varchar(255)) containing ? or coalesce(mp.mp_referencia, '') containing ? or coalesce(pv.pv_referencia, '') containing ? or coalesce(mp.mp_fantasia, p.pes_fantasia, mp.mp_cliente, '') containing ?)");
      params.push(search, search, search, search, search, search);
    }
    if (operatorOnly && (!statusFilter || statusFilter === "Todos")) filterParts.push(`upper(trim(coalesce(mp.mp_status, ''))) in ('LIBERADO', 'ABERTO', 'A CONCLUIR', 'SETUP A CONCLUIR'${coladeiraMachine ? ", 'PARCIAL'" : ""})`);
    if (statusFilter && statusFilter !== "Todos") {
      const statusGroups = {
        "A Lib/Lib/Parcial": ["A LIBERAR", "LIBERADO", "PARCIAL"],
        "Liberado/Parcial/Em Produção": ["LIBERADO", "PARCIAL", "EM PRODUÇÃO"],
        "A Liberar": ["A LIBERAR"],
        "Atendido": ["ATENDIDO"],
        "Liberado": ["LIBERADO"],
        "Em Produção": ["EM PRODUÇÃO"],
        "Parcial": ["PARCIAL"],
        "Setup Cancelado": ["SETUP CANCELADO"],
      };
      const statuses = statusGroups[statusFilter] ?? [statusFilter.toLocaleUpperCase("pt-BR")];
      filterParts.push(`upper(trim(coalesce(mp.mp_status, ''))) in (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }
    const filter = filterParts.join(" and ");
    const result = await paged(
      (limit, offset) => `select first ${limit} skip ${offset}
        mp.op_codigo, mp.mp_codigo, mp.pv_codigo as product_code, mp.mqp_codigo as machine_code, mp.mp_fila as fila, mp.mp_status as status,
        mp.mp_data as data, mp.mp_data_expedicao as shipment_date, mp.mp_data_entrega as data_entrega, mp.mp_saldo as saldo, mp.mp_qtde_produzida as quantidade_produzida,
        mp.mp_qtde_perdida as quantidade_perdida, mp.mp_qtde_op as quantity, mp.mp_posicao as queue_position, mp.mp_referencia as referencia,
        coalesce(mp.mp_fantasia, p.pes_fantasia, mp.mp_cliente) as client, coalesce((select first 1 er_status.er_situacao from estoque_reservado er_status where er_status.op_codigo = mp.op_codigo order by er_status.er_codigo), mp.mp_status_feramental) as reserved_status, mp.mp_posicao as process_position, mp.mp_situacao_lib as process_situation, mp.mp_op_mestre as master_order, mq.mqp_descricao as processo, pv.pv_referencia as produto_referencia,
        pv.pv_cod_prod_cli as customer_product_code, mp.pv_revisao as revision, pv.pv_ajuste_larg as adjustment_width, pv.pv_ajuste_comp as adjustment_length, pv.pv_total_larg_cn as adjustment_width_total, pv.pv_total_comp_cn as adjustment_length_total, op.op_especial as special_code, coalesce(op.op_principal, 'N') as special_primary,
        (select first 1 case when sum(ers.ers_quantidade) is null then 'Não Solicitado'
          when position('Solicitado' in list(ers.ers_status)) > 0 then 'Solicitado'
          when position('Separado' in list(ers.ers_status)) > 0 then 'Separado'
          when position('Transbordo' in list(ers.ers_status)) > 0 then 'Transbordo'
          when position('Atendido' in list(ers.ers_status)) > 0 then 'Atendido' end
          from estoque_reservado er2 left join estoque_reservado_solicitacoes ers on ers.op_codigo = er2.op_codigo and ers.er_codigo = er2.er_codigo where er2.op_codigo = mp.op_codigo) as request_status
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      inner join ordens_producao op on op.op_codigo = mp.op_codigo
      left join pessoa p on p.pes_codigo = op.pes_codigo
      left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
      where ${filter}
      order by case when mp.mp_status = 'A Concluir' then 0 when mp.mp_status = 'Setup a Concluir' then 1 else 2 end, mp.mp_fila, mp.op_codigo`,
      `select count(*) as total from mov_processos mp inner join ordens_producao op on op.op_codigo = mp.op_codigo left join pessoa p on p.pes_codigo = op.pes_codigo left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao where ${filter}`,
      params,
      req,
    );
    res.json({
      ...result,
      items: result.items.map((row) => ({
        ...row,
        productCode: row.product_code == null ? null : Number(row.product_code),
        revision: row.revision == null ? null : Number(row.revision),
        client: row.client ?? null,
        customerProductCode: row.customer_product_code ?? null,
        shipmentDate: row.shipment_date ?? null,
        deliveryDate: row.data_entrega ?? null,
        processPosition: row.process_position ?? null,
        processSituation: row.process_situation ?? null,
        reservedStatus: row.reserved_status ?? null,
        requestStatus: row.request_status ?? null,
        adjustmentWidth: row.adjustment_width ?? null,
        adjustmentLength: row.adjustment_length ?? null,
        adjustmentWidthTotal: row.adjustment_width_total ?? null,
        adjustmentLengthTotal: row.adjustment_length_total ?? null,
        master_order: row.master_order == null ? null : Number(row.master_order),
        specialCode: Number(row.special_code ?? row.SPECIAL_CODE ?? 0) || null,
        specialPrimary: specialSetMachine && (Number(row.special_code ?? row.SPECIAL_CODE ?? 0) || 0) > 0 && String(row.special_primary ?? row.SPECIAL_PRIMARY ?? "N").trim().toUpperCase() !== "N",
      })),
    });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/special-production", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.query.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados inválidos para Produção Especial." });
    const processRows = await query(`select first 1 mp.op_codigo, mq.mqp_descricao as description, mq.mqp_processo_manual as manual_process, gm.gmq_grupo as group_description from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const process = processRows[0];
    if (!process) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    if (!isSpecialProductionMachine({ description: process.description ?? process.DESCRIPTION, manualProcess: String(process.manual_process ?? process.MANUAL_PROCESS ?? "N").toUpperCase() === "S", groupDescription: process.group_description ?? process.GROUP_DESCRIPTION ?? null })) return res.json({ isSpecial: false, specialCode: null, primaryOpCode: opCodigo, components: [] });
    res.json(await getSpecialProductionDetails(query, opCodigo, machineCode));
  } catch (error) { next(error); }
});

app.get("/v1/programming/machines", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`select mqp.mqp_codigo as code, mqp.mqp_descricao as description, mqp.mqp_processo_manual as manual_process
      from maquinas_processos mqp
      where mqp.mqp_processo_controlado = 'S'
      order by mqp.mqp_descricao`);
    res.json(rows.map((row) => ({
      code: Number(row.code),
      description: String(row.description ?? "Máquina sem descrição").trim(),
      manualProcess: row.manual_process == null ? null : String(row.manual_process).trim(),
    })));
  } catch (error) { next(error); }
});

app.get("/v1/programming/cleaning-reasons", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const rows = await query(`select mo.mo_codigo as code, mo.mo_descricao as description
      from motivos mo
      where mo.mo_status = 'Ativo'
        and (upper(coalesce(mo.mo_tipo, '')) containing 'LIMPEZA' or upper(coalesce(mo.mo_descricao, '')) containing 'LIMPEZA')
        and (mo.mo_todas_maquinas = 'S' or mo.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?))
      order by mo.mo_descricao`, [machineCode]);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Motivo de limpeza") })));
  } catch (error) { next(error); }
});

app.post("/v1/programming/idle-event", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A gravação de ociosidade está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma máquina de teste." });
    const machineCode = Number(req.body?.machineCode);
    const operatorId = Number(req.body?.operatorId);
    const eventType = String(req.body?.eventType ?? "").trim();
    const reasonCode = eventType === "cleaning" ? Number(req.body?.reasonCode) : 63;
    if (![machineCode, operatorId, reasonCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados inválidos para registrar a ociosidade." });
    if (!["cleaning", "end-period"].includes(eventType)) return res.status(400).json({ error: "Tipo de encerramento inválido." });

    const result = await withTransaction(async (transaction) => {
      if (eventType === "cleaning") {
        const reasonRows = await transaction.queryAsync(`select first 1 mo_codigo as code from motivos
          where mo_codigo = ? and mo_status = 'Ativo'
            and (upper(coalesce(mo_tipo, '')) containing 'LIMPEZA' or upper(coalesce(mo_descricao, '')) containing 'LIMPEZA')`, [reasonCode]);
        if (!reasonRows[0]) throw Object.assign(new Error("O motivo de limpeza selecionado não está ativo."), { statusCode: 409 });
      }
      const clockRows = await transaction.queryAsync("select current_date as event_date, current_timestamp as event_clock from rdb$database");
      const eventDate = clockRows[0]?.event_date ?? clockRows[0]?.EVENT_DATE;
      const eventClock = clockRows[0]?.event_clock ?? clockRows[0]?.EVENT_CLOCK;
      await transaction.queryAsync(`insert into motivo_ociosidade (mqp_codigo, mo_codigo, mto_data, mto_hora_inicio, usu_codigo, mto_hora_fim)
        values (?, ?, ?, ?, ?, ?)`, [machineCode, reasonCode, eventDate, eventClock, operatorId, eventClock]);
      await transaction.queryAsync(`update contador_diario_processos set cdp_cronometro = ?
        where mqp_codigo = ? and cdp_status = 'Iniciado'`, [eventClock, machineCode]);
      await transaction.queryAsync("update maquinas_processos set mqp_status_processo = 'Em Fila' where mqp_codigo = ?", [machineCode]);
      return { eventType, reasonCode, recordedAt: eventClock };
    });
    res.json({ success: true, ...result });
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/programming/active", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const rows = await query(`select first 1
      mp.op_codigo as op_code, mp.mp_codigo as mp_code, mp.mp_status as status,
      mp.mp_fila as queue, mp.mp_referencia as reference, mq.mqp_descricao as machine_description
      from mov_processos mp
      inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      where mp.mqp_codigo = ? and upper(trim(coalesce(mp.mp_status, ''))) containing 'PRODU'
      order by mp.mp_inicio desc, mp.mp_codigo desc`, [machineCode]);
    const active = rows[0];
    res.json(active ? {
      opCodigo: Number(active.op_code), mpCodigo: Number(active.mp_code), status: active.status ?? "Em Produção",
      queue: active.queue == null ? null : Number(active.queue), reference: active.reference ?? null,
      machineDescription: active.machine_description ?? null,
    } : null);
  } catch (error) { next(error); }
});

app.get("/v1/programming/processes", ensureAuthorized, async (_req, res, next) => {
  try {
    const rows = await query(`select mqp_codigo as code, mqp_descricao as description, gmq_codigo as group_code from maquinas_processos order by mqp_descricao`);
    res.json(rows.map((row) => ({ code: Number(row.code), description: String(row.description ?? "Sem descrição"), groupCode: row.group_code == null ? null : Number(row.group_code) })));
  } catch (error) { next(error); }
});

app.get("/v1/queue", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    const search = String(req.query.search ?? "").trim();
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const filterParts = ["mp.mqp_codigo = ?", "mp.mp_fila < 1000"];
    const params = [machineCode];
    if (search) {
      filterParts.push("(cast(mp.op_codigo as varchar(20)) containing ? or cast(mp.pv_codigo as varchar(20)) containing ? or coalesce(mp.mp_referencia, '') containing ? or coalesce(pv.pv_referencia, '') containing ?)");
      params.push(search, search, search, search);
    }
    const filter = filterParts.join(" and ");
    const result = await paged(
      (limit, offset) => `select first ${limit} skip ${offset}
        mp.mp_fila as queue, mp.op_codigo as op_code, mp.mp_codigo as mp_code,
        mp.pv_codigo as product_code, mp.pv_revisao as revision, mp.mp_referencia as reference,
        mp.mp_fantasia as customer, mp.mp_qtde_op as quantity, mp.mp_data_expedicao as shipment_date,
        mp.mp_data_entrega as delivery_date, mp.mp_status as status, mp.mp_op_mestre as master_order,
        mq.mqp_descricao as machine_description, pv.pv_ajuste_larg as adjustment_width,
        pv.pv_ajuste_comp as adjustment_length, pv.pv_caminho_desenho as layout_path,
        coalesce((select count(*) from prod_vendas_cores pvc where pvc.pv_codigo = mp.pv_codigo and pvc.pv_revisao = mp.pv_revisao), 0) as color_count,
        (select first 1 er.er_situacao from estoque_reservado er where er.op_codigo = mp.op_codigo) as reservation_status,
        (select first 1 case when sum(ers.ers_quantidade) is null then 'Não Solicitado'
          when position('Solicitado' in list(ers.ers_status)) > 0 then 'Solicitado'
          when position('Separado' in list(ers.ers_status)) > 0 then 'Separado'
          when position('Transbordo' in list(ers.ers_status)) > 0 then 'Transbordo'
          when position('Atendido' in list(ers.ers_status)) > 0 then 'Atendido' end
          from estoque_reservado er2 left join estoque_reservado_solicitacoes ers on ers.op_codigo = er2.op_codigo and ers.er_codigo = er2.er_codigo where er2.op_codigo = mp.op_codigo) as reservation_request_status
        from mov_processos mp
        inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
        left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
        where ${filter}
        order by mp.mp_fila, mp.op_codigo`,
      `select count(*) as total from mov_processos mp left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao where ${filter}`,
      params,
      req,
    );
    res.json({ ...result, items: result.items.map((row) => ({
      queue: row.queue == null ? null : Number(row.queue), opCode: Number(row.op_code), mpCode: Number(row.mp_code),
      productCode: row.product_code == null ? null : Number(row.product_code), revision: row.revision == null ? null : Number(row.revision),
      reference: row.reference ?? null, customer: row.customer ?? null, quantity: row.quantity == null ? null : Number(row.quantity),
      shipmentDate: row.shipment_date ?? null, deliveryDate: row.delivery_date ?? null, status: row.status ?? null,
      reservationStatus: row.reservation_status ?? null, reservationRequestStatus: row.reservation_request_status ?? null,
      machineDescription: row.machine_description ?? null, adjustmentWidth: row.adjustment_width ?? null, adjustmentLength: row.adjustment_length ?? null,
      colorCount: Number(row.color_count ?? 0), layoutPath: row.layout_path ?? null, masterOrder: row.master_order == null ? null : Number(row.master_order),
    })) });
  } catch (error) { next(error); }
});

app.get("/v1/queue/:opCodigo/processes", ensureAuthorized, async (req, res, next) => {
  try {
    const opCode = Number(req.params.opCodigo);
    const masterOrder = Number(req.query.masterOrder ?? 0);
    if (!Number.isInteger(opCode) || opCode < 1) return res.status(400).json({ error: "OP inválida." });
    const rows = await query(`select mp.mqp_codigo as machine_code, mq.mqp_descricao as machine_description,
      mp.mp_status as status, mp.mp_fila as queue, mp.op_codigo as op_code, mp.mp_codigo as mp_code
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      where mp.op_codigo = ? and mp.mp_op_mestre = ?
      order by mp.mp_codigo`, [opCode, masterOrder]);
    res.json(rows.map((row) => ({
      machineCode: Number(row.machine_code), machineDescription: String(row.machine_description ?? "Máquina sem descrição"),
      status: row.status ?? null, queue: row.queue == null ? null : Number(row.queue), opCode: Number(row.op_code), mpCode: Number(row.mp_code),
    })));
  } catch (error) { next(error); }
});

app.get("/v1/queue/:opCodigo/reservations", ensureAuthorized, async (req, res, next) => {
  try {
    const opCode = Number(req.params.opCodigo);
    if (!Number.isInteger(opCode) || opCode < 1) return res.status(400).json({ error: "OP inválida." });
    const rows = await query(`select
      cast(er.pc_codigo as varchar(20)) || ' - ' || cast(er.pcf_codigo as varchar(20)) as product,
      er.er_lote as lot, cast(pc.pc_largura as varchar(20)) || ' x ' || cast(pc.pc_comprimento as varchar(20)) as measures,
      cast(er.er_arranjo_l as numeric(9,1)) || ' x ' || cast(er.er_arranjo_c as numeric(9,1)) as arrangement,
      er.pc_tipo as board_type, cp.cps_descricao as composition, er.er_quantidade as quantity, er.er_saldo as balance
      from estoque_reservado er
      inner join produtos_compras pc on pc.pc_codigo = er.pc_codigo
      inner join prod_compras_fornecedor pcf on pcf.pcf_codigo = er.pcf_codigo and pcf.pc_codigo = er.pc_codigo
      inner join composicao cp on cp.cps_codigo = pcf.cps_codigo and cp.cint_codigo = pcf.cint_codigo
      where er.er_saldo > 0 and er.op_codigo = ? order by er.er_codigo`, [opCode]);
    res.json(rows.map((row) => ({ product: row.product ?? null, lot: row.lot ?? null, measures: row.measures ?? null, arrangement: row.arrangement ?? null, boardType: row.board_type ?? null, composition: row.composition ?? null, quantity: row.quantity == null ? null : Number(row.quantity), balance: row.balance == null ? null : Number(row.balance) })));
  } catch (error) { next(error); }
});

app.get("/v1/requests/sectors", ensureAuthorized, async (req, res, next) => {
  try {
    const rows = await query(`select se.se_codigo as code, se.se_descricao as description, se.ae_codigo as area_code
      from setores_empresa se
      where se.se_status = 'Ativo' and se.ae_codigo in (3, 9)
      order by se.se_descricao`);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Sem descrição"), areaCode: row.area_code ?? row.AREA_CODE ?? null })));
  } catch (error) { next(error); }
});

app.post("/v1/requests", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de solicitações está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma solicitação de teste." });
    const type = String(req.body?.type ?? ""); const requesterId = Number(req.body?.requesterId); const requesterSectorCode = Number(req.body?.requesterSectorCode) || null; const machineCode = Number(req.body?.machineCode) || null; const description = String(req.body?.description ?? "").trim();
    if (!["maintenance", "development"].includes(type) || !Number.isInteger(requesterId) || requesterId < 1 || description.length < 3 || description.length > 300) return res.status(400).json({ error: "Dados da solicitação inválidos." });
    const targetSectorName = type === "maintenance" ? "Manutenção" : "Desenvolvimento";
    const sectorRows = await query(`select first 1 se_codigo as code from setores_empresa where se_status = 'Ativo' and upper(se_descricao) = upper(?) order by se_codigo`, [targetSectorName]);
    const targetSectorCode = Number(sectorRows[0]?.code ?? sectorRows[0]?.CODE ?? 0);
    if (!Number.isInteger(targetSectorCode) || targetSectorCode < 1) return res.status(409).json({ error: `O setor ativo ${targetSectorName} não foi encontrado na tabela SETORES.` });
    const ids = await query(`select coalesce(max(sol_codigo), 0) + 1 as id from solicitacoes`);
    const code = Number(ids[0]?.id ?? ids[0]?.ID ?? 1);
    await query(`insert into solicitacoes (sol_codigo, sol_setor_solicitado, sol_data_solicitacao, sol_solicitante, sol_status, sol_setor_para, sol_descricao_solicitacao, mqp_codigo) values (?, ?, current_date, ?, 'Aberto', ?, ?, ?)`, [code, requesterSectorCode, requesterId, targetSectorCode, description, machineCode]);
    res.status(201).json({ success: true, code, status: "Aberto" });
  } catch (error) { next(error); }
});

app.patch("/v1/programming/:opCodigo/:mpCodigo/process", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de processo inválidos." });
    const current = await query(`select first 1 mp_status, pv_codigo, pv_revisao, mqp_codigo from mov_processos where op_codigo = ? and mp_codigo = ?`, [opCodigo, mpCodigo]);
    if (!current[0]) return res.status(404).json({ error: "Ordem não encontrada." });
    if (["Atendido", "A Concluir"].includes(String(current[0].mp_status))) return res.status(409).json({ error: "Não é permitido alterar o processo de uma ordem Atendida ou A Concluir." });
    if (String(current[0].mp_status) === "Setup a Concluir") return res.status(409).json({ error: "Não é permitido alterar o processo de uma ordem Setup a Concluir." });
    const eligible = await query(`select first 1 candidate.mqp_codigo as code
      from prod_vendas_proc_prod pvp
      inner join maquinas_processos candidate on candidate.mqp_codigo = pvp.mqp_codigo
      inner join maquinas_processos current_machine on current_machine.mqp_codigo = ?
      where pvp.pv_codigo = ? and pvp.pv_revisao = ? and candidate.mqp_codigo = ? and candidate.mqp_codigo <> ?
        and (candidate.gmq_codigo = current_machine.gmq_codigo or candidate.gmq_codigo = case when current_machine.gmq_codigo = 4 then 6 when current_machine.gmq_codigo = 6 then 4 else 0 end)`,
    [Number(current[0].mqp_codigo), Number(current[0].pv_codigo), Number(current[0].pv_revisao), machineCode, Number(current[0].mqp_codigo)]);
    if (!eligible[0]) return res.status(409).json({ error: "A máquina selecionada não é elegível para o produto, revisão e grupo produtivo desta OP." });
    const queues = await query(`select coalesce(max(mp_fila), 0) + 1 as queue from mov_processos where mqp_codigo = ? and mp_fila < 1000`, [machineCode]);
    const queue = Number(queues[0]?.queue ?? 1);
    await query(`update mov_processos set mqp_codigo = ?, mp_fila = ?, mp_status = 'Liberado' where op_codigo = ? and mp_codigo = ?`, [machineCode, queue, opCodigo, mpCodigo]);
    res.json({ success: true, queue });
  } catch (error) { next(error); }
});

app.get("/v1/programming/:opCodigo/:mpCodigo/eligible-machines", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo);
    const mpCodigo = Number(req.params.mpCodigo);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de processo inválidos." });
    const rows = await query(`select distinct candidate.mqp_codigo as code, candidate.mqp_descricao as description
      from mov_processos source
      inner join maquinas_processos current_machine on current_machine.mqp_codigo = source.mqp_codigo
      inner join prod_vendas_proc_prod pvp on pvp.pv_codigo = source.pv_codigo and pvp.pv_revisao = source.pv_revisao
      inner join maquinas_processos candidate on candidate.mqp_codigo = pvp.mqp_codigo
      where source.op_codigo = ? and source.mp_codigo = ? and candidate.mqp_codigo <> source.mqp_codigo
        and (candidate.gmq_codigo = current_machine.gmq_codigo or candidate.gmq_codigo = case when current_machine.gmq_codigo = 4 then 6 when current_machine.gmq_codigo = 6 then 4 else 0 end)
      order by candidate.mqp_descricao`, [opCodigo, mpCodigo]);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Máquina sem descrição") })));
  } catch (error) { next(error); }
});

app.patch("/v1/programming/:opCodigo/:mpCodigo/queue", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo);
    const mpCodigo = Number(req.params.mpCodigo);
    const machineCode = Number(req.body?.machineCode);
    const targetQueue = Number(req.body?.queue);
    if (![opCodigo, mpCodigo, machineCode, targetQueue].every((value) => Number.isInteger(value) && value > 0)) {
      return res.status(400).json({ error: "Informe uma posição de fila válida." });
    }

    const result = await withTransaction(async (transaction) => {
      const currentRows = await transaction.queryAsync(`select first 1 mqp_codigo as machine_code, mp_fila as queue, mp_status as status
        from mov_processos where op_codigo = ? and mp_codigo = ?`, [opCodigo, mpCodigo]);
      const current = currentRows[0];
      if (!current) throw Object.assign(new Error("Ordem de produção não encontrada."), { statusCode: 404 });

      const currentMachineCode = Number(current.machine_code ?? current.MACHINE_CODE);
      const currentQueue = Number(current.queue ?? current.QUEUE);
      const currentStatus = String(current.status ?? current.STATUS ?? "").trim();
      const releasedFromQueue2000 = currentStatus.toLocaleLowerCase("pt-BR") === "a liberar" && currentQueue === 2000 && targetQueue < 2000;
      const releasedFromPartial = currentStatus.toLocaleLowerCase("pt-BR") === "parcial";
      const nextStatus = releasedFromQueue2000 || releasedFromPartial ? "Liberado" : currentStatus;
      if (currentMachineCode !== machineCode) throw Object.assign(new Error("O processo não pertence à máquina selecionada."), { statusCode: 409 });
      if (["A Concluir", "Setup a Concluir"].includes(currentStatus)) {
        throw Object.assign(new Error(`Não é permitido alterar a fila da ordem de produção com status "${currentStatus}".`), { statusCode: 409 });
      }
      if (!Number.isInteger(currentQueue) || currentQueue < 1) throw Object.assign(new Error("A ordem não possui uma posição de fila válida."), { statusCode: 409 });
      if (targetQueue === currentQueue) throw Object.assign(new Error("Não é permitido alterar uma fila para ela mesma."), { statusCode: 409 });
      if (targetQueue > currentQueue) throw Object.assign(new Error("Não é permitido alterar para uma fila maior que ela mesma."), { statusCode: 409 });

      if (targetQueue === 1) {
        const priorityRows = await transaction.queryAsync(`select mp_status as status from mov_processos
          where mqp_codigo = ? and mp_fila = 1 and not (op_codigo = ? and mp_codigo = ?)`, [machineCode, opCodigo, mpCodigo]);
        const priorityStatuses = priorityRows.map((row) => String(row.status ?? row.STATUS ?? "").trim());
        if (priorityStatuses.includes("Em Produção")) {
          throw Object.assign(new Error("Existe um processo em produção na fila 1."), { statusCode: 409 });
        }
        if (priorityStatuses.includes("A Concluir")) {
          throw Object.assign(new Error("Existe um processo A Concluir na fila 1."), { statusCode: 409 });
        }
        if (priorityStatuses.includes("Setup a Concluir")) {
          throw Object.assign(new Error("Existe um processo Setup a Concluir na fila 1."), { statusCode: 409 });
        }
      }

      const temporaryOffset = 1000000;
      await transaction.queryAsync(`update mov_processos set mp_fila = mp_fila + ?
        where mqp_codigo = ? and mp_fila >= ? and mp_fila < ? and not (op_codigo = ? and mp_codigo = ?)`,
      [temporaryOffset, machineCode, targetQueue, currentQueue, opCodigo, mpCodigo]);
      await transaction.queryAsync(`update mov_processos set mp_fila = ?, mp_status = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`,
      [targetQueue, nextStatus, opCodigo, mpCodigo, machineCode]);
      await transaction.queryAsync(`update mov_processos set mp_fila = mp_fila - ?
        where mqp_codigo = ? and mp_fila >= ? and mp_fila < ?`,
      [temporaryOffset - 1, machineCode, targetQueue + temporaryOffset, currentQueue + temporaryOffset]);
      return { success: true, queue: targetQueue, status: nextStatus, releasedFromQueue2000, releasedFromPartial };
    });

    res.json(result);
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/print-layout", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de layout inválidos." });
    const rows = await query(`select first 1 mp.pv_codigo as product_code, mp.pv_revisao as revision, pv.pv_caminho_desenho as layout_path, pv.pv_cliche_pc_solta as loose_plate,
      fc.av_codigo as cliche_asset_code, fc.fc_serie as cliche_series,
      fc2.av_codigo as cliche_asset_code2, fc2.fc_serie as cliche_series2,
      fc3.av_codigo as cliche_asset_code3, fc3.fc_serie as cliche_series3,
      ff.av_codigo as faca_asset_code, ff2.av_codigo as faca_asset_code2, ff3.av_codigo as faca_asset_code3
      from mov_processos mp
      inner join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
      left join ferramental_cliche fc on fc.fc_codigo = pv.fc_codigo
      left join ferramental_cliche fc2 on fc2.fc_codigo = pv.fc_codigo2
      left join ferramental_cliche fc3 on fc3.fc_codigo = pv.fc_codigo3
      left join ferramental_faca ff on ff.ff_codigo = pv.ff_codigo
      left join ferramental_faca ff2 on ff2.ff_codigo = pv.ff_codigo2
      left join ferramental_faca ff3 on ff3.ff_codigo = pv.ff_codigo3
      where mp.op_codigo = ? and mp.mp_codigo = ?`, [opCodigo, mpCodigo]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Layout não encontrado para o processo atual." });
    const productCode = Number(row.product_code ?? row.PRODUCT_CODE); const revision = Number(row.revision ?? row.REVISION);
    const colorRows = await query(`select pvc.pvc_ordem as color_order, cor.cor_descricao as description, cor.cor_hex_branco as hex_white, cor.cor_hex_kraft as hex_kraft
      from prod_vendas_cores pvc inner join cores cor on cor.cor_codigo = pvc.cor_codigo
      where pvc.pv_codigo = ? and pvc.pv_revisao = ? order by pvc.pvc_ordem asc`, [productCode, revision]);
    const field = (prefix, suffix = "") => row[`${prefix}${suffix}`] ?? row[`${prefix}${suffix}`.toUpperCase()];
    const cliches = ["", "2", "3"].map((suffix) => ({ code: Number(field("cliche_asset_code", suffix) ?? 0), series: String(field("cliche_series", suffix) ?? "").trim() })).filter((asset) => asset.code > 0);
    const facas = ["", "2", "3"].map((suffix) => ({ code: Number(field("faca_asset_code", suffix) ?? 0) })).filter((asset) => asset.code > 0);
    const layoutPath = String(row.layout_path ?? row.LAYOUT_PATH ?? "").trim();
    let svgDataUri = null; let layoutError = null;
    if (layoutPath) {
      if (path.extname(layoutPath).toLowerCase() !== ".svg") layoutError = "O arquivo de layout cadastrado não é SVG.";
      else try { const svg = await readFile(layoutPath); svgDataUri = `data:image/svg+xml;base64,${svg.toString("base64")}`; } catch { layoutError = "Não foi possível abrir o SVG no caminho cadastrado da ficha de impressão."; }
    }
    res.json({ productCode, revision, svgDataUri, layoutAvailable: Boolean(svgDataUri), layoutError, loosePlate: String(row.loose_plate ?? row.LOOSE_PLATE ?? "").trim() || null, cliches, facas, colors: colorRows.map((color) => ({ order: Number(color.color_order ?? color.COLOR_ORDER), description: String(color.description ?? color.DESCRIPTION ?? ""), hexWhite: color.hex_white ?? color.HEX_WHITE ?? null, hexKraft: color.hex_kraft ?? color.HEX_KRAFT ?? null })) });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/palletization", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de Pacotes / Paletização inválidos." });
    const rows = await query(`select first 1
      pvp.pes_codigo as customer_code,
      pvp.pvp_pacote_tipo as package_type, pvp.pvp_pacote_larg as package_width, pvp.pvp_pacote_comp as package_length,
      pvp.pvp_pacote_alt as package_height, pvp.pvp_pacote_quantidade as package_quantity, pvp.pvp_pacote_peso as package_weight,
      pvp.pvp_pacote_fitas_larg as package_straps_width, pvp.pvp_pacote_fitas_comp as package_straps_length,
      pvp.pvp_paletizado as palletized, pvp.pvp_remontado as remounted, pvp.palete_codigo as pallet_code, pvp.lastro_codigo as layer_code,
      pal.palete_descricao as pallet_description, pal.palete_comprimento as pallet_length, pal.palete_largura as pallet_width, pal.palete_altura as pallet_height, pal.palete_json as pallet_image_path,
      las.lastro_descricao as layer_description, las.lastro_json as layer_image_path, pvp.pvp_palete_pacote_lastro as packages_per_layer,
      pvp.pvp_palete_pacote_altura as packages_high, pvp.pvp_palete_pacote_altura_max as maximum_height,
      pvp.pvp_palete_pacote_total as total_packages, pvp.pvp_palete_total_produtos as total_products,
      pvp.pvp_palete_aproveit_area as area_use, pvp.pvp_palete_aproveit_porc as area_percent,
      pvp.pvp_palete_arqueado as arched, pvp.pvp_palete_espelhado as mirrored,
      pvp.pvp_palete_cantoneira as corner_protector, pvp.pvp_palete_filme_stretch as stretch_film,
      pvp.pvp_palete_fitas_larg as pallet_straps_width, pvp.pvp_palete_fitas_comp as pallet_straps_length,
      pvp.pvp_palete_etiquetas_larg as label_width, pvp.pvp_palete_etiquetas_comp as label_length,
      pvp.pvp_observacao as observation
      from mov_processos mp
      inner join prod_vendas_paletizacao pvp on pvp.pv_codigo = mp.pv_codigo and pvp.pv_revisao = mp.pv_revisao
      left join palete pal on pal.palete_codigo = pvp.palete_codigo
      left join lastro las on las.lastro_codigo = pvp.lastro_codigo
      where mp.op_codigo = ? and mp.mp_codigo = ?
        and (pvp.pes_codigo = mp.pes_codigo or (pvp.pes_codigo = 0 and not exists (
          select 1 from prod_vendas_paletizacao pvp2
          where pvp2.pv_codigo = pvp.pv_codigo and pvp2.pv_revisao = pvp.pv_revisao and pvp2.pes_codigo = mp.pes_codigo
        )))
      order by case when pvp.pes_codigo = mp.pes_codigo then 0 else 1 end, pvp.pvp_codigo`, [opCodigo, mpCodigo]);
    const row = rows[0];
    if (!row) return res.json({ registered: false, customerSpecific: false, palletized: false });
    const field = (name) => row[name] ?? row[name.toUpperCase()] ?? null;
    const number = (name) => { const value = field(name); return value == null || value === "" ? null : Number(value); };
    const yes = (name) => ["S", "SIM", "1", "TRUE", "T", "Y", "YES"].includes(String(field(name) ?? "").trim().toUpperCase());
    const customerCode = Number(field("customer_code") ?? 0);
    const palletImagePath = String(field("pallet_image_path") ?? "").trim();
    const layerImagePath = String(field("layer_image_path") ?? "").trim();
    const palletDetailsAvailable = ["pallet_code", "layer_code", "pallet_description", "pallet_length", "pallet_width", "pallet_height", "packages_per_layer", "packages_high", "maximum_height", "total_packages", "total_products", "pallet_image_path", "layer_image_path"].some((name) => {
      const value = field(name);
      return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "0";
    });
    const palletized = yes("palletized") || palletDetailsAvailable;
    const imageMimeTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
    const readImageDataUri = async (imagePath, label) => {
      if (!imagePath) return { dataUri: null, error: null };
      const imageExtension = path.extname(imagePath).toLowerCase();
      if (!imageMimeTypes[imageExtension]) return { dataUri: null, error: `A imagem cadastrada para ${label} deve ser JPG, PNG ou SVG.` };
      try { const image = await readFile(imagePath); return { dataUri: `data:${imageMimeTypes[imageExtension]};base64,${image.toString("base64")}`, error: null }; }
      catch { return { dataUri: null, error: `Não foi possível abrir a imagem de ${label} no caminho cadastrado.` }; }
    };
    const palletImage = await readImageDataUri(palletImagePath, "o palete");
    const layerImage = await readImageDataUri(layerImagePath, "o lastro de amarração");
    res.json({
      registered: true, customerSpecific: customerCode > 0,
      packageType: field("package_type"), packageWidth: number("package_width"), packageLength: number("package_length"), packageHeight: number("package_height"), packageQuantity: number("package_quantity"), packageWeight: number("package_weight"), packageStrapsWidth: number("package_straps_width"), packageStrapsLength: number("package_straps_length"),
      palletized, remounted: yes("remounted"), palletDescription: field("pallet_description"), palletLength: number("pallet_length"), palletWidth: number("pallet_width"), palletHeight: number("pallet_height"), layerDescription: field("layer_description"), packagesPerLayer: number("packages_per_layer"), packagesHigh: number("packages_high"), maximumHeight: number("maximum_height"), totalPackages: number("total_packages"), totalProducts: number("total_products"), areaUse: number("area_use"), areaPercent: number("area_percent"), arched: yes("arched"), mirrored: yes("mirrored"), cornerProtector: yes("corner_protector"), stretchFilm: yes("stretch_film"), palletStrapsWidth: number("pallet_straps_width"), palletStrapsLength: number("pallet_straps_length"), labelWidth: number("label_width"), labelLength: number("label_length"), observation: field("observation"), palletImageDataUri: palletImage.dataUri, palletImageError: palletImage.error, layerImageDataUri: layerImage.dataUri, layerImageError: layerImage.error, imageDataUri: palletImage.dataUri ?? layerImage.dataUri, imageError: palletImage.error ?? layerImage.error,
    });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/rpnc", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.query.machineCode); const origin = String(req.query.origin ?? "");
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0) || !["product", "raw-material"].includes(origin)) return res.status(400).json({ error: "Dados de RPNC inválidos." });
    const originLabel = origin === "raw-material" ? "Materia-prima (PO)" : "Produto";
    const inspectionType = origin === "raw-material" ? "Inspeção de Recebimento" : "Liberação de Produto";
    const processRows = await query(`select first 1 mp.op_codigo, mp.mp_codigo, mp.pv_codigo, mp.pv_revisao
      from mov_processos mp where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    if (!processRows[0]) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const checklistRows = await query(`select cl.cl_codigo as checklist_code, cl.cl_descricao as description, cl.cl_descricao_completa as full_description,
      cl.cl_status as status, cl.cl_tipo_inspecao as inspection_type
      from check_list cl where cl.cl_tipo_formulario = ? order by cl.cl_codigo`, [inspectionType]);
    const checklists = [];
    for (const checklist of checklistRows) {
      const checklistCode = Number(checklist.checklist_code ?? checklist.CHECKLIST_CODE);
      const rows = await query(`select icl.icl_codigo as item_code, icl.cl_codigo as checklist_code, icl.icl_descricao as description,
        icl.icl_definicao as definition, icl.icl_caminho_doc as document_path, icl.icl_status as status,
        ca.ca_codigo as cause_code, ca.ca_descricao as cause_description, ca.ca_status as cause_status
        from itens_check_list icl
        left join causa_aparente ca on ca.cl_codigo = icl.cl_codigo and ca.icl_codigo = icl.icl_codigo
        where icl.cl_codigo = ? order by icl.icl_codigo, ca.ca_codigo`, [checklistCode]);
      const itemMap = new Map();
      for (const row of rows) {
        const itemCode = Number(row.item_code ?? row.ITEM_CODE);
        if (!itemMap.has(itemCode)) itemMap.set(itemCode, {
          code: itemCode, checklistCode, description: String(row.description ?? row.DESCRIPTION ?? "Sem descrição"), definition: row.definition ?? row.DEFINITION ?? null,
          documentPath: row.document_path ?? row.DOCUMENT_PATH ?? null, status: row.status ?? row.STATUS ?? null, causes: [],
        });
        const causeCode = Number(row.cause_code ?? row.CAUSE_CODE);
        if (Number.isInteger(causeCode) && causeCode > 0) itemMap.get(itemCode).causes.push({ code: causeCode, description: String(row.cause_description ?? row.CAUSE_DESCRIPTION ?? "Sem descrição"), status: row.cause_status ?? row.CAUSE_STATUS ?? null });
      }
      checklists.push({ code: checklistCode, description: String(checklist.description ?? checklist.DESCRIPTION ?? "Sem descrição"), fullDescription: checklist.full_description ?? checklist.FULL_DESCRIPTION ?? null, status: checklist.status ?? checklist.STATUS ?? null, inspectionType: checklist.inspection_type ?? checklist.INSPECTION_TYPE ?? null, items: [...itemMap.values()] });
    }
    let lot = null; let supplierCode = null;
    if (origin === "raw-material") {
      const reservationRows = await query(`select first 1 coalesce(e.er_lote, '0') as lot, coalesce(cv.pes_codigo, 0) as supplier_code
        from estoque_reservado e left join controle_validade cv on cv.cv_lote_interno = e.er_lote
        where e.op_codigo = ?`, [opCodigo]);
      lot = reservationRows[0]?.lot ?? reservationRows[0]?.LOT ?? null;
      const supplier = Number(reservationRows[0]?.supplier_code ?? reservationRows[0]?.SUPPLIER_CODE ?? 0);
      supplierCode = supplier > 0 ? supplier : null;
    }
    res.json({ origin, originLabel, inspectionType, lot, supplierCode, checklists });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/rpnc", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const userId = Number(req.body?.userId); const employeeCode = Number(req.body?.employeeCode);
    const submission = req.body?.submission ?? {}; const origin = String(submission.origin ?? ""); const transitionToGeneralSampling = Boolean(submission.transitionToGeneralSampling); const selectedChecklists = Array.isArray(submission.checklists) ? submission.checklists : [];
    if (![opCodigo, mpCodigo, machineCode, userId, employeeCode].every((value) => Number.isInteger(value) && value > 0) || !["product", "raw-material"].includes(origin) || !selectedChecklists.length) return res.status(400).json({ error: "Dados de gravação do RPNC inválidos." });
    const normalizedItems = selectedChecklists.flatMap((checklist) => Array.isArray(checklist?.items) ? checklist.items.map((item) => ({ checklistCode: Number(checklist.checklistCode), itemCode: Number(item?.itemCode), quantity: Number(item?.quantity), causeCodes: [...new Set((Array.isArray(item?.causeCodes) ? item.causeCodes : []).map(Number))], containmentAction: String(item?.containmentAction ?? "").trim().slice(0, 1000) })) : []);
    if (!normalizedItems.length || normalizedItems.some((item) => !Number.isInteger(item.checklistCode) || item.checklistCode < 1 || !Number.isInteger(item.itemCode) || item.itemCode < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.causeCodes.some((code) => !Number.isInteger(code) || code < 1))) return res.status(400).json({ error: "Informe pelo menos uma não conformidade com quantidade válida." });
    const duplicatedItems = new Set();
    if (normalizedItems.some((item) => { const key = `${item.checklistCode}:${item.itemCode}`; if (duplicatedItems.has(key)) return true; duplicatedItems.add(key); return false; })) return res.status(400).json({ error: "Cada item não conforme pode ser informado somente uma vez." });
    const originLabel = origin === "raw-material" ? "Materia-prima (PO)" : "Produto";
    const inspectionType = origin === "raw-material" ? "Inspeção de Recebimento" : "Liberação de Produto";
    const result = await withTransaction(async (transaction) => {
      const processRows = await transaction.queryAsync(`select first 1 mp.pv_codigo as product_code, mp.pv_revisao as revision, mp.pes_codigo as customer_code, mp.mp_saldo as balance, mq.gmq_codigo as group_code, gm.gmq_grupo as machine_group
        from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
        where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
      const processRow = processRows[0];
      if (!processRow) throw Object.assign(new Error("Processo não encontrado para a máquina atual."), { statusCode: 404 });
      const productCode = Number(processRow.product_code ?? processRow.PRODUCT_CODE);
      const revision = Number(processRow.revision ?? processRow.REVISION);
      const customerCode = Number(processRow.customer_code ?? processRow.CUSTOMER_CODE ?? 0);
      if (transitionToGeneralSampling && (origin !== "product" || !isProductReleaseMachineGroup(processRow.machine_group ?? processRow.MACHINE_GROUP))) throw Object.assign(new Error("A Amostragem Geral só pode ser solicitada pela RPNC de Produto na Liberação de Produto."), { statusCode: 409 });
      const scheduleRows = await transaction.queryAsync(`select first 1 mph_codigo as schedule_code from mov_processos_horarios
        where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A' order by mph_codigo desc`, [opCodigo, mpCodigo, machineCode]);
      const scheduleCode = Number(scheduleRows[0]?.schedule_code ?? scheduleRows[0]?.SCHEDULE_CODE ?? 0);
      if (!Number.isInteger(scheduleCode) || scheduleCode < 1) throw Object.assign(new Error("Não há ciclo de produção ativo para registrar a RPNC."), { statusCode: 409 });
      for (const item of normalizedItems) {
        const itemRows = await transaction.queryAsync(`select first 1 icl.icl_codigo as item_code from itens_check_list icl
          inner join check_list cl on cl.cl_codigo = icl.cl_codigo
          where icl.icl_codigo = ? and icl.cl_codigo = ? and cl.cl_tipo_formulario = ?`, [item.itemCode, item.checklistCode, inspectionType]);
        if (!itemRows[0]) throw Object.assign(new Error("Um item do checklist não pertence ao tipo de RPNC selecionado."), { statusCode: 409 });
        for (const causeCode of item.causeCodes) {
          const causeRows = await transaction.queryAsync(`select first 1 ca_codigo as cause_code from causa_aparente where ca_codigo = ? and cl_codigo = ? and icl_codigo = ?`, [causeCode, item.checklistCode, item.itemCode]);
          if (!causeRows[0]) throw Object.assign(new Error("Uma causa aparente não pertence ao item não conforme selecionado."), { statusCode: 409 });
        }
      }
      let lot = null; let supplierCode = null;
      if (origin === "raw-material") {
        const reservationRows = await transaction.queryAsync(`select first 1 coalesce(e.er_lote, '0') as lot, coalesce(cv.pes_codigo, 0) as supplier_code
          from estoque_reservado e left join controle_validade cv on cv.cv_lote_interno = e.er_lote
          where e.op_codigo = ?`, [opCodigo]);
        lot = reservationRows[0]?.lot ?? reservationRows[0]?.LOT ?? null;
        const supplier = Number(reservationRows[0]?.supplier_code ?? reservationRows[0]?.SUPPLIER_CODE ?? 0);
        supplierCode = supplier > 0 ? supplier : null;
      }
      const personCode = origin === "raw-material" ? supplierCode : customerCode > 0 ? customerCode : null;
      const yearRows = await transaction.queryAsync("select extract(year from current_date) as current_year from rdb$database");
      const year = Number(yearRows[0]?.current_year ?? yearRows[0]?.CURRENT_YEAR);
      const rpncRows = await transaction.queryAsync("select coalesce(max(rpnc_codigo), 0) + 1 as rpnc_code from rpnc where rpnc_subcodigo = ?", [year]);
      const rpncCode = Number(rpncRows[0]?.rpnc_code ?? rpncRows[0]?.RPNC_CODE);
      const totalQuantity = normalizedItems.reduce((total, item) => total + item.quantity, 0);
      await transaction.queryAsync(`insert into rpnc (rpnc_codigo, rpnc_subcodigo, rpnc_origem, rpnc_data_abertuta, mph_codigo, op_codigo, pv_codigo, pv_revisao, mqp_codigo, usu_codigo, fun_resp_emissao, rpnc_quantidade, rpnc_status, pes_codigo, lote)
        values (?, ?, ?, current_timestamp, ?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', ?, ?)`, [rpncCode, year, originLabel, scheduleCode, opCodigo, productCode, revision, machineCode, userId, employeeCode, totalQuantity, personCode, lot]);
      for (const item of normalizedItems) {
        const inspectionRows = await transaction.queryAsync("select coalesce(max(ip_codigo), 0) + 1 as inspection_code from inspecao_produto");
        const inspectionCode = Number(inspectionRows[0]?.inspection_code ?? inspectionRows[0]?.INSPECTION_CODE);
        await transaction.queryAsync(`insert into inspecao_produto (ip_codigo, mph_codigo, op_codigo, pv_codigo, pv_revisao, ip_tipo_insp, cl_codigo, icl_codigo, ip_status, qip_quantidade)
          values (?, ?, ?, ?, ?, ?, ?, ?, 'Não Conforme', ?)`, [inspectionCode, scheduleCode, opCodigo, productCode, revision, inspectionType, item.checklistCode, item.itemCode, item.quantity]);
        const ncRows = await transaction.queryAsync("select coalesce(max(nc_codigo), 0) + 1 as nc_code from rpnc_nao_conformidades");
        const ncCode = Number(ncRows[0]?.nc_code ?? ncRows[0]?.NC_CODE);
        await transaction.queryAsync(`insert into rpnc_nao_conformidades (nc_codigo, rpnc_codigo, rpnc_subcodigo, cl_codigo, icl_codigo, nc_quantidade, fun_responsavel)
          values (?, ?, ?, ?, ?, ?, ?)`, [ncCode, rpncCode, year, item.checklistCode, item.itemCode, item.quantity, employeeCode]);
        for (const causeCode of item.causeCodes) {
          const causeRows = await transaction.queryAsync("select coalesce(max(cnc_codigo), 0) + 1 as cause_nc_code from rpnc_causa_nc");
          const causeNcCode = Number(causeRows[0]?.cause_nc_code ?? causeRows[0]?.CAUSE_NC_CODE);
          await transaction.queryAsync(`insert into rpnc_causa_nc (cnc_codigo, rpnc_codigo, rpnc_subcodigo, ca_codigo, cl_codigo, icl_codigo, cnc_acao_contencao)
            values (?, ?, ?, ?, ?, ?, ?)`, [causeNcCode, rpncCode, year, causeCode, item.checklistCode, item.itemCode, item.containmentAction]);
        }
      }
      const actionRows = await transaction.queryAsync("select coalesce(max(apnc_codigo), 0) + 1 as action_code from rpnc_acoes_produto_nc");
      const actionCode = Number(actionRows[0]?.action_code ?? actionRows[0]?.ACTION_CODE);
      await transaction.queryAsync(`insert into rpnc_acoes_produto_nc (apnc_codigo, rpnc_codigo, rpnc_subcodigo, manc_codigo, apnc_responsavel, apnc_execucao, apnc_qtde)
        values (?, ?, ?, 6, 48, 48, ?)`, [actionCode, rpncCode, year, totalQuantity]);
      if (transitionToGeneralSampling) {
        const finishedClock = await consumeDailyClock(transaction, machineCode);
        await transaction.queryAsync(`update mov_processos set mp_status = 'Liberado', mp_posicao = 'PF', mp_fila = 2000, mp_situacao_lib = 'Amostragem Geral', mp_fim = ?, mp_observacao = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [finishedClock, `RPNC ${rpncCode}/${year}: encaminhado para Amostragem Geral.`, opCodigo, mpCodigo, machineCode]);
        const closedRows = await transaction.queryAsync(`update mov_processos_horarios set mph_fim = ?, mph_qtde_produzida = 0, mph_qtde_perdida = 0, mph_qtde_fun = 0, mph_verificador = 'F', mph_status = 'Liberado', mph_situacao = 'A', mph_situacao_insp = 'Não Conforme', mph_situacao_lib = 'Amostragem Geral' where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'`, [finishedClock, opCodigo, mpCodigo, machineCode]);
        if (Number(closedRows?.affectedRows ?? closedRows?.rowsAffected ?? 1) > 1) throw Object.assign(new Error("Foram encontrados horários ativos duplicados; a Amostragem Geral não foi confirmada."), { statusCode: 409 });
      }
      return { success: true, rpncCode, year, nonconformityCount: normalizedItems.length, totalQuantity, generalSampling: transitionToGeneralSampling };
    });
    res.json(result);
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/process-label", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo);
    const mpCodigo = Number(req.params.mpCodigo);
    const companyCode = Number(req.query.companyCode);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados inválidos para a Etiqueta de Processo." });
    const rows = await query(`select first 1
      mp.mp_fantasia as customer_name,
      mp.op_codigo as op_code,
      mp.pv_codigo as product_code,
      mp.pv_revisao as revision,
      mp.mp_qtde_pedido as ordered_quantity,
      case when coalesce(trim(pv.pv_cod_prod_cli), '') <> '' then pv.pv_cod_prod_cli || ' - ' || mp.mp_referencia else mp.mp_referencia end as reference,
      mp.mp_processo as current_process,
      (select first 1 mp2.mp_processo from mov_processos mp2 where mp2.op_codigo = mp.op_codigo and mp2.mp_codigo = mp.mp_codigo + 1) as next_process,
      fun.fun_nome as operator_name,
      pv.posicao_junta as joint_position,
      case when pv.pv_imperm_capa_externa = 'S' or pv.pv_imperm_capa_interna = 'S' then 'SIM' else 'NÃO' end as resin
      from mov_processos mp
      left join usuarios usu on usu.usu_codigo = mp.usu_codigo
      left join funcionarios fun on fun.fun_codigo = usu.fun_codigo
      inner join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
      where mp.op_codigo = ? and mp.mp_codigo = ?`, [opCodigo, mpCodigo]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Processo não encontrado para a OP selecionada." });
    const companyPayload = Number.isInteger(companyCode) && companyCode > 0 ? await pool.withConnection(async (db) => {
      const companyRows = await db.queryAsync(`select first 1 emp_codigo as code, emp_fantasia as fantasy_name, emp_razao_social as legal_name, emp_logo as logo_blob from empresa where emp_codigo = ?`, [companyCode]);
      const company = companyRows[0];
      const logo = await readBlobImageDataUri(company?.logo_blob ?? company?.LOGO_BLOB, "a logomarca da empresa");
      return { company, logo };
    }) : { company: null, logo: { dataUri: null, error: null } };
    const company = companyPayload.company;
    const companyLogo = companyPayload.logo;
    res.json({
      operationCode: Number(row.op_code), productCode: Number(row.product_code), revision: Number(row.revision ?? 0),
      customerName: row.customer_name ?? null, orderedQuantity: row.ordered_quantity == null ? null : Number(row.ordered_quantity),
      reference: row.reference ?? null, currentProcess: row.current_process ?? null, nextProcess: row.next_process ?? null,
      operatorName: row.operator_name ?? null, jointPosition: row.joint_position ?? null, resin: row.resin ?? "NÃO",
      companyName: company?.fantasy_name ?? company?.FANTASY_NAME ?? company?.legal_name ?? company?.LEGAL_NAME ?? null,
      companyLogoDataUri: companyLogo.dataUri, companyLogoError: companyLogo.error,
      printerOptions: processLabelPrinters,
    });
  } catch (error) { next(error); }
});

app.post("/v1/process-label/print", ensureAuthorized, async (req, res, next) => {
  try {
    const printer = String(req.body?.printer ?? "").trim();
    const copies = Number(req.body?.copies ?? 1);
    const pdfBase64 = String(req.body?.pdfBase64 ?? "").trim();
    if (!printer || !Number.isInteger(copies) || copies < 1 || copies > 99 || !pdfBase64) return res.status(400).json({ error: "Dados inválidos para impressão direta da etiqueta." });
    const available = await getWindowsPrinters();
    const selected = available.find((item) => item.name.localeCompare(printer, "pt-BR", { sensitivity: "accent" }) === 0);
    if (!selected) return res.status(404).json({ error: "A impressora selecionada não foi encontrada nesta estação Windows." });
    if (selected.offline) return res.status(409).json({ error: "A impressora selecionada está offline." });
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    if (pdfBuffer.length < 64 || pdfBuffer.subarray(0, 4).toString("ascii") !== "%PDF") return res.status(400).json({ error: "O PDF da etiqueta é inválido." });
    await printPdfDirectly(pdfBuffer, selected.name, copies);
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/product-finished-label", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo);
    const mpCodigo = Number(req.params.mpCodigo);
    const companyCode = Number(req.query.companyCode);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados inválidos para a Etiqueta de Produto Acabado." });
    const rows = await query(`select first 1
      pve.pve_codigo as stock_code, pve.op_codigo as operation_code, pve.pv_codigo as product_code, pve.pv_revisao as revision,
      pve.pve_saldo as stock_quantity, pve.pve_lote as lot, pve.pve_data_producao as manufacturing_date,
      pes.pes_razao_social as customer_legal_name, pes.pes_fantasia as customer_name,
      case when coalesce(trim(pv.pv_cod_prod_cli), '') <> '' and coalesce(trim(pv.pv_referencia), '') <> '' then pv.pv_cod_prod_cli || ' - ' || pv.pv_referencia
           when coalesce(trim(pv.pv_cod_prod_cli), '') <> '' then pv.pv_cod_prod_cli else pv.pv_referencia end as reference,
      cast(pv.pv_medida_comp as varchar(30)) || ' x ' || cast(pv.pv_medida_larg as varchar(30)) || ' x ' || cast(pv.pv_medida_alt as varchar(30)) as internal_measures,
      coalesce(pvp.pvp_palete_total_produtos, 0) as quantity_per_pallet
      from mov_processos mp
      inner join prod_vendas_estoque pve on pve.op_codigo = mp.op_codigo and pve.pv_codigo = mp.pv_codigo and pve.pv_revisao = mp.pv_revisao
      left join pessoa pes on pes.pes_codigo = pve.pes_codigo
      inner join produtos_vendas pv on pv.pv_codigo = pve.pv_codigo and pv.pv_revisao = pve.pv_revisao
      left join ultimo_mov_est_venda_lote umev on umev.pv_codigo = pve.pv_codigo and umev.pv_revisao = pve.pv_revisao and umev.codtabela = pve.pve_codigo
      left join prod_vendas_paletizacao pvp on pvp.pv_codigo = pve.pv_codigo and pvp.pv_revisao = pve.pv_revisao
        and (pvp.pes_codigo = pve.pes_codigo or (pvp.pes_codigo = 0 and not exists (select 1 from prod_vendas_paletizacao pvp2 where pvp2.pv_codigo = pvp.pv_codigo and pvp2.pv_revisao = pvp.pv_revisao and pvp2.pes_codigo = pve.pes_codigo)))
      where mp.op_codigo = ? and mp.mp_codigo = ? and umev.pv_codigo is not null and coalesce(pve.pve_saldo, 0) > 0
      order by pve.pve_codigo desc`, [opCodigo, mpCodigo]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Não existe estoque acabado disponível para esta OP. Aponte a produção antes de imprimir a etiqueta." });
    const companyPayload = Number.isInteger(companyCode) && companyCode > 0 ? await pool.withConnection(async (db) => {
      const companyRows = await db.queryAsync(`select first 1 emp_fantasia as fantasy_name, emp_razao_social as legal_name, emp_logo as logo_blob from empresa where emp_codigo = ?`, [companyCode]);
      const company = companyRows[0];
      const logo = await readBlobImageDataUri(company?.logo_blob ?? company?.LOGO_BLOB, "a logomarca da empresa");
      return { company, logo };
    }) : { company: null, logo: { dataUri: null, error: null } };
    const company = companyPayload.company;
    res.json({
      stockCode: Number(row.stock_code), operationCode: Number(row.operation_code), productCode: Number(row.product_code), revision: Number(row.revision ?? 0),
      customerLegalName: row.customer_legal_name ?? null, customerName: row.customer_name ?? null, reference: row.reference ?? null,
      stockQuantity: Number(row.stock_quantity ?? 0), lot: row.lot == null ? null : String(row.lot), manufacturingDate: row.manufacturing_date ?? null,
      internalMeasures: row.internal_measures ?? null, quantityPerPallet: row.quantity_per_pallet == null ? null : Number(row.quantity_per_pallet),
      companyName: company?.fantasy_name ?? company?.FANTASY_NAME ?? company?.legal_name ?? company?.LEGAL_NAME ?? null,
      companyLogoDataUri: companyPayload.logo.dataUri, companyLogoError: companyPayload.logo.error, printerOptions: processLabelPrinters,
    });
  } catch (error) { next(error); }
});

app.post("/v1/product-finished-label/print", ensureAuthorized, async (req, res, next) => {
  try {
    const printer = String(req.body?.printer ?? "").trim();
    const copies = Number(req.body?.copies ?? 1);
    const pdfBase64 = String(req.body?.pdfBase64 ?? "").trim();
    if (!printer || !Number.isInteger(copies) || copies < 1 || copies > 99 || !pdfBase64) return res.status(400).json({ error: "Dados inválidos para impressão direta da etiqueta de Produto Acabado." });
    const available = await getWindowsPrinters();
    const selected = available.find((item) => item.name.localeCompare(printer, "pt-BR", { sensitivity: "accent" }) === 0);
    if (!selected) return res.status(404).json({ error: "A impressora selecionada não foi encontrada nesta estação Windows." });
    if (selected.offline) return res.status(409).json({ error: "A impressora selecionada está offline." });
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    if (pdfBuffer.length < 64 || pdfBuffer.subarray(0, 4).toString("ascii") !== "%PDF") return res.status(400).json({ error: "O PDF da etiqueta é inválido." });
    await printPdfDirectly(pdfBuffer, selected.name, copies);
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/product-release-plan", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.query.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados inválidos para o plano de amostragem." });
    const movementRows = await query(`select first 1 mp.mp_saldo as lot_size, mp.mp_situacao_lib as release_situation, gm.gmq_grupo as machine_group from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const movement = movementRows[0];
    if (!movement) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    if (!isProductReleaseMachineGroup(movement.machine_group ?? movement.MACHINE_GROUP)) return res.status(403).json({ error: "Esta máquina não pertence ao grupo Liberação de Produto." });
    const lotSize = Math.max(0, Number(movement.lot_size ?? movement.LOT_SIZE ?? 0) || 0);
    const planRows = lotSize > 0 ? await query(`select first 1 pl_codigo as plan_code, pl_tam_amostra as sample_size, pl_dft_c as acceptable_limit, pl_dft_nc as non_conforming_limit from plano_amostragem where ? between pl_var_inicial and pl_var_final order by pl_codigo`, [lotSize]) : [];
    const plan = planRows[0] ?? {};
    const stage = String(movement.release_situation ?? movement.RELEASE_SITUATION ?? "").trim() === "Amostragem Geral" ? "Amostragem Geral" : "1º Amostragem";
    res.json({ lotSize, sampleSize: plan.sample_size ?? plan.SAMPLE_SIZE ?? null, acceptableLimit: plan.acceptable_limit ?? plan.ACCEPTABLE_LIMIT ?? null, nonConformingLimit: plan.non_conforming_limit ?? plan.NON_CONFORMING_LIMIT ?? null, planCode: plan.plan_code ?? plan.PLAN_CODE ?? null, stage });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/product-release", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const operatorId = Number(req.body?.operatorId); const lotSize = Number(req.body?.lotSize); const quantityLost = Number(req.body?.quantityLost ?? 0); const quantityReworked = Number(req.body?.quantityReworked ?? 0); const outcome = String(req.body?.outcome ?? ""); const conformity = String(req.body?.conformity ?? ""); const stage = String(req.body?.stage ?? "");
    if (![opCodigo, mpCodigo, machineCode, operatorId, lotSize, quantityLost, quantityReworked].every((value) => Number.isInteger(value) && value >= 0) || lotSize < 1 || quantityLost > lotSize) return res.status(400).json({ error: "Dados inválidos para a Liberação de Produto." });
    if (!["attended", "partial"].includes(outcome) || !["Conforme", "Não Conforme"].includes(conformity) || !["1º Amostragem", "Amostragem Geral"].includes(stage)) return res.status(400).json({ error: "Resultado de inspeção inválido." });
    const result = await withTransaction(async (transaction) => {
      const movementRows = await transaction.queryAsync(`select first 1 mp.mp_posicao, mp.mp_saldo, gm.gmq_grupo as machine_group from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
      const movement = movementRows[0];
      if (!movement) throw Object.assign(new Error("Processo não encontrado para a máquina atual."), { statusCode: 404 });
      if (!isProductReleaseMachineGroup(movement.machine_group ?? movement.MACHINE_GROUP)) throw Object.assign(new Error("Esta máquina não pertence ao grupo Liberação de Produto."), { statusCode: 403 });
      if (String(movement.mp_posicao ?? movement.MP_POSICAO) !== "PI") throw Object.assign(new Error("A Liberação de Produto só pode ser finalizada durante a produção iniciada."), { statusCode: 409 });
      const finishedClock = await consumeDailyClock(transaction, machineCode);
      const needsGeneralSampling = conformity === "Não Conforme" && stage === "1º Amostragem";
      const status = needsGeneralSampling ? "Liberado" : outcome === "attended" ? "Atendido" : "Parcial";
      const position = needsGeneralSampling || outcome === "attended" ? "PF" : "PP";
      const producedQuantity = needsGeneralSampling ? 0 : Math.max(0, lotSize - quantityLost);
      const nextBalance = needsGeneralSampling ? Number(movement.mp_saldo ?? movement.MP_SALDO ?? lotSize) : Math.max(0, lotSize - producedQuantity);
      const releaseSituation = needsGeneralSampling ? "Amostragem Geral" : stage;
      await transaction.queryAsync(`update mov_processos set mp_fila = 2000, mp_qtde_produzida = coalesce(mp_qtde_produzida, 0) + ?, mp_qtde_perdida = coalesce(mp_qtde_perdida, 0) + ?, mp_qtdeapontada = coalesce(mp_qtdeapontada, 0) + ?, mp_saldo = ?, mp_status = ?, mp_posicao = ?, mp_fim = ?, mp_data_atendido = ?, mp_observacao = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [producedQuantity, needsGeneralSampling ? 0 : quantityLost, producedQuantity, nextBalance, status, position, finishedClock, finishedClock, `Liberação de Produto: ${conformity}; ${releaseSituation}; retrabalho ${quantityReworked}.`, opCodigo, mpCodigo, machineCode]);
      await transaction.queryAsync(`update mov_processos_horarios set mph_fim = ?, mph_qtde_produzida = coalesce(mph_qtde_produzida, 0) + ?, mph_qtde_perdida = coalesce(mph_qtde_perdida, 0) + ?, mph_qtde_fun = 0, mph_verificador = 'F', mph_status = ?, mph_situacao = 'A', mph_situacao_insp = ?, mph_situacao_lib = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'`, [finishedClock, producedQuantity, needsGeneralSampling ? 0 : quantityLost, status, conformity, releaseSituation, opCodigo, mpCodigo, machineCode]);
      const specialProduction = await synchronizeSpecialProductionComponents(transaction, { opCodigo, machineCode, operatorId, producedQuantity, lostQuantity: needsGeneralSampling ? 0 : quantityLost, quantityPeople: 0, queue: 2000, status, position, finishedAt: finishedClock, observation: `Liberação de Produto: ${conformity}; ${releaseSituation}; retrabalho ${quantityReworked}.`, lotTrace: "", conformity, releaseSituation, insertFinishedStock: false });
      return { status, conformity, stage: releaseSituation, producedQuantity, specialProduction };
    });
    res.json({ success: true, ...result });
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.query.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Processo inválido." });
    const rows = await query(`select first 1 mp.op_codigo, mp.mp_codigo, mp.pv_codigo as product_code, mp.mqp_codigo as machine_code, mp.mp_fila as fila, mp.mp_status as status,
      mp.mp_data as data, mp.mp_data_entrega as data_entrega, mp.mp_saldo as saldo, mp.mp_qtde_produzida as quantidade_produzida,
      mp.mp_qtde_perdida as quantidade_perdida, mp.mp_qtde_op as quantity, mp.mp_posicao as queue_position, mp.mp_referencia as referencia,
      mp.mp_cliente as client, p.pes_fantasia as client_fantasy, p.pes_razao_social as client_legal_name, mp.mp_status_feramental as reserved_status, mp.mp_inicio_ajuste as setup_started_at, mp.mp_fim_ajuste as setup_finished_at,
      mp.mp_inicio as process_started_at, mp.mp_fim as process_finished_at,
      (select first 1 mph.mph_inicio_setup from mov_processos_horarios mph where mph.op_codigo = mp.op_codigo and mph.mp_codigo = mp.mp_codigo and mph.mqp_codigo = mp.mqp_codigo and mph.mph_verificador = 'A' order by mph.mph_codigo desc) as active_setup_started_at,
      (select first 1 mph.mph_inicio from mov_processos_horarios mph where mph.op_codigo = mp.op_codigo and mph.mp_codigo = mp.mp_codigo and mph.mqp_codigo = mp.mqp_codigo and mph.mph_verificador = 'A' order by mph.mph_codigo desc) as active_process_started_at,
      mq.mqp_descricao as machine_description, mq.mqp_descricao as processo, gm.gmq_grupo as machine_group,
      pv.pv_referencia as produto_referencia, pv.pv_cod_prod_cli as customer_product_code, mp.pv_revisao as revision, pv.pv_ajuste_larg as adjustment_width,
      pv.pv_ajuste_comp as adjustment_length, pv.pv_chapa_cortada_larg as cut_sheet_width, pv.pv_chapa_cortada_comp as cut_sheet_length,
      pv.pv_sentido_onda as wave_direction, pv.pv_fechamento as closing, pv.posicao_junta as lap_closing, pv.pv_impressao as print,
      cint.cint_descricao as internal_composition, cp.cps_descricao as corrugated_board,
      pv.pv_numero_grampos as staple_quantity, (select count(*) from prod_vendas_cores pvc where pvc.pv_codigo = mp.pv_codigo and pvc.pv_revisao = mp.pv_revisao) as color_count,
      coalesce((select first 1 pvpp.pvpp_codigo from prod_vendas_proc_prod pvpp where pvpp.pv_codigo = mp.pv_codigo and pvpp.pv_revisao = mp.pv_revisao and pvpp.mqp_codigo = mp.mqp_codigo order by pvpp.pvpp_codigo), 0) as process_production_code,
      coalesce((select first 1 pvpp.pvpp_arranjo_prod_total from prod_vendas_proc_prod pvpp where pvpp.pv_codigo = mp.pv_codigo and pvpp.pv_revisao = mp.pv_revisao and pvpp.mqp_codigo = mp.mqp_codigo order by pvpp.pvpp_codigo), 1) as production_arrangement_total,
      coalesce((select first 1 pvpp.pvpp_calcular_arranjo_prod from prod_vendas_proc_prod pvpp where pvpp.pv_codigo = mp.pv_codigo and pvpp.pv_revisao = mp.pv_revisao and pvpp.mqp_codigo = mp.mqp_codigo order by pvpp.pvpp_codigo), 'N') as calculate_production_arrangement,
      coalesce((select first 1 pvpp.pvpp_calcular_arranjo_res from prod_vendas_proc_prod pvpp where pvpp.pv_codigo = mp.pv_codigo and pvpp.pv_revisao = mp.pv_revisao and pvpp.mqp_codigo = mp.mqp_codigo order by pvpp.pvpp_codigo), 'N') as calculate_reservation_arrangement,
      (select count(*) from historico_paradas hp where hp.op_codigo = mp.op_codigo and hp.mqp_codigo = mp.mqp_codigo and hp.hpar_situacao = 'A') as active_pause_count
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
      left join produtos_vendas pv on pv.pv_codigo = mp.pv_codigo and pv.pv_revisao = mp.pv_revisao
      left join composicoes_interna cint on cint.cint_codigo = pv.cint_codigo
      left join composicao cp on cp.cps_codigo = pv.cps_codigo and cp.cint_codigo = pv.cint_codigo
      left join pessoa p on p.pes_codigo = mp.pes_codigo
      where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    if (!rows[0]) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const movement = rows[0];
    const productionDateRows = await query(`select first 1 mph.mph_data as production_date from mov_processos_horarios mph inner join maquinas_processos mq on mq.mqp_codigo = mph.mqp_codigo where mph.op_codigo = ? and mq.gmq_codigo <> 1 order by mph.mph_codigo`, [opCodigo]);
    const productionDate = productionDateRows[0]?.production_date ?? productionDateRows[0]?.PRODUCTION_DATE ?? new Date().toISOString().slice(0, 10);
    const previousProcessRows = await query(`with op_ant as (select first 1 mv.mp_qtdeapontada as previous_quantity, mv.op_codigo, previous_machine.mqp_descricao as previous_process from mov_processos mv inner join maquinas_processos previous_machine on previous_machine.mqp_codigo = mv.mqp_codigo where mv.op_codigo = ? and mv.mp_codigo < ? and mv.mp_qtdeapontada > 0 order by mv.mp_codigo desc) select op_ant.previous_quantity - coalesce(current_process.mp_qtdeapontada, 0) as previous_process_balance, op_ant.previous_process from mov_processos current_process inner join op_ant on op_ant.op_codigo = current_process.op_codigo where current_process.op_codigo = ? and current_process.mp_codigo = ?`, [opCodigo, mpCodigo, opCodigo, mpCodigo]);
    const previousProcess = previousProcessRows[0];
    const previousProcessBalanceValue = Number(previousProcess?.previous_process_balance ?? previousProcess?.PREVIOUS_PROCESS_BALANCE);
    res.json({
      ...movement,
      machineCode: Number(movement.machine_code ?? movement.MACHINE_CODE),
      productCode: Number(movement.product_code ?? movement.PRODUCT_CODE ?? 0) || null,
      queuePosition: movement.queue_position ?? movement.QUEUE_POSITION ?? null,
      machineDescription: movement.machine_description ?? movement.MACHINE_DESCRIPTION ?? null,
      machineGroup: movement.machine_group ?? movement.MACHINE_GROUP ?? null,
      productionDate,
      previousProcessBalance: Number.isFinite(previousProcessBalanceValue) ? previousProcessBalanceValue : null,
      previousProcessName: previousProcess?.previous_process ?? previousProcess?.PREVIOUS_PROCESS ?? null,
      customerProductCode: movement.customer_product_code ?? movement.CUSTOMER_PRODUCT_CODE ?? null,
      clientLegalName: movement.client_legal_name ?? movement.CLIENT_LEGAL_NAME ?? null,
      clientFantasy: movement.client_fantasy ?? movement.CLIENT_FANTASY ?? null,
      setupStartedAt: movement.setup_started_at ?? movement.SETUP_STARTED_AT ?? null,
      setupFinishedAt: movement.setup_finished_at ?? movement.SETUP_FINISHED_AT ?? null,
      processStartedAt: movement.process_started_at ?? movement.PROCESS_STARTED_AT ?? null,
      processFinishedAt: movement.process_finished_at ?? movement.PROCESS_FINISHED_AT ?? null,
      activeSetupStartedAt: movement.active_setup_started_at ?? movement.ACTIVE_SETUP_STARTED_AT ?? null,
      activeProcessStartedAt: movement.active_process_started_at ?? movement.ACTIVE_PROCESS_STARTED_AT ?? null,
      adjustmentWidth: movement.adjustment_width ?? movement.ADJUSTMENT_WIDTH ?? null,
      adjustmentLength: movement.adjustment_length ?? movement.ADJUSTMENT_LENGTH ?? null,
      cutSheetWidth: movement.cut_sheet_width ?? movement.CUT_SHEET_WIDTH ?? null,
      cutSheetLength: movement.cut_sheet_length ?? movement.CUT_SHEET_LENGTH ?? null,
      waveDirection: movement.wave_direction ?? movement.WAVE_DIRECTION ?? null,
      closing: movement.closing ?? movement.CLOSING ?? null,
      lapClosing: movement.lap_closing ?? movement.LAP_CLOSING ?? null,
      print: movement.print ?? movement.PRINT ?? null,
      colorCount: movement.color_count ?? movement.COLOR_COUNT ?? null,
      stapleQuantity: movement.staple_quantity ?? movement.STAPLE_QUANTITY ?? null,
      processProductionCode: Number(movement.process_production_code ?? movement.PROCESS_PRODUCTION_CODE ?? 0),
      productionArrangementTotal: Number(movement.production_arrangement_total ?? movement.PRODUCTION_ARRANGEMENT_TOTAL ?? 1) || 1,
      calculateProductionArrangement: String(movement.calculate_production_arrangement ?? movement.CALCULATE_PRODUCTION_ARRANGEMENT ?? "N").trim().toUpperCase() === "S",
      calculateReservationArrangement: String(movement.calculate_reservation_arrangement ?? movement.CALCULATE_RESERVATION_ARRANGEMENT ?? "N").trim().toUpperCase() === "S",
      internalComposition: movement.internal_composition ?? movement.INTERNAL_COMPOSITION ?? null,
      corrugatedBoard: movement.corrugated_board ?? movement.CORRUGATED_BOARD ?? null,
      activePause: Number(movement.active_pause_count ?? movement.ACTIVE_PAUSE_COUNT ?? 0) > 0,
    });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/reservation", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.query.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de reserva inválidos." });
    const context = await pool.withConnection((db) => reservationContext(db, opCodigo, mpCodigo, machineCode));
    res.json({ applicable: context.applies, groupLabel: context.groupLabel, quantity: context.quantity, balance: context.balance, indicatorLabel: context.indicatorLabel, indicatorQuantity: context.indicatorQuantity, previousProcessDescription: context.previousProcessDescription });
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/pointing/:opCodigo/:mpCodigo/approved-quantities", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo);
    if (![opCodigo, mpCodigo].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de quantidades aprovadas inválidos." });
    const rows = await query(`with mov as (
      select mv.mp_status, mv.mp_arranjo_l || ' x ' || mv.mp_arranjo_c as arranjo, mv.mp_codigo, mv.op_codigo, mv.mqp_codigo
      from mov_processos mv where mv.op_codigo = ?
    )
    select gm.gmq_grupo as process_group, mov.arranjo, sum(mph.mph_qtde_produzida) as approved_quantity, mov.mp_status as status
    from mov_processos_horarios mph
      inner join mov on mov.mp_codigo = mph.mp_codigo and mov.op_codigo = mph.op_codigo and mov.mqp_codigo = mph.mqp_codigo
      inner join maquinas_processos m on m.mqp_codigo = mph.mqp_codigo
      inner join grupo_maquinas gm on gm.gmq_codigo = m.gmq_codigo
    where mph.op_codigo = ?
    group by gm.gmq_grupo, mov.mp_status, mov.arranjo, gm.gmq_codigo
    order by gm.gmq_codigo`, [opCodigo, opCodigo]);
    res.json(rows.map((row) => ({ processGroup: row.process_group ?? row.PROCESS_GROUP ?? null, arrangement: row.arranjo ?? row.ARRANJO ?? null, approvedQuantity: Number(row.approved_quantity ?? row.APPROVED_QUANTITY ?? 0), status: row.status ?? row.STATUS ?? null })));
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/start-setup", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") {
      return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    }
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const operatorId = Number(req.body?.operatorId);
    if (![opCodigo, mpCodigo, machineCode, operatorId].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de início inválidos." });
    const rows = await query(`select first 1 mp.op_codigo, mp.mp_codigo, mp.pv_codigo, mp.pv_revisao, mp.mp_fila, mp.mp_status, gm.gmq_grupo as group_description
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
      where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const movement = rows[0];
    if (!movement) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    if (String(movement.mp_status) === "Em Produção") return res.json({ success: true, state: "RESUMED" });
    const coladeiraMachine = isColadeiraMachineGroup(movement.group_description ?? movement.GROUP_DESCRIPTION);
    const startableStatuses = ['Liberado', 'Aberto', 'A Concluir', 'Setup a Concluir', ...(coladeiraMachine ? ['Parcial'] : [])];
    if (!startableStatuses.includes(String(movement.mp_status))) return res.status(409).json({ error: coladeiraMachine ? "A ordem não está Liberada, Aberta, Parcial, A Concluir ou Setup a Concluir para iniciar na Coladeira." : "A ordem não está liberada, aberta, A Concluir ou Setup a Concluir para iniciar." });
    if (!coladeiraMachine && Number(movement.mp_fila) !== 1) return res.status(409).json({ error: "Somente a fila 1 pode iniciar a produção." });
    const pendingRows = coladeiraMachine ? [] : await query(`select first 1 mp_codigo from mov_processos where mqp_codigo = ? and mp_status = 'A Concluir' and mp_fila = 1`, [machineCode]);
    if (!coladeiraMachine && pendingRows[0] && String(movement.mp_status) !== "A Concluir") return res.status(409).json({ error: "Existe uma ordem A Concluir prioritária nesta máquina. Retome-a antes de iniciar outra ordem." });
    const resumingToConclude = String(movement.mp_status) === "A Concluir";
    if (resumingToConclude) {
      const resumed = await withTransaction(async (transaction) => {
        const currentRows = await transaction.queryAsync(`select first 1 mp.pv_codigo, mp.pv_revisao, mp.mp_status, mp.mp_fila, gm.gmq_grupo as group_description
          from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
          left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
          where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
        const current = currentRows[0];
        if (!current || String(current.mp_status ?? current.MP_STATUS) !== "A Concluir") throw Object.assign(new Error("A ordem não está mais A Concluir para retomar."), { statusCode: 409 });
        if (!isColadeiraMachineGroup(current.group_description ?? current.GROUP_DESCRIPTION) && Number(current.mp_fila ?? current.MP_FILA) !== 1) throw Object.assign(new Error("Somente a fila 1 pode retomar A Concluir."), { statusCode: 409 });
        const sequenceRows = await transaction.queryAsync(`select coalesce(max(mph_numero_processo), 0) + 1 as process_number from mov_processos_horarios where op_codigo = ? and mqp_codigo = ?`, [opCodigo, machineCode]);
        const processNumber = Number(sequenceRows[0]?.process_number ?? sequenceRows[0]?.PROCESS_NUMBER ?? 1);
        await transaction.queryAsync(`update mov_processos set mp_data = current_date, mp_status = 'Em Produção', mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null, usu_codigo = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [operatorId, opCodigo, mpCodigo, machineCode]);
        await transaction.queryAsync(`insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, op_codigo, pv_codigo, pv_revisao, mqp_codigo, mph_verificador, mp_codigo, mph_numero_processo) values (current_timestamp, ?, current_timestamp, ?, ?, ?, ?, 'A', ?, ?)`, [operatorId, opCodigo, current.pv_codigo ?? current.PV_CODIGO, current.pv_revisao ?? current.PV_REVISAO, machineCode, mpCodigo, processNumber]);
        const scheduleRows = await transaction.queryAsync(`select first 1 mph_codigo from mov_processos_horarios where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A' order by mph_codigo desc`, [opCodigo, mpCodigo, machineCode]);
        if (!scheduleRows[0]) throw Object.assign(new Error("A retomada não gerou o novo registro de horário."), { statusCode: 500 });
        return { success: true, state: "PI", resumedToConclude: true, scheduleCode: Number(scheduleRows[0].mph_codigo ?? scheduleRows[0].MPH_CODIGO) };
      });
      return res.json(resumed);
    }
    const sequenceRows = await query(`select coalesce(max(mph_numero_processo), 0) + 1 as process_number from mov_processos_horarios where op_codigo = ? and mqp_codigo = ?`, [opCodigo, machineCode]);
    const processNumber = Number(sequenceRows[0]?.process_number ?? 1);
    const setupClock = await consumeDailyClockForMachine(machineCode);
    await query(`update mov_processos set mp_data = current_date, mp_status = 'Em Produção', mp_posicao = 'SI', mp_inicio_ajuste = ?, mp_fim_ajuste = null, mp_inicio = null, mp_fim = null, usu_codigo = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [setupClock, operatorId, opCodigo, mpCodigo, machineCode]);
    await query(`insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio_setup, op_codigo, pv_codigo, pv_revisao, mqp_codigo, mph_verificador, mp_codigo, mph_numero_processo) values (?, ?, ?, ?, ?, ?, ?, 'A', ?, ?)`, [setupClock, operatorId, setupClock, opCodigo, movement.pv_codigo, movement.pv_revisao, machineCode, mpCodigo, processNumber]);
    res.json({ success: true, state: "SI" });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/start-manual", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const operatorId = Number(req.body?.operatorId);
    if (![opCodigo, mpCodigo, machineCode, operatorId].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de início manual inválidos." });
    const machineRows = await query(`select first 1 mq.mqp_descricao as description, mq.mqp_processo_manual as manual_process, gm.gmq_grupo as group_description from maquinas_processos mq left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo where mq.mqp_codigo = ?`, [machineCode]);
    const manualMachine = machineRows[0] ? { description: machineRows[0].description ?? machineRows[0].DESCRIPTION, manualProcess: String(machineRows[0].manual_process ?? machineRows[0].MANUAL_PROCESS ?? "N").toUpperCase() === "S", groupDescription: machineRows[0].group_description ?? machineRows[0].GROUP_DESCRIPTION ?? null } : null;
    if (!isManualPointingMachine(manualMachine)) return res.status(403).json({ error: "O Apontamento Manual só pode ser iniciado em máquina marcada como Processo Manual." });
    const specialSetMachine = isSpecialProductionMachine(manualMachine);
    const started = await withTransaction(async (transaction) => {
      const rows = await transaction.queryAsync(`select first 1 pv_codigo, pv_revisao, mp_fila, mp_status from mov_processos where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? with lock`, [opCodigo, mpCodigo, machineCode]);
      const movement = rows[0];
      if (!movement) throw Object.assign(new Error("Processo não encontrado para a máquina atual."), { statusCode: 404 });
      const activeScheduleRows = await transaction.queryAsync(`select first 1 mph_codigo as schedule_code from mov_processos_horarios where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A' order by mph_codigo desc`, [opCodigo, mpCodigo, machineCode]);
      if (activeScheduleRows[0]) {
        const specialProduction = specialSetMachine ? await startSpecialProductionComponents(transaction, { opCodigo, machineCode, operatorId, startedAt: new Date() }) : { isSpecial: false, components: [], started: [], skipped: [] };
        return { success: true, resumed: true, scheduleCode: Number(activeScheduleRows[0].schedule_code ?? activeScheduleRows[0].SCHEDULE_CODE), specialProduction };
      }
      if (String(movement.mp_status ?? movement.MP_STATUS) === "Em Produção") {
        const specialProduction = specialSetMachine ? await startSpecialProductionComponents(transaction, { opCodigo, machineCode, operatorId, startedAt: new Date() }) : { isSpecial: false, components: [], started: [], skipped: [] };
        return { success: true, resumed: true, specialProduction };
      }
      if (!['Liberado', 'Aberto', 'Parcial'].includes(String(movement.mp_status ?? movement.MP_STATUS))) throw Object.assign(new Error("A ordem não está Liberada, Aberta ou Parcial para apontamento manual."), { statusCode: 409 });
      const sequenceRows = await transaction.queryAsync(`select coalesce(max(mph_numero_processo), 0) + 1 as process_number from mov_processos_horarios where op_codigo = ? and mqp_codigo = ?`, [opCodigo, machineCode]);
      const processNumber = Number(sequenceRows[0]?.process_number ?? sequenceRows[0]?.PROCESS_NUMBER ?? 1);
      const startedAt = new Date();
      await transaction.queryAsync(`update mov_processos set mp_data = current_date, mp_status = 'Em Produção', mp_posicao = 'PI', mp_inicio = ?, mp_fim = null, usu_codigo = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [startedAt, operatorId, opCodigo, mpCodigo, machineCode]);
      await transaction.queryAsync(`insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, op_codigo, pv_codigo, pv_revisao, mqp_codigo, mph_verificador, mp_codigo, mph_numero_processo) values (?, ?, ?, ?, ?, ?, ?, 'A', ?, ?)`, [startedAt, operatorId, startedAt, opCodigo, movement.pv_codigo ?? movement.PV_CODIGO, movement.pv_revisao ?? movement.PV_REVISAO, machineCode, mpCodigo, processNumber]);
      const specialProduction = specialSetMachine ? await startSpecialProductionComponents(transaction, { opCodigo, machineCode, operatorId, startedAt }) : { isSpecial: false, components: [], started: [], skipped: [] };
      return { success: true, resumed: false, startedAt: startedAt.toISOString(), specialProduction };
    });
    res.json(started);
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/finish-setup", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") {
      return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    }
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const outcome = String(req.body?.outcome ?? "");
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de setup inválidos." });
    if (!['attended', 'to_conclude', 'cancelled'].includes(outcome)) return res.status(400).json({ error: "Resultado de setup inválido." });
    const rows = await query(`select first 1 mp.mp_posicao, mp.mp_status, mp.mp_fila, gm.gmq_grupo as group_description
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
      where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const movement = rows[0];
    if (!movement) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const currentPosition = movement.mp_posicao ?? movement.MP_POSICAO;
    if (String(currentPosition) !== "SI") return res.status(409).json({ error: "O processo não está em setup iniciado." });
    const attended = outcome === "attended";
    const status = attended ? "Em Produção" : outcome === "to_conclude" ? "Setup a Concluir" : "Setup Cancelado";
    const queue = outcome === "cancelled" ? 1000 : isColadeiraMachineGroup(movement.group_description ?? movement.GROUP_DESCRIPTION) ? Number(movement.mp_fila ?? movement.MP_FILA) : 1;
    const position = attended ? "PI" : "SF";
    const historicStatus = attended ? "Em Produção" : outcome === "to_conclude" ? "Set Concl" : "Set Canc";
    const verifier = attended ? "A" : "F";
    const setupFinishedClock = await consumeDailyClockForMachine(machineCode);
    await query(`update mov_processos set mp_fim_ajuste = ?, mp_inicio = ?, mp_posicao = ?, mp_status = ?, mp_fila = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [setupFinishedClock, setupFinishedClock, position, status, queue, opCodigo, mpCodigo, machineCode]);
    await query(`update mov_processos_horarios set mph_fim_setup = ?, mph_inicio = ?, mph_fim = ?, mph_verificador = ?, mph_status = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'`, [setupFinishedClock, setupFinishedClock, setupFinishedClock, verifier, historicStatus, opCodigo, mpCodigo, machineCode]);
    res.json({ success: true, state: position });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/inspection-checklist", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const rows = await query(`select m.mo_codigo as code, m.mo_descricao as description from motivos m
      where m.mo_tipo = 'Liberação de Máquina'
        and m.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?)
      order by m.mo_descricao`, [machineCode]);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Sem descrição") })));
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/complete-inspection", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode);
    const confirmedCodes = Array.isArray(req.body?.confirmedCodes) ? req.body.confirmedCodes.map(Number) : [];
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de checklist inválidos." });
    const checklistRows = await query(`select m.mo_codigo as code from motivos m
      where m.mo_tipo = 'Liberação de Máquina'
        and m.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?)
      order by m.mo_codigo`, [machineCode]);
    const expectedCodes = checklistRows.map((row) => Number(row.code ?? row.CODE)).filter(Number.isInteger);
    const uniqueConfirmed = [...new Set(confirmedCodes)].sort((a, b) => a - b);
    const sameChecklist = expectedCodes.length === uniqueConfirmed.length && expectedCodes.every((code, index) => code === uniqueConfirmed[index]);
    if (!sameChecklist) return res.status(409).json({ error: "Confirme todos os itens de liberação de máquina para iniciar a produção." });
    const rows = await query(`select first 1 mp.mp_posicao, mp.mp_fila, gm.gmq_grupo as group_description
      from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
      left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
      where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const movement = rows[0];
    if (!movement) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const currentPosition = movement.mp_posicao ?? movement.MP_POSICAO;
    if (String(currentPosition) !== "SI") return res.status(409).json({ error: "O processo não está em setup iniciado." });
    const inspectionClock = await consumeDailyClockForMachine(machineCode);
    const inspectionQueue = isColadeiraMachineGroup(movement.group_description ?? movement.GROUP_DESCRIPTION) ? Number(movement.mp_fila ?? movement.MP_FILA) : 1;
    await query(`update mov_processos set mp_fim_ajuste = ?, mp_inicio = ?, mp_posicao = 'PI', mp_status = 'Em Produção', mp_fila = ? where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [inspectionClock, inspectionClock, inspectionQueue, opCodigo, mpCodigo, machineCode]);
    await query(`update mov_processos_horarios set mph_fim_setup = ?, mph_inicio = ?, mph_fim = ?, mph_verificador = 'A', mph_status = 'Em Produção' where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'`, [inspectionClock, inspectionClock, inspectionClock, opCodigo, mpCodigo, machineCode]);
    res.json({ success: true, state: "PI" });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/process-inspection-checklist", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const rows = await query(`select m.mo_codigo as code, m.mo_descricao as description from motivos m
      where m.mo_tipo = 'Inspeção de Processo'
        and m.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?)
      order by m.mo_descricao`, [machineCode]);
    res.json({ intervalMinutes: processInspectionIntervalMinutes, items: rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Sem descrição") })) });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/complete-process-inspection", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode);
    const confirmedCodes = Array.isArray(req.body?.confirmedCodes) ? req.body.confirmedCodes.map(Number) : [];
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados da Inspeção de Processo inválidos." });
    const checklistRows = await query(`select m.mo_codigo as code from motivos m
      where m.mo_tipo = 'Inspeção de Processo'
        and m.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?)
      order by m.mo_codigo`, [machineCode]);
    const expectedCodes = checklistRows.map((row) => Number(row.code ?? row.CODE)).filter(Number.isInteger);
    const uniqueConfirmed = [...new Set(confirmedCodes)].sort((a, b) => a - b);
    const sameChecklist = expectedCodes.length > 0 && expectedCodes.length === uniqueConfirmed.length && expectedCodes.every((code, index) => code === uniqueConfirmed[index]);
    if (!sameChecklist) return res.status(409).json({ error: "Confirme todos os itens da Inspeção de Processo antes de prosseguir." });
    const activeRows = await query(`select first 1 mph_codigo as schedule_code from mov_processos_horarios
      where op_codigo = ? and mp_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'
      order by mph_codigo desc`, [opCodigo, mpCodigo, machineCode]);
    const activeScheduleCode = Number(activeRows[0]?.schedule_code ?? activeRows[0]?.SCHEDULE_CODE);
    if (!Number.isInteger(activeScheduleCode) || activeScheduleCode < 1) return res.status(409).json({ error: "Não há um horário ativo para registrar a Inspeção de Processo." });
    await query(`update mov_processos_horarios set mph_inspecao_processo = case
      when coalesce(trim(mph_inspecao_processo), '') = '' then ${processInspectionTimestampSql}
      else mph_inspecao_processo || ' - ' || ${processInspectionTimestampSql} end
      where mph_codigo = ?`, [activeScheduleCode]);
    res.json({ success: true, recordedAt: new Date().toISOString(), intervalMinutes: processInspectionIntervalMinutes });
  } catch (error) { next(error); }
});

app.get("/v1/pointing/pause-reasons", ensureAuthorized, async (req, res, next) => {
  try {
    const machineCode = Number(req.query.machineCode);
    if (!Number.isInteger(machineCode) || machineCode < 1) return res.status(400).json({ error: "Máquina inválida." });
    const rows = await query(`select mo.mo_codigo as code, mo.mo_descricao as description from motivos mo
      where mo.mo_status = 'Ativo'
        and mo.mo_tipo = 'Paradas de Maquina'
        and (
          mo.mo_todas_maquinas = 'S'
          or mo.gmq_codigo = (select mqp.gmq_codigo from maquinas_processos mqp where mqp.mqp_codigo = ?)
        )
      order by mo.mo_descricao`, [machineCode]);
    res.json(rows.map((row) => ({ code: Number(row.code ?? row.CODE), description: String(row.description ?? row.DESCRIPTION ?? "Sem descrição") })));
  } catch (error) { next(error); }
});

app.get("/v1/order-structure/:opCodigo/raw-materials", ensureAuthorized, async (req, res, next) => {
  try {
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.query.mpCodigo); const machineCode = Number(req.query.machineCode);
    if (![opCodigo, mpCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de rastreio inválidos." });
    const processRows = await query(`select first 1 mq.gmq_codigo as group_code from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    if (!processRows[0]) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const groupCode = Number(processRows[0].group_code ?? processRows[0].GROUP_CODE);
    if (!Number.isInteger(groupCode) || groupCode < 1) return res.status(409).json({ error: "A máquina atual não possui grupo válido para o rastreio." });
    const rows = await query(`select ope.ope_codigo as structure_code, pvet.pc_codigo as product_code, pc.pc_descricao as product_name,
      ope.pce_lote as lot, coalesce(pc.pc_controlar_validade, 'N') as requires_validity
      from ordem_producao_estrutura ope
      inner join prod_vendas_est_produto pvet on pvet.pvet_codigo = ope.pvet_codigo and pvet.pv_codigo = ope.pv_codigo and pvet.pv_revisao = ope.pv_revisao
      inner join tipos_produtos tp on tp.tp_codigo = pvet.tp_codigo
      inner join unidade_medidas um on um.um_codigo = pvet.um_codigo
      left join produtos_compras pc on pc.pc_codigo = pvet.pc_codigo
      inner join prod_compras_fornecedor pcf on pc.pc_codigo = pcf.pc_codigo and pcf.pcf_codigo = 1
      where ope.op_codigo = ? and pvet.gmq_codigo = ?
      order by pc.pc_descricao`, [opCodigo, groupCode]);
    res.json(rows.map((row) => ({
      structureCode: Number(row.structure_code ?? row.STRUCTURE_CODE),
      productCode: Number(row.product_code ?? row.PRODUCT_CODE),
      productName: String(row.product_name ?? row.PRODUCT_NAME ?? "Matéria-prima"),
      lot: row.lot ?? row.LOT ?? null,
      requiresValidity: String(row.requires_validity ?? row.REQUIRES_VALIDITY ?? "N").toUpperCase() === "S",
    })));
  } catch (error) { next(error); }
});

app.post("/v1/order-structure/:opCodigo/:structureCode/validate-lot", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const structureCode = Number(req.params.structureCode); const lot = String(req.body?.lot ?? "").trim();
    if (![opCodigo, structureCode].every((value) => Number.isInteger(value) && value > 0) || lot.length < 3) return res.status(400).json({ error: "Dados de rastreio inválidos." });
    const structureRows = await query(`select first 1 pvet.pc_codigo as product_code, coalesce(pc.pc_controlar_validade, 'N') as requires_validity
      from ordem_producao_estrutura ope
      inner join prod_vendas_est_produto pvet on pvet.pvet_codigo = ope.pvet_codigo and pvet.pv_codigo = ope.pv_codigo and pvet.pv_revisao = ope.pv_revisao
      inner join tipos_produtos tp on tp.tp_codigo = pvet.tp_codigo
      inner join unidade_medidas um on um.um_codigo = pvet.um_codigo
      left join produtos_compras pc on pc.pc_codigo = pvet.pc_codigo
      inner join prod_compras_fornecedor pcf on pc.pc_codigo = pcf.pc_codigo and pcf.pcf_codigo = 1
      where ope.ope_codigo = ? and ope.op_codigo = ?`, [structureCode, opCodigo]);
    const structure = structureRows[0];
    if (!structure) return res.status(404).json({ error: "Matéria-prima não encontrada na estrutura desta ordem." });
    const productCode = Number(structure.product_code ?? structure.PRODUCT_CODE);
    const requiresValidity = String(structure.requires_validity ?? structure.REQUIRES_VALIDITY ?? "N").toUpperCase() === "S";
    if (requiresValidity) {
      const validityRows = await query(`select first 1 cv_lote_interno from controle_validade where cv_lote_interno = ? and pc_codigo = ?`, [lot, productCode]);
      if (!validityRows[0]) return res.status(409).json({ error: "O lote informado não pertence à matéria-prima desta ordem ou não está no Controle de Validade." });
    }
    await query(`update ordem_producao_estrutura set pce_lote = ? where ope_codigo = ? and op_codigo = ?`, [lot, structureCode, opCodigo]);
    res.json({ success: true, lot });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/pause/start", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const operatorId = Number(req.body?.operatorId); const reasonCode = Number(req.body?.reasonCode);
    if (![opCodigo, mpCodigo, machineCode, operatorId, reasonCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de parada inválidos." });
    const processRows = await query(`select first 1 pv_codigo, pv_revisao, mp_posicao from mov_processos where op_codigo = ? and mp_codigo = ? and mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
    const movement = processRows[0];
    if (!movement) return res.status(404).json({ error: "Processo não encontrado para a máquina atual." });
    const currentPosition = movement.mp_posicao ?? movement.MP_POSICAO;
    if (!["SI", "PI"].includes(String(currentPosition))) return res.status(409).json({ error: "A parada só pode ser iniciada durante setup ou produção." });
    const activeRows = await query(`select count(*) as total from historico_paradas where op_codigo = ? and mqp_codigo = ? and hpar_situacao = 'A'`, [opCodigo, machineCode]);
    if (Number(activeRows[0]?.total ?? activeRows[0]?.TOTAL ?? 0) > 0) return res.status(409).json({ error: "Já existe uma parada em aberto para esta máquina." });
    const scheduleRows = await query(`select first 1 mph_codigo from mov_processos_horarios where mph_verificador = 'A' and op_codigo = ? and mp_codigo = ? and mqp_codigo = ? order by mph_codigo desc`, [opCodigo, mpCodigo, machineCode]);
    if (!scheduleRows[0]) return res.status(409).json({ error: "Não foi encontrado o horário ativo do processo." });
    const scheduleCode = Number(scheduleRows[0].mph_codigo ?? scheduleRows[0].MPH_CODIGO);
    const ids = await query(`select coalesce(max(hpar_codigo), 0) + 1 as id from historico_paradas`);
    const processSituationSql = String(currentPosition) === "PI" ? "_WIN1252 x'50726F6475E7E36F'" : "'Setup'";
    await query(`insert into historico_paradas (hpar_codigo, op_codigo, pv_codigo, pv_revisao, mo_codigo, hpar_hora_inicio, hpar_hora_fim, hpar_situacao, mqp_codigo, hpar_situacao_processo, usu_codigo, mph_codigo) values (?, ?, ?, ?, ?, current_timestamp, current_timestamp, 'A', ?, ${processSituationSql}, ?, ?)`, [Number(ids[0]?.id ?? ids[0]?.ID ?? 1), opCodigo, movement.pv_codigo ?? movement.PV_CODIGO, movement.pv_revisao ?? movement.PV_REVISAO, reasonCode, machineCode, operatorId, scheduleCode]);
    res.json({ success: true, scheduleCode });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/pause/finish", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const machineCode = Number(req.body?.machineCode);
    if (![opCodigo, machineCode].every((value) => Number.isInteger(value) && value > 0)) return res.status(400).json({ error: "Dados de parada inválidos." });
    const scheduleRows = await query(`select first 1 mph_codigo from mov_processos_horarios where mph_verificador = 'A' and op_codigo = ? and mqp_codigo = ? order by mph_codigo desc`, [opCodigo, machineCode]);
    if (!scheduleRows[0]) return res.status(409).json({ error: "Não foi encontrado o horário ativo do processo para finalizar a parada." });
    await query(`update historico_paradas set hpar_hora_fim = current_timestamp, hpar_situacao = 'F' where op_codigo = ? and mqp_codigo = ? and mph_codigo = ? and hpar_situacao = 'A'`, [opCodigo, machineCode, scheduleRows[0].mph_codigo ?? scheduleRows[0].MPH_CODIGO]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.post("/v1/pointing/:opCodigo/:mpCodigo/finish-production", ensureAuthorized, async (req, res, next) => {
  try {
    if (process.env.PRODUCTION_POINTING_WRITE_ENABLED?.trim().toUpperCase() !== "S") return res.status(403).json({ error: "A escrita de apontamento está bloqueada. Defina PRODUCTION_POINTING_WRITE_ENABLED=S apenas após validar uma ordem de teste." });
    const opCodigo = Number(req.params.opCodigo); const mpCodigo = Number(req.params.mpCodigo); const machineCode = Number(req.body?.machineCode); const operatorId = Number(req.body?.operatorId); const quantityProduced = Number(req.body?.quantityProduced); const quantityLost = Number(req.body?.quantityLost ?? 0); const quantityPeople = Number(req.body?.quantityPeople ?? 0); const productionDate = String(req.body?.productionDate ?? "").trim(); const outcome = String(req.body?.outcome ?? ""); const observation = String(req.body?.observation ?? "").trim(); const lotTrace = String(req.body?.lotTrace ?? "").trim();
    if (![opCodigo, mpCodigo, machineCode, quantityProduced, quantityLost, quantityPeople].every((value) => Number.isInteger(value) && value >= 0) || quantityProduced < 1 || quantityLost > quantityProduced) return res.status(400).json({ error: "Quantidades de produção inválidas." });
    if (!['attended', 'to_conclude', 'partial'].includes(outcome)) return res.status(400).json({ error: "Resultado de produção inválido." });
    if (productionDate && !/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) return res.status(400).json({ error: "Data de produção inválida." });
    if (!Number.isInteger(operatorId) || operatorId < 1) return res.status(400).json({ error: "Operador inválido para movimentação de estoque." });
    const result = await withTransaction(async (transaction) => {
      const processRows = await transaction.queryAsync(`select first 1 mp.mp_saldo, mp.mp_posicao, mp.mp_fila as queue, mp.pv_codigo, mp.pv_revisao,
        coalesce(mp.mp_pcs_conjunto, 1) as pieces_per_set, mp.pes_codigo as person_code,
        coalesce(mq.mqp_processo_manual, 'N') as manual_process, gm.gmq_grupo as machine_group
        from mov_processos mp inner join maquinas_processos mq on mq.mqp_codigo = mp.mqp_codigo
        left join grupo_maquinas gm on gm.gmq_codigo = mq.gmq_codigo
        where mp.op_codigo = ? and mp.mp_codigo = ? and mp.mqp_codigo = ?`, [opCodigo, mpCodigo, machineCode]);
      const movement = processRows[0];
      if (!movement) throw Object.assign(new Error("Processo não encontrado para a máquina atual."), { statusCode: 404 });
      if (String(movement.mp_posicao ?? movement.MP_POSICAO) !== "PI") throw Object.assign(new Error("A finalização só pode ocorrer durante a produção iniciada."), { statusCode: 409 });
      const activePause = await transaction.queryAsync(`select count(*) as total from historico_paradas where op_codigo = ? and mqp_codigo = ? and hpar_situacao = 'A'`, [opCodigo, machineCode]);
      if (Number(activePause[0]?.total ?? activePause[0]?.TOTAL ?? 0) > 0) throw Object.assign(new Error("Finalize a parada aberta antes de finalizar a produção."), { statusCode: 409 });
      const arrangementRows = await transaction.queryAsync(`select first 1 pvpp_codigo as process_production_code, coalesce(pvpp_arranjo_prod_total, 1) as arrangement_total, coalesce(pvpp_calcular_arranjo_prod, 'N') as calculate_production, coalesce(pvpp_calcular_arranjo_res, 'N') as calculate_reservation, coalesce(pvpp_baixar_estoque, 'N') as deduct_stock from prod_vendas_proc_prod where pv_codigo = ? and pv_revisao = ? and mqp_codigo = ? order by pvpp_codigo`, [Number(movement.pv_codigo ?? movement.PV_CODIGO), Number(movement.pv_revisao ?? movement.PV_REVISAO), machineCode]);
      const arrangement = arrangementRows[0] ?? {};
      const processArrangementTotal = Math.max(1, Number(arrangement.arrangement_total ?? arrangement.ARRANGEMENT_TOTAL ?? 1) || 1);
      const calculateProductionArrangement = String(arrangement.calculate_production ?? arrangement.CALCULATE_PRODUCTION ?? "N").trim().toUpperCase() === "S";
      const calculateReservationArrangement = String(arrangement.calculate_reservation ?? arrangement.CALCULATE_RESERVATION ?? "N").trim().toUpperCase() === "S";
      const processProductionCode = Number(arrangement.process_production_code ?? arrangement.PROCESS_PRODUCTION_CODE ?? 0);
      const manualProcess = String(movement.manual_process ?? movement.MANUAL_PROCESS ?? "N").trim().toUpperCase() === "S";
      const pointingGroup = isPointingMachineGroup(movement.machine_group ?? movement.MACHINE_GROUP);
      const specialSetMachine = isSpecialProductionMachine({ manualProcess, groupDescription: movement.machine_group ?? movement.MACHINE_GROUP });
      if (pointingGroup && !productionDate) throw Object.assign(new Error("Informe a data de produção do grupo Apontamento."), { statusCode: 400 });
      const manualStockDeduction = manualProcess && String(arrangement.deduct_stock ?? arrangement.DEDUCT_STOCK ?? "N").trim().toUpperCase() === "S";
      const reservation = await reservationContext(transaction, opCodigo, mpCodigo, machineCode, manualStockDeduction);
      const arrangementTotal = reservation.applies ? reservation.arrangementTotal : processArrangementTotal;
      const productionMultiplier = calculateProductionArrangement || calculateReservationArrangement ? arrangementTotal : 1;
      const reservationMultiplier = 1;
      const productionQuantity = quantityProduced * productionMultiplier;
      const productionLost = quantityLost * productionMultiplier;
      const netQuantity = productionQuantity - productionLost;
      const reservationQuantity = quantityProduced * reservationMultiplier;
      const currentBalance = Number(movement.mp_saldo ?? movement.MP_SALDO ?? 0);
      const quantityToPoint = reservation.applies ? currentBalance : Math.max(0, Number(reservation.indicatorQuantity ?? currentBalance));
      if (!reservation.applies && netQuantity > quantityToPoint) throw Object.assign(new Error(`A quantidade apontada excede o saldo disponível de ${quantityToPoint}.`), { statusCode: 409 });
      if (!reservation.applies && quantityToPoint > 0 && netQuantity >= quantityToPoint && outcome !== "attended") throw Object.assign(new Error(`A produção de ${netQuantity} cobre o saldo a apontar de ${quantityToPoint}. Finalize o processo como Atendido.`), { statusCode: 409 });
      if (!reservation.applies && outcome === "attended" && netQuantity < quantityToPoint) throw Object.assign(new Error(`O saldo a apontar é ${quantityToPoint}. Para atender o processo, informe essa quantidade; use Parcial ou A Concluir para quantidade menor.`), { statusCode: 409 });
      if (reservation.applies && outcome === "attended" && reservationQuantity < reservation.balance) throw Object.assign(new Error(`A reserva disponível é ${reservation.balance}. Para atender a produção, informe pelo menos ${reservation.balance / reservationMultiplier} na unidade apontada; use Parcial ou A Concluir para quantidade menor.`), { statusCode: 409 });
      if (reservation.applies && process.env.PRODUCTION_STOCK_WRITE_ENABLED?.trim().toUpperCase() !== "S") throw Object.assign(new Error("A baixa de reserva está protegida. Defina PRODUCTION_STOCK_WRITE_ENABLED=S apenas para validar a ordem de teste."), { statusCode: 403 });
      const status = outcome === "attended" ? "Atendido" : outcome === "to_conclude" ? "A Concluir" : "Parcial";
      const finishedClock = await consumeDailyClock(transaction, machineCode);
      const queue = outcome === "to_conclude" ? 1 : 2000;
      const position = outcome === "attended" ? "PF" : outcome === "to_conclude" ? "PI" : "PP";
      const nextBalance = reservation.applies ? Math.max(0, currentBalance - netQuantity) : Math.max(0, quantityToPoint - netQuantity);
      await transaction.queryAsync(`update mov_processos set mp_fila = ?, mp_qtde_produzida = coalesce(mp_qtde_produzida, 0) + ?, mp_status = ?, mp_qtde_perdida = coalesce(mp_qtde_perdida, 0) + ?, mp_fim = ?, mp_saldo = ?, mp_qtdeapontada = coalesce(mp_qtdeapontada, 0) + ?, mp_posicao = ?, mp_observacao = ?, mp_data_atendido = ? where mp_codigo = ? and op_codigo = ? and mqp_codigo = ?`, [queue, netQuantity, status, productionLost, finishedClock, nextBalance, productionQuantity, position, observation, finishedClock, mpCodigo, opCodigo, machineCode]);
      const completedQueue = Number(movement.queue ?? movement.QUEUE ?? 0);
      if (outcome === "attended" && !manualProcess && Number.isInteger(completedQueue) && completedQueue > 0 && completedQueue < 2000) {
        await transaction.queryAsync(`update mov_processos set mp_fila = mp_fila - 1
          where mqp_codigo = ? and mp_fila > ? and mp_fila < 2000`, [machineCode, completedQueue]);
      }
      await transaction.queryAsync(`update mov_processos_horarios set mph_fim = ?, mph_qtde_produzida = coalesce(mph_qtde_produzida, 0) + ?, mph_qtde_perdida = coalesce(mph_qtde_perdida, 0) + ?, mph_qtde_fun = ?, mph_observacao = ?, mph_verificador = 'F', mph_status = ?, mph_situacao = 'A', mph_rastreio_lotes = ? where mp_codigo = ? and op_codigo = ? and mqp_codigo = ? and mph_verificador = 'A'`, [finishedClock, netQuantity, productionLost, quantityPeople, observation, status, lotTrace, mpCodigo, opCodigo, machineCode]);
      let allocated = 0;
      if (reservation.applies) {
        let remaining = reservationQuantity;
        for (const reserve of reservation.rows) {
          if (remaining <= 0) break;
          const allocation = Math.min(remaining, reserve.balance);
          if (allocation <= 0) continue;
          const nextReserveBalance = reserve.balance - allocation;
          await transaction.queryAsync(`update estoque_reservado set er_status = ?, er_baixado = ?, er_saldo = er_saldo - ? where er_codigo = ? and op_codigo = ?`, [nextReserveBalance <= 0 ? "Atendido" : "Aberto", nextReserveBalance <= 0 ? "S" : "N", allocation, reserve.reserveCode, opCodigo]);
          await transaction.queryAsync(`execute procedure movimenta_estoque (?, ?, 1, ?, 'AP', 'N', 'S', 0, '', ?, 0, ?, ?, 2, ?, ?, ?, '', ?)`, [reserve.productCode, reserve.supplierCode, -allocation, reserve.personCode, opCodigo, reserve.lot, operatorId, reserve.stockZeroed, reserve.stockStatus, reserve.manufacturingDate ?? new Date()]);
          allocated += allocation;
          remaining -= allocation;
        }
      }
      const piecesPerSet = Math.max(1, Number(movement.pieces_per_set ?? movement.PIECES_PER_SET ?? 1) || 1);
      const finishedGoodsQuantity = netQuantity * piecesPerSet;
      if (manualProcess && pointingGroup && finishedGoodsQuantity > 0) {
        if (process.env.PRODUCTION_STOCK_WRITE_ENABLED?.trim().toUpperCase() !== "S") throw Object.assign(new Error("A movimentação de estoque do processo manual está protegida. Defina PRODUCTION_STOCK_WRITE_ENABLED=S apenas para validar uma ordem de teste."), { statusCode: 403 });
        const productionDateValue = new Date(`${productionDate}T12:00:00`);
        await transaction.queryAsync(`execute procedure movimenta_estoque (?, ?, 1, ?, 'AP', 'N', 'S', 0, '', ?, 0, ?, ?, 3, ?, '', 'Não Conferido', '', ?)`, [Number(movement.pv_codigo ?? movement.PV_CODIGO), Number(movement.pv_revisao ?? movement.PV_REVISAO), finishedGoodsQuantity, Number(movement.person_code ?? movement.PERSON_CODE ?? 0), opCodigo, String(opCodigo), operatorId, productionDateValue]);
        await transaction.queryAsync(`update ordens_producao set op_produzido = coalesce(op_produzido, 0) + ?, op_status = ? where op_codigo = ?`, [finishedGoodsQuantity, status, opCodigo]);
      }
      const specialProduction = specialSetMachine ? await synchronizeSpecialProductionComponents(transaction, { opCodigo, machineCode, operatorId, producedQuantity: productionQuantity, lostQuantity: productionLost, quantityPeople, queue, status, position, finishedAt: finishedClock, observation, lotTrace, insertFinishedStock: manualProcess && pointingGroup, productionDate: pointingGroup ? new Date(`${productionDate}T12:00:00`) : finishedClock }) : { isSpecial: false, specialCode: null, primaryOpCode: opCodigo, components: [], updated: [], skipped: [] };
      return { status, balance: nextBalance, reservation: reservation.balance, quantityToPoint, previousProcessName: reservation.previousProcessDescription, allocated, processProductionCode, arrangementTotal, calculateProductionArrangement, calculateReservationArrangement, enteredQuantity: quantityProduced, productionMultiplier, productionQuantity, reservationMultiplier, reservationQuantity, quantityPeople, manualProcess, pointingGroup, productionDate: pointingGroup ? productionDate : null, finishedGoodsQuantity, specialProduction };
    });
    res.json({ success: true, ...result });
  } catch (error) { if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error); }
});

app.get("/v1/products", ensureAuthorized, async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const filter = `(? = '' or cast(pv.pv_codigo as varchar(20)) containing ? or coalesce(pv.pv_referencia, '') containing ? or coalesce(pv.pv_cod_prod_cli, '') containing ?)`;
    const params = [search, search, search, search];
    const result = await paged(
      (limit, offset) => `
        select first ${limit} skip ${offset}
          pv.pv_codigo as codigo, pv.pv_revisao as revisao, pv.pv_referencia as referencia,
          pv.pv_cod_prod_cli as codigo_cliente, pv.pv_medida_larg as largura,
          pv.pv_medida_comp as comprimento, pv.pv_medida_alt as altura,
          pv.pv_fechamento as fechamento, pv.pv_impressao as impressao
        from produtos_vendas pv
        where ${filter}
        order by pv.pv_codigo desc
      `,
      `select count(*) as total from produtos_vendas pv where ${filter}`,
      params,
      req,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/stock", ensureAuthorized, async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const filter = `(? = '' or cast(pv.produto_vendas as varchar(20)) containing ? or coalesce(pv.referencia, '') containing ? or coalesce(pv.fantasia, '') containing ?)`;
    const params = [search, search, search, search];
    const result = await paged(
      (limit, offset) => `
        select first ${limit} skip ${offset}
          ea.produto_venda as produto_codigo, ea.codigo_estoque as codigo_estoque,
          ea.ea_quantidade as saldo_1, ea.ea_quantidade_2 as saldo_2,
          pv.referencia as referencia, pv.fantasia as cliente
        from estoque_acabados ea
        inner join produto_vendas pv on pv.cod_estoque = ea.codigo_estoque
        where ${filter}
        order by pv.referencia
      `,
      `select count(*) as total from estoque_acabados ea inner join produto_vendas pv on pv.cod_estoque = ea.codigo_estoque where ${filter}`,
      params,
      req,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/stock/history", ensureAuthorized, async (req, res, next) => {
  try {
    const result = await paged(
      (limit, offset) => `
        select first ${limit} skip ${offset}
          pve.pve_codigo as codigo, pve.pv_codigo as produto_codigo,
          pve.pv_revisao as revisao, pve.op_codigo as ordem_producao,
          pve.pve_quantidade as quantidade, pve.pve_saldo as saldo,
          pve.pve_data_producao as data_producao, pve.pve_lote as lote
        from prod_vendas_estoque pve
        order by pve.pve_data_producao desc
      `,
      "select count(*) as total from prod_vendas_estoque",
      [],
      req,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error("[Firebird Proxy]", error);
  res.status(503).json({ error: "O Firebird não está disponível para o proxy local." });
});

const server = app.listen(proxyPort, proxyHost, () => {
  console.log(`Proxy Firebird local ativo em http://${proxyHost}:${proxyPort} · build ${proxyBuild}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    server.close();
    await pool.destroyAsync();
    process.exit(0);
  });
}
