import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Inspeção de Processo periódica", () => {
  const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
  const contracts = readFileSync(resolve(process.cwd(), "server/firebirdProxy.ts"), "utf8");
  const router = readFileSync(resolve(process.cwd(), "server/routers/production.ts"), "utf8");
  const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

  it("consulta os motivos de Inspeção de Processo por grupo e registra no horário ativo", () => {
    expect(proxy).toContain('PRODUCTION_PROCESS_INSPECTION_INTERVAL_MINUTES');
    expect(proxy).toContain('app.get("/v1/pointing/process-inspection-checklist", ensureAuthorized');
    expect(proxy).toContain("where m.mo_tipo = 'Inspeção de Processo'");
    expect(proxy).toContain('app.post("/v1/pointing/:opCodigo/:mpCodigo/complete-process-inspection", ensureAuthorized');
    expect(proxy).toContain("mph_inspecao_processo = case");
    expect(proxy).toContain("mph_verificador = 'A'");
    expect(proxy).toContain("processInspectionTimestampSql");
    expect(proxy).toContain("|| '/' ||");
    expect(proxy).toContain("|| ' - ' ||");
  });

  it("expõe o contrato protegido e abre o checklist no intervalo configurado", () => {
    expect(contracts).toContain("export type ProcessInspectionChecklist");
    expect(contracts).toContain("getProcessInspectionChecklist");
    expect(contracts).toContain("completeProcessInspection");
    expect(router).toContain("processInspectionChecklist: operatorProcedure.query");
    expect(router).toContain("completeProcessInspection: operatorProcedure.input");
    expect(pointing).toContain("window.setTimeout");
    expect(pointing).toContain("PRODUÇÃO em andamento".replace("PRODUÇÃO", "Produção"));
    expect(pointing).toContain("Inspeção de Processo obrigatória");
  });

  it("impede o fechamento até que todos os itens obrigatórios sejam confirmados", () => {
    expect(pointing).toContain("onEscapeKeyDown={(event) => event.preventDefault()}");
    expect(pointing).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
    expect(pointing).toContain("allProcessInspectionItemsConfirmed");
    expect(pointing).toContain("Confirmar Inspeção de Processo");
    expect(pointing).toContain("disabled={!allProcessInspectionItemsConfirmed");
  });

  it("usa largura operacional, três colunas e no máximo duas linhas por pergunta", () => {
    expect(pointing).toContain("!max-w-[1560px]");
    expect(pointing).toContain("lg:grid-cols-3");
    expect(pointing).toContain("[-webkit-line-clamp:2]");
    expect(pointing).toContain("max-h-[calc(100dvh-148px)]");
  });
});
