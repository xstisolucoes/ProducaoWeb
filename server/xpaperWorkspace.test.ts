import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../client/src/components/XPaperWorkspace.tsx", import.meta.url),
  "utf8"
);

describe("Área de Trabalho do XPAPER", () => {
  it("oferece Sidebar e Consulta de Participantes em Title Case", () => {
    expect(source).toContain('aria-label="Sidebar do XPAPER"');
    expect(source).toContain('label: "Participantes"');
    expect(source).toContain("Consulta de Participantes");
    expect(source).toContain("Novo Cliente");
  });

  it("mantém abas internas persistentes, com prevenção de duplicidade e fechamento individual", () => {
    expect(source).toContain('id: "inicio"');
    expect(source).toContain('id: "participantes"');
    expect(source).toContain("current.some((tab) => tab.id === id)");
    expect(source).toContain("const closeTab");
    expect(source).toContain('aria-label="Abas Internas"');
  });

  it("prepara detalhe por participante para Dados Gerais, Contatos, Condições de Pagamento e Observações", () => {
    expect(source).toContain("Dados Gerais");
    expect(source).toContain("Condições de Pagamento");
    expect(source).toContain("Observações");
    expect(source).toContain("const id = `participante:${participant.codigo}`");
  });

  it("estrutura o novo Cliente com as áreas e comandos demonstrados no fluxo legado", () => {
    expect(source).toContain("Informações Gerais");
    expect(source).toContain("Informações Complementares");
    expect(source).toContain("Informações Financeiras");
    expect(source).toContain("Endereços de Cobrança/Entrega");
    expect(source).toContain("Confirmar Inclusão de Cliente");
    expect(source).toContain(">Fechar</Button>");
    expect(source).toContain("Gravar");
  });

  it("abre Cliente em modal completo e preserva a Consulta de Participantes como aba", () => {
    expect(source).toContain("function ClientModal");
    expect(source).toContain("Cadastro de Cliente");
    expect(source).toContain(
      "onPointerDownOutside={(event) => event.preventDefault()}"
    );
    expect(source).toContain(
      "onEscapeKeyDown={(event) => event.preventDefault()}"
    );
    expect(source).toContain('setClientDialog({ mode: "create" })');
    expect(source).toContain('setClientDialog({ mode: "view", participant })');
    expect(source).toContain("Classificação Comercial");
    expect(source).toContain("Regras Fiscais e de Produção");
    expect(source).toContain("Estrutura Tributária");
    expect(source).toContain("Informações Financeiras");
  });
});
