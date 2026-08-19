import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CookieOptions, Request } from "express";

export const STATION_COOKIE = "producao_station_code";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type StationBinding = { machineCode: number; updatedAt: string };
type StationBindings = Record<string, StationBinding>;

function bindingsFilePath() {
  return process.env.PRODUCTION_STATION_BINDINGS_FILE?.trim() || resolve(process.cwd(), "data", "production-station-bindings.json");
}

function normalizeAddress(value: string | undefined) {
  const address = String(value ?? "").trim().split(",")[0]?.trim() ?? "";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function stationClientAddress(req: Request) {
  const trustProxy = String(process.env.PRODUCTION_STATION_TRUST_PROXY ?? "N").trim().toUpperCase() === "S";
  const forwarded = trustProxy ? req.headers["x-forwarded-for"] : undefined;
  return normalizeAddress(typeof forwarded === "string" ? forwarded : req.socket.remoteAddress);
}

function readCookie(req: Request, name: string) {
  const item = (req.headers.cookie?.split(";") ?? []).find((entry) => entry.trim().startsWith(`${name}=`));
  return item ? decodeURIComponent(item.trim().slice(name.length + 1)) : null;
}

export function readStationCookie(req: Request) {
  const code = Number(readCookie(req, STATION_COOKIE));
  return Number.isInteger(code) && code > 0 ? code : null;
}

export function stationCookieOptions(req: Request): CookieOptions {
  const forwarded = req.headers["x-forwarded-proto"];
  const forwardedValues: string[] = Array.isArray(forwarded) ? forwarded : forwarded?.split(",") ?? [];
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: req.protocol === "https" || forwardedValues.some((value) => value.trim().toLowerCase() === "https"),
    maxAge: ONE_YEAR_MS,
  };
}

async function readBindings(): Promise<StationBindings> {
  try {
    const value = JSON.parse(await readFile(bindingsFilePath(), "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([address, binding]) => {
      const item = binding as Partial<StationBinding>;
      return Number.isInteger(item.machineCode) && Number(item.machineCode) > 0 ? [[address, { machineCode: Number(item.machineCode), updatedAt: String(item.updatedAt ?? "") }]] : [];
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    console.warn("[Produção] Não foi possível ler os vínculos de estação:", error);
    return {};
  }
}

export async function getStationBinding(req: Request) {
  const address = stationClientAddress(req);
  if (!address) return null;
  const bindings = await readBindings();
  const binding = bindings[address];
  return binding ? { address, ...binding } : null;
}

export async function saveStationBinding(req: Request, machineCode: number) {
  const address = stationClientAddress(req);
  if (!address) throw new Error("Não foi possível identificar o endereço desta estação na rede.");
  const bindings = await readBindings();
  const binding = { machineCode, updatedAt: new Date().toISOString() };
  bindings[address] = binding;
  const filePath = bindingsFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(bindings, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
  return { address, ...binding };
}
