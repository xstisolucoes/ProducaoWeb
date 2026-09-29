import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Portal Inicial do XPAPER", () => {
  it("mantém todos os módulos legados concentrados na Sidebar", () => {
    const workspace = read("client/src/components/XPaperWorkspace.tsx");
    [
      "Cadastros",
      "Almoxarifado",
      "Compras",
      "Desenvolvimento",
      "Emissor NF",
      "Financeiro",
      "Fiscal",
      "PCP",
      "Qualidade",
      "Vendas",
      "Relatórios",
      "Configurações",
      "Atualizações",
      "Produção",
    ].forEach(module => expect(workspace).toContain(`label: "${module}"`));
    expect(workspace).toContain('aria-label="Sidebar do XPAPER"');
  });

  it("mantém Produção e Cadastros integrados à área de trabalho", () => {
    const portal = read("client/src/pages/XPaperPortal.tsx");
    const app = read("client/src/App.tsx");
    expect(portal).toContain('setLocation("/producao")');
    expect(portal).toContain("XPaperWorkspace");
    expect(app).toContain('path={"/producao"}');
    expect(app).toContain('path={"/xpaper/cadastros"}');
  });

  it("apresenta XPAPER no login e preserva o direcionamento por perfil", () => {
    const login = read("client/src/components/LocalLogin.tsx");
    const home = read("client/src/pages/Home.tsx");
    expect(login).toContain("XPAPER");
    expect(login).toContain("Perfis Administrativos Escolhem o Módulo");
    expect(home).toContain("user?.canConfigureStation");
    expect(home).toContain("return <Programming />");
  });

  it("preserva Consulta de Participantes como primeira tela de cadastro", () => {
    const workspace = read("client/src/components/XPaperWorkspace.tsx");
    expect(workspace).toContain("Consulta de Participantes");
    expect(workspace).toContain("Novo Cliente");
    expect(workspace).toContain("Dados Gerais");
  });

  it("mantém módulos fora das abas e abre somente consultas, formulários e registros internamente", () => {
    const portal = read("client/src/pages/XPaperPortal.tsx");
    const workspace = read("client/src/components/XPaperWorkspace.tsx");
    expect(portal).not.toContain('className="xpaper-module-nav"');
    expect(workspace).toContain('aria-label="Abas Internas"');
    expect(workspace).toContain("const openForm");
    expect(workspace).toContain("const openModule");
    expect(portal).not.toContain("xpaper-module-grid");
  });
});
