import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("identificadores do login local", () => {
  it("aceita código numérico, usuário ou e-mail sem converter texto em parâmetro numérico", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");

    expect(proxy).toContain('const userCode = /^\\d+$/.test(login) ? Number(login) : -1;');
    expect(proxy).toContain("or usu.usu_codigo = ?");
    expect(proxy).toContain("[login, login, userCode]");
    expect(login).toContain("Número, Usuário ou E-mail");
    expect(login).toContain("Ex.: 25, Operador ou E-Mail");
  });
});
