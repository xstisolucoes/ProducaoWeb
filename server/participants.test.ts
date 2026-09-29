import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const proxy = vi.hoisted(() => ({
  getParticipants: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("./firebirdProxy", () => proxy);

import { participantsRouter } from "./routers/participants";

const centralContext = {
  localUser: {
    id: 1,
    login: "pcp",
    name: "PCP",
    permissions: [],
    operationalProfile: "programmer",
    canConfigureStation: true,
    machine: null,
  },
  req: {},
  res: {},
} as never;

describe("Consulta de Participantes", () => {
  it("encaminha paginação e filtros definidos no XPAPER ao proxy Firebird", async () => {
    proxy.getParticipants.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 20,
    });
    const caller = participantsRouter.createCaller(centralContext);

    await expect(
      caller.list({
        page: 2,
        limit: 20,
        search: "Papel",
        type: "Fornecedor",
        status: "Ativo",
      })
    ).resolves.toMatchObject({ total: 0 });
    expect(proxy.getParticipants).toHaveBeenCalledWith(
      2,
      20,
      "Papel",
      "Fornecedor",
      "Ativo"
    );
  });

  it("impede a consulta central por perfil operacional sem acesso administrativo", async () => {
    const caller = participantsRouter.createCaller({
      ...centralContext,
      localUser: {
        ...centralContext.localUser,
        operationalProfile: "operator",
        canConfigureStation: false,
      },
    } as never);

    await expect(
      caller.list({
        page: 1,
        limit: 20,
        search: "",
        type: "Todos",
        status: "Ativo",
      })
    ).rejects.toThrow("XPAPER");
  });

  it("encaminha a leitura detalhada de Cliente ao proxy pelo código do cadastro", async () => {
    proxy.getClient.mockResolvedValue({
      codigo: 1077,
      fantasia: "Cliente Teste",
      status: "Ativo",
    });
    const caller = participantsRouter.createCaller(centralContext);

    await expect(caller.client({ codigo: 1077 })).resolves.toMatchObject({
      codigo: 1077,
      status: "Ativo",
    });
    expect(proxy.getClient).toHaveBeenCalledWith(1077);
  });

  it("inclui Cliente pelo contrato protegido e mantém a geração de PES_CODIGO no proxy", async () => {
    proxy.createClient.mockResolvedValue({ success: true, codigo: 2001 });
    const caller = participantsRouter.createCaller(centralContext);
    const input = {
      fantasia: "Cliente LAN",
      razaoSocial: "Cliente LAN Comércio Ltda.",
      cnpj: "12.345.678/0001-90",
      status: "Ativo" as const,
    };

    await expect(caller.createClient(input)).resolves.toEqual({
      success: true,
      codigo: 2001,
    });
    expect(proxy.createClient).toHaveBeenCalledWith(
      expect.objectContaining(input)
    );
  });

  it("mantém o contrato Firebird seguro com filtros parametrizados e sem acesso do navegador ao banco", () => {
    const source = readFileSync(
      new URL("../local-firebird-proxy/server.mjs", import.meta.url),
      "utf8"
    );

    expect(source).toContain('app.get("/v1/participants", ensureAuthorized');
    expect(source).toContain("coalesce(pes.tipo_cliente, 'N') = 'S'");
    expect(source).toContain("pes.pes_codigo as codigo");
    expect(source).toContain("cid.cid_codigo = pes.cid_codigo");
    expect(source).toContain("filterParts.push");
    expect(source).toContain('app.get("/v1/clients/:codigo", ensureAuthorized');
    expect(source).toContain("coalesce(pes.tipo_cliente, 'N') = 'S'");
    expect(source).toContain("pes.pes_insc_estadual as inscricao_estadual");
    expect(source).toContain("pes.pes_controlar_lote as controlar_lote");
    expect(source).toContain('app.post("/v1/clients", ensureAuthorized');
    expect(source).toContain("XPAPER_CADASTRO_WRITE_ENABLED");
    expect(source).toContain(
      "select coalesce(max(pes_codigo), 0) + 1 as codigo from pessoa"
    );
    expect(source).toContain("tipo_cliente, tipo_forn, tipo_outros, tipo_rep");
    expect(source).toContain(
      "ge_codigo, reg_codigo, rativ_codigo, pes_rep_codigo, pes_rep_comissao"
    );
    expect(source).toContain(
      "et_codigo, pes_fg_prod_mais, pes_fg_prod_menos, pes_tipo_frete"
    );
    expect(source).toContain("pes_inspecionar_produto");
    expect(source).toContain(
      "pes_amostragem, pes_controlar_lote, td_codigo, to_codigo"
    );
  });
});
