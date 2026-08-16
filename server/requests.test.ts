import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Solicitações internas", () => {
  it("restringe setores a Manutenção e Desenvolvimento e protege a escrita", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain('app.get("/v1/requests/sectors"');
    expect(proxy).toContain("from setores_empresa se");
    expect(proxy).toContain("se.ae_codigo in (3, 9)");
    expect(proxy).toContain('app.post("/v1/requests"');
    expect(proxy).toContain('PRODUCTION_POINTING_WRITE_ENABLED');
    expect(proxy).toContain('const targetSectorName = type === "maintenance" ? "Manutenção" : "Desenvolvimento"');
    expect(proxy).toContain("select first 1 se_codigo as code from setores_empresa where se_status = 'Ativo' and upper(se_descricao) = upper(?) order by se_codigo");
    expect(proxy).toContain("insert into solicitacoes");
  });

  it("expõe quantidades aprovadas consolidadas por processo e arranjo", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain('approved-quantities');
    expect(proxy).toContain("sum(mph.mph_qtde_produzida)");
    expect(proxy).toContain("group by gm.gmq_grupo, mov.mp_status, mov.arranjo");
  });

  it("abre o formulário simplificado como modal a partir do apontamento", () => {
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/RequestDialog.tsx"), "utf8");
    const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");
    expect(dialog).toContain('setDescription(""); onOpenChange(false)');
    expect(dialog).toContain("Solicitante: {firstName}");
    expect(dialog).toContain("Cancelar");
    expect(pointing).toContain("<RequestDialog open={showRequests}");
  });

  it("mantém os modais com largura responsiva e corpo de fundo sólido", () => {
    const requestDialog = readFileSync(resolve(process.cwd(), "client/src/components/RequestDialog.tsx"), "utf8");
    const quantitiesDialog = readFileSync(resolve(process.cwd(), "client/src/components/ApprovedProcessQuantitiesDialog.tsx"), "utf8");
    expect(requestDialog).toContain("!w-[calc(100vw-1rem)] !max-w-3xl");
    expect(requestDialog).toContain("min-[560px]:grid-cols-2");
    expect(quantitiesDialog).toContain("!flex !w-[calc(100vw-1rem)] !max-w-4xl");
    expect(quantitiesDialog).toContain('className="w-full bg-[#fffdf6] p-4 sm:p-6"');
  });

  it("define o visual de Solicitações como base compartilhada dos diálogos", () => {
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/ui/dialog.tsx"), "utf8");
    expect(dialog).toContain("rounded-2xl border-2 border-[#d6e0d9] p-0 shadow-2xl");
    expect(dialog).toContain("bg-gradient-to-r from-[#f0f8f2] via-white to-[#fff8df]");
    expect(dialog).toContain("border-t border-[#e2eae4] bg-[#fbfdfb]");
  });
});
