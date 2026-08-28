import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("RPNC no proxy Firebird", () => {
  it("consulta checklists por origem e grava o conjunto de registros na mesma transação", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");

    expect(proxy).toContain('/v1/pointing/:opCodigo/:mpCodigo/rpnc');
    expect(proxy).toContain('"Inspeção de Recebimento"');
    expect(proxy).toContain('"Liberação de Produto"');
    expect(proxy).toContain("from check_list cl where cl.cl_tipo_formulario = ?");
    expect(proxy).toContain("from itens_check_list icl");
    expect(proxy).toContain("left join causa_aparente ca");
    expect(proxy).toContain("insert into inspecao_produto");
    expect(proxy).toContain("insert into rpnc ");
    expect(proxy).toContain("insert into rpnc_nao_conformidades");
    expect(proxy).toContain("insert into rpnc_causa_nc");
    expect(proxy).toContain("insert into rpnc_acoes_produto_nc");
    expect(proxy).toContain("manc_codigo, apnc_responsavel, apnc_execucao, apnc_qtde");
    expect(proxy).toContain("values (?, ?, ?, 6, 48, 48, ?)");
    expect(proxy).not.toContain('if (origin === "product") {\n        const actionRows');
    expect(proxy).toContain("await withTransaction(async (transaction)");
    expect(proxy).toContain("mp.pes_codigo as customer_code");
    expect(proxy).toContain("const personCode = origin === \"raw-material\" ? supplierCode : customerCode > 0 ? customerCode : null");
    expect(proxy).toContain("originLabel, scheduleCode");
  });

  it("organiza a interface em checklist, itens, causas e ação de contenção sem sobreposição", () => {
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

    expect(pointing).toContain("selectRpncChecklist");
    expect(pointing).toContain("activeRpncChecklist");
    expect(pointing).toContain("activeRpncItem");
    expect(pointing).toContain("grid-cols-[34%_66%]");
    expect(pointing).toContain("Causa Aparente");
    expect(pointing).toContain("Ação de Contenção");
    expect(pointing).toContain("Checklist para Inspeção");
    expect(pointing).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
    expect(pointing).toContain("onEscapeKeyDown={(event) => event.preventDefault()}");
    expect(pointing).toContain("grid-rows-[minmax(0,1fr)_156px]");
    expect(pointing).toContain("h-[min(54dvh,520px)]");
    expect(pointing).toContain("flex w-20 shrink-0 flex-col");
    expect(pointing).toContain("O Processo Foi Concluído sem Não Conformidade?");
    expect(pointing).toContain("Sim, Seguir para Rastreio");
    expect(pointing).toContain("Não, Abrir RPNC");
    expect(pointing).toContain("function decideTraceConformance");
  });
});
