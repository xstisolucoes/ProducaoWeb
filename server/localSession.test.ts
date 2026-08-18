import { afterEach, describe, expect, it } from "vitest";
import { createLocalSession, readLocalSession } from "./localSession";

const previousSecret = process.env.LOCAL_SESSION_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.LOCAL_SESSION_SECRET;
  else process.env.LOCAL_SESSION_SECRET = previousSecret;
});

describe("sessão local", () => {
  it("assina e recupera o operador autenticado", async () => {
    process.env.LOCAL_SESSION_SECRET = "segredo-de-teste";
    const token = await createLocalSession({ id: 7, login: "operador", name: "Operador Local", email: "op@empresa.local", groupCode: 2, employeeCode: 4, sectorCode: 1, companyCode: 1, permissions: ["PRODUCAO_STATUS_UPDATE"], operationalProfile: "manual-pointing" });
    const req = { headers: { cookie: `producao_local_session=${encodeURIComponent(token)}` } } as never;

    await expect(readLocalSession(req)).resolves.toMatchObject({ id: 7, login: "operador", name: "Operador Local", permissions: ["PRODUCAO_STATUS_UPDATE"], operationalProfile: "manual-pointing" });
  });

  it("rejeita uma sessão manipulada", async () => {
    process.env.LOCAL_SESSION_SECRET = "segredo-de-teste";
    const req = { headers: { cookie: "producao_local_session=token-invalido" } } as never;
    await expect(readLocalSession(req)).resolves.toBeNull();
  });
});
