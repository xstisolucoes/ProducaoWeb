import { jwtVerify, SignJWT } from "jose";
import { type LocalSessionUser } from "./localSession"; // this import may need adjustment

var LOCAL_SESSION_COOKIE = "producao_local_session";
var textEncoder = new TextEncoder();

function sessionSecret() {
  const value = process.env.LOCAL_SESSION_SECRET?.trim() || process.env.FIREBIRD_PROXY_TOKEN?.trim();
  if (!value) throw new Error("Defina LOCAL_SESSION_SECRET ou FIREBIRD_PROXY_TOKEN para assinar a sessão local.");
  return textEncoder.encode(value);
}

function readCookie(req: any, cookieName: string) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const item = cookies.find((entry) => entry.trim().startsWith(`${cookieName}=`));
  return item ? decodeURIComponent(item.trim().slice(cookieName.length + 1)) : null;
}

export async function readLocalSession(req: any): Promise<LocalSessionUser | null> {
  const token = readCookie(req, LOCAL_SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { issuer: "producao-local", audience: "producao-web" });
    if (typeof payload.id !== "number" || typeof payload.login !== "string" || typeof payload.name !== "string") return null;
    return {
      id: payload.id,
      login: payload.login,
      name: payload.name,
      email: typeof payload.email === "string" ? payload.email : null,
      groupCode: typeof payload.groupCode === "number" ? payload.groupCode : null,
      employeeCode: typeof payload.employeeCode === "number" ? payload.employeeCode : null,
      sectorCode: typeof payload.sectorCode === "number" ? payload.sectorCode : null,
      companyCode: typeof payload.companyCode === "number" ? payload.companyCode : null,
      permissions: Array.isArray(payload.permissions) ? payload.permissions.filter((permission: any) => typeof permission === "string") : [],
      operationalProfile: payload.operationalProfile === "programmer" || payload.operationalProfile === "manual-pointing" || payload.operationalProfile === "manual-production" || payload.operationalProfile === "quality-release" ? payload.operationalProfile : "operator",
      canConfigureStation: payload.canConfigureStation === true,
      machine: (() => {
        const machine = payload.machine;
        if (!machine || typeof machine !== "object" || !("code" in machine) || typeof machine.code !== "number") return null;
        const values = machine;
        return {
          code: machine.code,
          description: typeof values.description === "string" ? values.description : "Máquina não identificada",
          groupCode: typeof values.groupCode === "number" ? values.groupCode : null,
          groupDescription: typeof values.groupDescription === "string" ? values.groupDescription : null,
          followsQueue: values.followsQueue === true,
          manualProcess: values.manualProcess === true
        };
      })()
    };
  } catch {
    return null;
  }
}