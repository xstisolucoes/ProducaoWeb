import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStationBinding, readStationCookie, saveStationBinding, stationCookieOptions } from "./stationBinding";

function requestFromStation(address: string, cookie?: string) {
  return {
    headers: cookie ? { cookie } : {},
    socket: { remoteAddress: address },
    protocol: "http",
  } as unknown as Request;
}

describe("vínculo persistente de estação", () => {
  let temporaryDirectory = "";
  const previousBindingsFile = process.env.PRODUCTION_STATION_BINDINGS_FILE;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "producao-estacao-"));
    process.env.PRODUCTION_STATION_BINDINGS_FILE = join(temporaryDirectory, "estacoes.json");
  });

  afterEach(async () => {
    if (previousBindingsFile === undefined) delete process.env.PRODUCTION_STATION_BINDINGS_FILE;
    else process.env.PRODUCTION_STATION_BINDINGS_FILE = previousBindingsFile;
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("recupera a máquina associada ao endereço da estação depois de uma nova requisição", async () => {
    const station = requestFromStation("192.168.10.24");

    await expect(saveStationBinding(station, 17)).resolves.toMatchObject({ address: "192.168.10.24", machineCode: 17 });
    await expect(getStationBinding(requestFromStation("192.168.10.24"))).resolves.toMatchObject({ address: "192.168.10.24", machineCode: 17 });
  });

  it("mantém também um cookie de um ano como redundância no navegador", () => {
    const request = requestFromStation("192.168.10.24", "producao_station_code=17");
    expect(readStationCookie(request)).toBe(17);
    expect(stationCookieOptions(request).maxAge).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
