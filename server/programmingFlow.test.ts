import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("fluxo de programação do operador", () => {
  it("filtra e autoriza os status operacionais, incluindo Parcial apenas na Coladeira", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain("'SETUP A CONCLUIR'${coladeiraMachine ? \", 'PARCIAL'\" : \"\"}");
    expect(proxySource).toContain("const startableStatuses = ['Liberado', 'Aberto', 'A Concluir', 'Setup a Concluir', ...(coladeiraMachine ? ['Parcial'] : [])]");
    expect(pageSource).toContain('["Liberado", "Aberto", "A Concluir", "Setup a Concluir", ...(coladeiraMachine ? ["Parcial"] : [])].includes(item.status ?? "")');
    expect(pageSource).not.toContain('item.status === "Liberado" && item.fila === 1');
  });

  it("retorna à Programação após finalizar a produção", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(pageSource).toContain('toast.success(`Produção finalizada: ${result.status}. Saldo: ${result.balance}.`');
    expect(pageSource).toContain('const synchronized = result.specialProduction?.updated?.length ?? 0');
    expect(pageSource).toContain('PVPP ${result.processProductionCode || "não localizado"}');
    expect(pageSource).toContain('setLocation("/")');
    expect(homeSource).toContain('import Programming from "./Programming"');
    expect(homeSource).toContain("return <Programming />");
  });

  it("mantém os status operacionais agrupados e reinicia A Concluir com um novo ciclo de horário", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(pageSource).toContain('const eligibleStatus = ["Liberado", "Aberto", "A Concluir", "Setup a Concluir", ...(coladeiraMachine ? ["Parcial"] : [])]');
    expect(proxySource).toContain('const resumingToConclude = String(movement.mp_status) === "A Concluir"');
    expect(proxySource).toContain("mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null");
    expect(proxySource).toContain("insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, op_codigo");
    expect(proxySource).toContain("return res.json(resumed)");
  });

  it("usa o cronômetro diário no novo setup e mantém timestamp direto na retomada A Concluir", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain("async function consumeDailyClock(executor, machineCode)");
    expect(proxySource).toContain("where mqp_codigo = ? and cdp_status = 'Iniciado'");
    expect(proxySource).toContain("select current_timestamp as clock_value from rdb$database");
    expect(proxySource).toContain("update contador_diario_processos set cdp_cronometro = ? where cdp_codigo = ?");
    expect(proxySource).toContain("const setupClock = await consumeDailyClockForMachine(machineCode)");
    expect(proxySource).toContain("mp_inicio_ajuste = ?, mp_fim_ajuste = null, mp_inicio = null, mp_fim = null");
    expect(proxySource).toContain("mph_inicio_setup, op_codigo");
    expect(proxySource).toContain("mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null");
    expect(proxySource).toContain("const finishedClock = await consumeDailyClock(transaction, machineCode)");
    const resumeBlock = proxySource.slice(proxySource.indexOf('const resumingToConclude = String(movement.mp_status) === "A Concluir"'), proxySource.indexOf('const sequenceRows = await query'));
    expect(resumeBlock).toContain("mph_inicio");
    expect(resumeBlock).not.toContain("consumeDailyClock");
  });

  it("restringe máquinas regulares à fila 1 e mantém A Concluir prioritária com cronômetro de produção", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const pointingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(proxySource).toContain("Somente a fila 1 pode iniciar a produção.");
    expect(proxySource).toContain("Existe uma ordem A Concluir prioritária nesta máquina.");
    expect(programmingSource).toContain("const hasPriorityToConclude");
    expect(programmingSource).toContain("const isPriorityRow = coladeiraMachine || Number(item.fila) === 1");
    expect(pointingSource).toContain("const resumedToConclude = productionStarted && !item?.activeSetupStartedAt");
    expect(pointingSource).toContain('setupStarted && !productionStarted ? "Início do Setup" : "Início da Produção"');
    expect(pointingSource).toContain('setupStarted && !productionStarted ? "Fim do Setup" : "Fim da Produção"');
  });

  it("retoma A Concluir pela fila e confirma a inclusão do novo horário na mesma transação", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain("const resumeToConclude = trpc.production.pointing.startSetup.useMutation");
    expect(programmingSource).toContain("const startNewSetup = trpc.production.pointing.startSetup.useMutation");
    expect(programmingSource).toContain('item.status === "A Concluir" ? resumeToConclude.mutate');
    expect(programmingSource).toContain("startNewSetup.mutate");
    expect(proxySource).toContain("const resumed = await withTransaction(async (transaction) =>");
    expect(proxySource).toContain("mp_status = 'Em Produção', mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null");
    expect(proxySource).toContain("insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio");
    expect(proxySource).toContain("A retomada não gerou o novo registro de horário.");
  });

  it("mantém as chamadas superiores disponíveis tanto em setup quanto em produção", () => {
    const pointingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(pointingSource).toContain("{item ? <div className=\"flex flex-wrap items-center gap-2 xl:justify-end\">");
    expect(pointingSource).toContain('if (event.key === "F4") { event.preventDefault(); setShowPalletization(true); return; }');
    expect(pointingSource).toContain('if (!productionStarted) return;');
    expect(pointingSource).toContain('if (outcome) { event.preventDefault(); closeSetup(outcome); return; }');
  });

  it("recupera uma OP Em Produção da máquina ao entrar novamente após reinício", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractsSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain('app.get("/v1/programming/active"');
    expect(proxySource).toContain("containing 'PRODU'");
    expect(contractsSource).toContain("export type ActiveProductionRecovery");
    expect(contractsSource).toContain("export const getActiveProduction");
    expect(routerSource).toContain("active: operatorProcedure");
    expect(programmingSource).toContain("trpc.production.programming.active.useQuery");
    expect(programmingSource).toContain("OP em Produção Recuperada");
    expect(programmingSource).toContain("Você Será Direcionado ao Apontamento para Continuar ou Finalizar o Processo.");
    expect(programmingSource).toContain('manualPointing ? "/apontamento-manual" : "/apontamento"');
    expect(programmingSource).toContain("active.opCodigo");
  });

  it("simplifica a saída do operador e prepara as opções operacionais", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    expect(programmingSource).toContain("Fechar");
    expect(programmingSource).toContain("await logout()");
    expect(programmingSource).toContain("window.close()");
    expect(programmingSource).toContain("Iniciar Limpeza");
    expect(programmingSource).toContain("Trocar Operador");
    expect(programmingSource).toContain("Fim do Período");
    expect(programmingSource).toContain("Iniciar Limpeza");
    expect(programmingSource).toContain("w-[min(96vw,860px)] max-w-[860px] max-h-[calc(100dvh-1rem)] overflow-y-auto");
    expect(programmingSource).toContain("grid grid-cols-2 gap-5 p-5 sm:p-6");
    expect(programmingSource).toContain("min-h-40");
  });

  it("grava limpeza e fim de período no histórico de ociosidade da Máquina/Processo", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain('app.post("/v1/programming/idle-event"');
    expect(proxySource).toContain("insert into motivo_ociosidade (mqp_codigo, mo_codigo, mto_data, mto_hora_inicio, usu_codigo, mto_hora_fim)");
    expect(proxySource).toContain("eventType === \"cleaning\" ? Number(req.body?.reasonCode) : 63");
    expect(proxySource).toContain("mqp_status_processo = 'Em Fila'");
    expect(contractSource).toContain("export const recordIdleEvent");
    expect(routerSource).toContain("recordIdleEvent: operatorProcedure");
    expect(programmingSource).toContain("trpc.production.programming.recordIdleEvent.useMutation");
    expect(programmingSource).toContain('recordIdleEvent.mutate({ eventType: "cleaning", reasonCode: selectedCleaningReason })');
    expect(programmingSource).toContain('recordIdleEvent.mutate({ eventType: "end-period" })');
    expect(programmingSource).toContain("Máquina/Processo");
  });

  it("mantém os campos operacionais no grid, busca superior, barra de chamadas e sequência de processos", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");

    expect(proxySource).toContain("pv.pv_cod_prod_cli");
    expect(proxySource).toContain("varchar(255)");
    expect(proxySource).toContain("p.pes_fantasia");
    expect(proxySource).toContain("coalesce(mp.mp_fantasia, p.pes_fantasia, mp.mp_cliente, '') containing ?");
    expect(proxySource).toContain("mp.mp_situacao_lib as process_situation");
    expect(proxySource).toContain("pv.pv_total_larg_cn as adjustment_width_total");
    expect(proxySource).toContain('app.get("/v1/programming/cleaning-reasons"');
    expect(proxySource).toContain("mp.mp_op_mestre as master_order");
    expect(programmingSource).toContain("Cliente, Código Prod., OP ou Referência");
    expect(programmingSource).toContain("Qtde. OP");
    expect(programmingSource).toContain("Produzida");
    expect(programmingSource).toContain("Saldo");
    expect(programmingSource).toContain("processSequence");
    expect(programmingSource).toContain("processStatusClass(process.status)");
    expect(programmingSource).toContain("Pacotes / Paletização");
    expect(programmingSource).toContain("Visualizar Layout");
    expect(programmingSource).toContain("Qtde. Aprovada");
    expect(programmingSource).toContain("Etiqueta de Processo");
    expect(programmingSource).toContain("sticky bottom-0");
    expect(programmingSource).toContain("user?.name");
    expect(programmingSource).toContain("Ajuste Largura");
    expect(programmingSource).toContain("Clichês / Facas");
    expect(programmingSource).toContain('placeholder="Cliente, Código Prod., OP ou Referência"');
    expect(programmingSource).toContain('const OPERATIONAL_STATUS_FILTER_OPTIONS = ["Liberado", "Parcial", "Em Produção"]');
    expect(programmingSource).toContain("const pointingMachine = operator && isApontamentoMachineGroup(machine?.groupDescription)");
    expect(programmingSource).toContain('{pointingMachine ? <OperatorCallButton label="Etiqueta PA"');
    expect(programmingSource).toContain('text-2xl font-black text-[#135440]">· total');
    expect(programmingSource).toContain("selectedPrintLayout.data?.colors");
    expect(contractSource).toContain("export const getCleaningReasons");
    expect(routerSource).toContain("cleaningReasons: operatorProcedure");
  });

  it("mantém oito linhas na Programação de Operadores e na Liberação, sem Sequência da máquina", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain("const programmingLimit = qualityRelease || (operator && !manualPointing) ? 8 : 7");
    expect(programmingSource).toContain("limit={programmingLimit}");
    expect(programmingSource).toContain('theme-programming ${programmer ? "programming-programmer" : ""} ${operator ? "flex min-h-dvh flex-col gap-3" : "space-y-4"}');
    expect(programmingSource).toContain('operator ? "flex min-h-0 flex-1 flex-col" : ""');
    expect(programmingSource).toContain('operator ? "min-h-[440px] flex-1"');
    expect(programmingSource).not.toContain('title="Sequência da máquina"');
    expect(programmingSource).toContain("onClick={() => setSelectedProcess({ opCode: item.op_codigo");
    expect(programmingSource).toContain('cursor-pointer transition-colors');
  });

  it("permite iniciar Coladeira em qualquer fila e oculta sua coluna de fila", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const themeSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(proxySource).toContain("function isColadeiraMachineGroup(groupName)");
    expect(proxySource).toContain("if (!coladeiraMachine && Number(movement.mp_fila) !== 1)");
    expect(proxySource).toContain("if (!isColadeiraMachineGroup(current.group_description ?? current.GROUP_DESCRIPTION) && Number(current.mp_fila ?? current.MP_FILA) !== 1)");
    expect(programmingSource).toContain("function isColadeiraMachineGroup(groupName: string | null | undefined)");
    expect(programmingSource).toContain("const coladeiraMachine = operator && isColadeiraMachineGroup(machine?.groupDescription)");
    expect(programmingSource).toContain("manualPointing || coladeiraMachine ? \"\" : ` · Fila");
    expect(programmingSource).toContain("const isPriorityRow = coladeiraMachine || Number(item.fila) === 1");
    expect(themeSource).toContain(".programming-coladeira .programming-grid :is(thead tr, tbody tr) > :first-child { display: none; }");
    expect(programmingSource).toContain("const OPERATIONAL_STATUS_FILTER_OPTIONS");
    expect(programmingSource).toContain("manualPointing || coladeiraMachine ? statusFilter");
    expect(programmingSource).toContain("flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-end");
    expect(programmingSource).not.toContain('manualPointing || coladeiraMachine ? <section className="theme-filter-band');
    expect(themeSource).toContain(".theme-machine-band .theme-config-trigger { border-color: #fff !important; background: #fff !important;");
  });

  it("libera processo Parcial movido de fila e compacta a fila após atendimento do Operador", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain('const releasedFromPartial = currentStatus.toLocaleLowerCase("pt-BR") === "parcial"');
    expect(proxySource).toContain('const nextStatus = releasedFromQueue2000 || releasedFromPartial ? "Liberado" : currentStatus');
    expect(proxySource).toContain('if (outcome === "attended" && !manualProcess && Number.isInteger(completedQueue) && completedQueue > 0 && completedQueue < 2000)');
    expect(proxySource).toContain('where mqp_codigo = ? and mp_fila > ? and mp_fila < 2000');
  });

  it("renova o contador diário vencido antes de fornecer o horário de fechamento", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain("async function ensureDailyClock(executor, machineCode)");
    expect(proxySource).toContain("cdp_status = 'Iniciado' and cdp_data = current_date");
    expect(proxySource).toContain("set cdp_fim = coalesce(cdp_cronometro, current_timestamp), cdp_status = 'Finalizado'");
    expect(proxySource).toContain("async function consumeDailyClock(executor, machineCode)");
    expect(proxySource).toContain("const counter = await ensureDailyClock(executor, machineCode)");
    expect(proxySource).toContain("if (machine?.code) await initializeDailyClockForMachine(Number(machine.code))");
  });

  it("permite ao Programador selecionar máquina controlada e filtrar a fila por status", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain('app.get("/v1/programming/machines"');
    expect(proxySource).toContain("mqp.mqp_processo_controlado = 'S'");
    expect(proxySource).toContain("const statusFilter = String(req.query.status ?? \"Todos\").trim()");
    expect(contractSource).toContain("export type ControlledMachine");
    expect(contractSource).toContain("export const getControlledMachines");
    expect(routerSource).toContain("machines: programmerProcedure");
    expect(programmingSource).toContain("Selecionar Máquina Controlada");
    expect(programmingSource).toContain("A Lib/Lib/Parcial");
    expect(programmingSource).toContain("firstDisplayName(user?.name)");
  });

  it("remove a faixa Sequência da máquina e preserva a grade compacta da Programação", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).not.toContain('title="Sequência da máquina"');
    expect(programmingSource).not.toContain('title={operator ? "Sequência da máquina" : "Programação e fila"}');
    expect(programmingSource).toContain('programmer ? "hidden min-h-[388px] md:block" : ""');
  });

  it("padroniza a leitura tipográfica de todas as colunas do grid pela referência do Cliente", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const cssSource = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

    expect(programmingSource).toContain('programming-grid w-full text-left text-sm ${manualPointing ? "min-w-[1250px]" : "min-w-[1600px]"}');
    expect(cssSource).toContain(".programming-grid tbody td");
    expect(cssSource).toContain("font-size: 0.875rem !important");
  });

  it("reorganiza a fila conforme as proteções operacionais do legado", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain('app.patch("/v1/programming/:opCodigo/:mpCodigo/queue"');
    expect(proxySource).toContain('["A Concluir", "Setup a Concluir"].includes(currentStatus)');
    expect(proxySource).toContain("Não é permitido alterar uma fila para ela mesma.");
    expect(proxySource).toContain("Não é permitido alterar para uma fila maior que ela mesma.");
    expect(proxySource).toContain("Existe um processo em produção na fila 1.");
    expect(proxySource).toContain("Existe um processo A Concluir na fila 1.");
    expect(proxySource).toContain("Existe um processo Setup a Concluir na fila 1.");
    expect(proxySource).toContain('if (error?.statusCode) return res.status(error.statusCode).json({ error: error.message }); next(error);');
    expect(proxySource).toContain("const temporaryOffset = 1000000");
    expect(proxySource).toContain('const releasedFromQueue2000 = currentStatus.toLocaleLowerCase("pt-BR") === "a liberar" && currentQueue === 2000 && targetQueue < 2000');
    expect(proxySource).toContain('const releasedFromPartial = currentStatus.toLocaleLowerCase("pt-BR") === "parcial"');
    expect(proxySource).toContain('const nextStatus = releasedFromQueue2000 || releasedFromPartial ? "Liberado" : currentStatus');
    expect(proxySource).toContain("update mov_processos set mp_fila = ?, mp_status = ?");
    expect(programmingSource).toContain("window.setTimeout(reloadProgrammingPreservingMachine, 180)");
    expect(programmingSource).toContain('result.releasedFromPartial ? " e Atualizada de Parcial para Liberado." : "."');
    expect(contractSource).toContain("export const changeOrderQueue");
    expect(routerSource).toContain("changeQueue: programmerProcedure");
    expect(programmingSource).toContain("trpc.production.programming.changeQueue.useMutation");
  });

  it("mostra bloqueios de fila no modal operacional padronizado", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain('import { OperationalMessageDialog } from "@/components/OperationalConfirmDialog"');
    expect(programmingSource).toContain('const [queueMessage, setQueueMessage] = useState<QueueMessage | null>(null)');
    expect(programmingSource).toContain('title={queueMessage.title}');
    expect(programmingSource).toContain('tone="caution"');
    expect(programmingSource).toContain("function operationalQueueMessage");
    expect(programmingSource).toContain("Não Foi Possível Alterar a Fila Neste Momento.");
    expect(programmingSource).toContain("setQueueMessage(operationalQueueMessage(error.message))");
    expect(programmingSource).toContain("Existe um Processo em Produção na Fila 1.");
    expect(programmingSource).toContain("const reloadAfterQueueWarning = () =>");
    expect(programmingSource).toContain("window.localStorage.setItem(PROGRAMMER_MACHINE_CACHE_KEY, String(machineCode))");
    expect(programmingSource).toContain("window.location.reload()");
  });

  it("lista no modal apenas máquinas elegíveis para alteração de processo", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain('app.get("/v1/programming/:opCodigo/:mpCodigo/eligible-machines"');
    expect(proxySource).toContain("candidate.gmq_codigo = case when current_machine.gmq_codigo = 4 then 6 when current_machine.gmq_codigo = 6 then 4 else 0 end");
    expect(proxySource).toContain("pvp.pv_codigo = source.pv_codigo and pvp.pv_revisao = source.pv_revisao");
    expect(contractSource).toContain("export const getEligibleProcessMachines");
    expect(routerSource).toContain("eligibleMachines: programmerProcedure");
    expect(programmingSource).toContain("Alterar Processo");
    expect(programmingSource).toContain("Confirmar Transferência");
    expect(programmingSource).not.toContain("window.prompt(\"Informe o código do novo processo/máquina:\")");
  });

  it("mantém máquina selecionada, status abreviados, atualização explícita e saída pelo Fechar", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain('PROGRAMMER_MACHINE_CACHE_KEY = "production-programming-machine-code"');
    expect(programmingSource).toContain("window.localStorage.setItem(PROGRAMMER_MACHINE_CACHE_KEY");
    expect(programmingSource).toContain('const [statusFilter, setStatusFilter] = useState("A Lib/Lib/Parcial")');
    expect(programmingSource).toContain("Number(item.code) === Number(selectedMachineCode)");
    expect(programmingSource).toContain("process.status ?? \"Sem Status\"");
    expect(programmingSource).not.toContain("programmingStatusLabel");
    expect(programmingSource).toContain("const refreshProgramming = async () =>");
    expect(programmingSource).toContain("Programação Atualizada");
    expect(programmingSource).toContain("onClick={manualPointing ? signOut : operator ? () => setShowExitOptions(true) : signOut}");
    expect(programmingSource).toContain('operator ? "flex min-h-dvh flex-col gap-3" : "space-y-4"');
    expect(programmingSource).toContain('selectedItem ? <section className="theme-details-panel');
    expect(programmingSource).not.toContain(">Deslogar</Button>");
  });

  it("restaura a Programação de Liberação com os indicadores e o filtro de processos iniciados", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain("const releaseStartedOnly = String(req.query.releaseStartedOnly");
    expect(proxySource).toContain("if (releaseStartedOnly) filterParts.push");
    expect(contractSource).toContain("releaseStartedOnly = false");
    expect(routerSource).toContain("releaseStartedOnly: z.boolean().default(false)");
    expect(programmingSource).toContain("const [releaseStartedOnly, setReleaseStartedOnly] = useState(false)");
    expect(programmingSource).toContain("Mostrar apenas processos já iniciados ou atendidos anteriormente");
    expect(programmingSource).toContain("Lote {displayValue(selectedReleasePlan.data?.lotSize)}");
    expect(programmingSource).toContain("Amostra {displayValue(selectedReleasePlan.data?.sampleSize)}");
    expect(programmingSource).toContain("N {displayValue(selectedReleasePlan.data?.acceptableLimit)}");
    expect(programmingSource).toContain("NC {displayValue(selectedReleasePlan.data?.nonConformingLimit)}");
  });
});
