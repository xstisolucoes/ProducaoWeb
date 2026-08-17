import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("fluxo de programação do operador", () => {
  it("filtra e autoriza somente Aberto, A Concluir e Setup a Concluir", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(proxySource).toContain("upper(trim(coalesce(mp.mp_status, ''))) in ('LIBERADO', 'ABERTO', 'A CONCLUIR', 'SETUP A CONCLUIR')");
    expect(proxySource).toContain("if (!['Liberado', 'Aberto', 'A Concluir', 'Setup a Concluir'].includes(String(movement.mp_status)))");
    expect(pageSource).toContain('["Liberado", "Aberto", "A Concluir", "Setup a Concluir"].includes(item.status ?? "")');
    expect(pageSource).not.toContain('item.status === "Liberado" && item.fila === 1');
  });

  it("retorna à Programação após finalizar a produção", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(pageSource).toContain('toast.success(`Produção finalizada: ${result.status}. Saldo: ${result.balance}.`, { description: `PVPP ${result.processProductionCode || "não localizado"}');
    expect(pageSource).toContain('setLocation("/")');
    expect(homeSource).toContain('import Programming from "./Programming"');
    expect(homeSource).toContain("return <Programming />");
  });

  it("mantém os status operacionais agrupados e reinicia A Concluir com um novo ciclo de horário", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(pageSource).toContain('const eligibleStatus = ["Liberado", "Aberto", "A Concluir", "Setup a Concluir"]');
    expect(proxySource).toContain('const resumingToConclude = String(movement.mp_status) === "A Concluir"');
    expect(proxySource).toContain("mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null");
    expect(proxySource).toContain("insert into mov_processos_horarios (mph_data, usu_codigo, mph_inicio, op_codigo");
    expect(proxySource).toContain("return res.json(resumed)");
  });

  it("usa o cronômetro diário no novo setup e mantém timestamp direto na retomada A Concluir", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxySource).toContain("async function consumeDailyClock(executor, machineCode)");
    expect(proxySource).toContain("where mqp_codigo = ? and cdp_status = 'Iniciado'");
    expect(proxySource).toContain("update contador_diario_processos set cdp_cronometro = current_timestamp");
    expect(proxySource).toContain("const setupClock = await consumeDailyClockForMachine(machineCode)");
    expect(proxySource).toContain("mp_inicio_ajuste = ?, mp_fim_ajuste = null, mp_inicio = null, mp_fim = null");
    expect(proxySource).toContain("mph_inicio_setup, op_codigo");
    expect(proxySource).toContain("mp_posicao = 'PI', mp_inicio = current_timestamp, mp_fim = null");
    expect(proxySource).toContain("const finishedClock = await consumeDailyClock(transaction, machineCode)");
    const resumeBlock = proxySource.slice(proxySource.indexOf('const resumingToConclude = String(movement.mp_status) === "A Concluir"'), proxySource.indexOf('const sequenceRows = await query'));
    expect(resumeBlock).toContain("mph_inicio");
    expect(resumeBlock).not.toContain("consumeDailyClock");
  });

  it("restringe o início à fila 1 e mantém A Concluir prioritária com cronômetro de produção", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const pointingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(proxySource).toContain("Somente a fila 1 pode iniciar a produção.");
    expect(proxySource).toContain("Existe uma ordem A Concluir prioritária nesta máquina.");
    expect(programmingSource).toContain("const hasPriorityToConclude");
    expect(programmingSource).toContain("const isPriorityRow = Number(item.fila) === 1");
    expect(pointingSource).toContain("const resumedToConclude = productionStarted && !item?.activeSetupStartedAt");
    expect(pointingSource).toContain('setupStarted && !productionStarted ? "Início do setup" : "Início da produção"');
    expect(pointingSource).toContain('setupStarted && !productionStarted ? "Fim do setup" : "Fim da produção"');
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
    expect(programmingSource).toContain("OP em produção recuperada");
    expect(programmingSource).toContain("Você será direcionado ao apontamento para continuar ou finalizar o processo.");
    expect(programmingSource).toContain("setLocation(`/apontamento/${active.opCodigo}/${active.mpCodigo}`)");
  });

  it("simplifica a saída do operador e prepara as opções operacionais", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    expect(programmingSource).toContain("Fechar");
    expect(programmingSource).toContain("await logout()");
    expect(programmingSource).toContain("window.close()");
    expect(programmingSource).toContain("Iniciar limpeza");
    expect(programmingSource).toContain("Trocar operador");
    expect(programmingSource).toContain("Fim do período");
    expect(programmingSource).toContain("Checklist de limpeza");
  });

  it("mantém os campos operacionais no grid, busca superior, barra de chamadas e sequência de processos", () => {
    const proxySource = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");

    expect(proxySource).toContain("pv.pv_cod_prod_cli");
    expect(proxySource).toContain("varchar(255)");
    expect(proxySource).toContain("p.pes_fantasia");
    expect(proxySource).toContain("mp.mp_situacao_lib as process_situation");
    expect(proxySource).toContain("pv.pv_total_larg_cn as adjustment_width_total");
    expect(proxySource).toContain('app.get("/v1/programming/cleaning-reasons"');
    expect(proxySource).toContain("mp.mp_op_mestre as master_order");
    expect(programmingSource).toContain("Código prod. cliente, OP ou referência");
    expect(programmingSource).toContain("Qtde. OP");
    expect(programmingSource).toContain("Produzida");
    expect(programmingSource).toContain("Saldo");
    expect(programmingSource).toContain("processSequence");
    expect(programmingSource).toContain("processStatusClass(process.status)");
    expect(programmingSource).toContain("Pacotes / Paletização");
    expect(programmingSource).toContain("Visualizar layout");
    expect(programmingSource).toContain("Qtde aprovada");
    expect(programmingSource).toContain("Etiqueta de processo");
    expect(programmingSource).toContain("sticky bottom-0");
    expect(programmingSource).toContain("user?.name");
    expect(programmingSource).toContain("Ajuste largura");
    expect(programmingSource).toContain("Clichês / facas");
    expect(programmingSource).toContain("selectedPrintLayout.data?.colors");
    expect(contractSource).toContain("export const getCleaningReasons");
    expect(routerSource).toContain("cleaningReasons: operatorProcedure");
  });

  it("limita o grid a sete linhas, remove o texto auxiliar e seleciona a OP em ambos os perfis", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain("{ page, limit: 7, search, machineCode: activeMachineCode");
    expect(programmingSource).toContain("limit={7}");
    expect(programmingSource).toContain('description=""');
    expect(programmingSource).toContain("onClick={() => setSelectedProcess({ opCode: item.op_codigo");
    expect(programmingSource).toContain('cursor-pointer transition-colors');
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
    expect(programmingSource).toContain("Selecionar máquina controlada");
    expect(programmingSource).toContain("A Lib/Lib/Parcial");
    expect(programmingSource).toContain("user?.name || \"—\"");
  });

  it("compacta o Programador sem títulos redundantes e preserva a altura de sete linhas no grid", () => {
    const programmingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Programming.tsx"), "utf8");

    expect(programmingSource).toContain('{operator ? <PageHeading eyebrow="" title="Sequência da máquina" description="" compact /> : null}');
    expect(programmingSource).not.toContain('title={operator ? "Sequência da máquina" : "Programação e fila"}');
    expect(programmingSource).toContain('programmer ? "min-h-[388px]" : ""');
  });
});
