import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("portal inicial do XPAPER", () => {
  it("mantém os módulos legados no seletor central", () => {
    const portal = read("client/src/pages/XPaperPortal.tsx");
    ["Cadastros", "Almoxarifado", "Compras", "Desenvolvimento", "Emissor NF", "Financeiro", "Fiscal", "PCP", "Qualidade", "Vendas", "Relatórios", "Configurações", "Atualizações", "Produção"].forEach((module) => expect(portal).toContain(`label: \"${module}\"`));
  });

  it("mantém Produção e Cadastros como módulos disponíveis e rotas integradas", () => {
    const portal = read("client/src/pages/XPaperPortal.tsx");
    const app = read("client/src/App.tsx");
    expect(portal).toContain('setLocation("/producao")');
    expect(portal).toContain('setLocation("/xpaper/cadastros")');
    expect(app).toContain('path={"/producao"}');
    expect(app).toContain('path={"/xpaper/cadastros"}');
  });

  it("apresenta XPAPER Central no login e preserva o direcionamento por perfil", () => {
    const login = read("client/src/components/LocalLogin.tsx");
    const home = read("client/src/pages/Home.tsx");
    expect(login).toContain("XPAPER Central");
    expect(login).toContain("Perfis Administrativos Escolhem o Módulo");
    expect(home).toContain("user?.canConfigureStation");
    expect(home).toContain("return <Programming />");
  });

  it("preserva o padrão consulta primeiro para os cadastros", () => {
    const consultation = read("client/src/pages/XPaperConsultation.tsx");
    expect(consultation).toContain("Consulta Padrão");
    ["Novo", "Alterar", "Excluir", "Imprimir", "Fechar"].forEach((action) => expect(consultation).toContain(`>${action}<`));
  });

  it("opera exclusivamente pelo menu superior e não renderiza cartões centrais", () => {
    const portal = read("client/src/pages/XPaperPortal.tsx");
    expect(portal).toContain('className="xpaper-module-nav"');
    expect(portal).toContain('className="xpaper-menu-only-stage"');
    expect(portal).not.toContain("xpaper-module-grid");
    expect(portal).not.toContain("xpaper-active-module");
  });
});
