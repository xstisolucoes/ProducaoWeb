import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("estação operacional restrita", () => {
  const login = readFileSync(resolve(process.cwd(), "client/src/components/LocalLogin.tsx"), "utf8");
  const dashboard = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
  const pointing = readFileSync(resolve(process.cwd(), "client/src/pages/Pointing.tsx"), "utf8");

  it("mantém o login compatível com celular sem depender de tela cheia", () => {
    expect(login).toContain('window.location.assign("/")');
    expect(login).toContain("Validando acesso");
  });

  it("remove a navegação do operador e redireciona rotas internas para a programação", () => {
    expect(dashboard).toContain('const operatorStation = user?.operationalProfile === "operator"');
    expect(dashboard).toContain('if (machineControlStation && location !== "/") setLocation("/");');
    expect(dashboard).toContain('if (machineControlStation) return <main className="min-h-dvh flex-1 bg-[#f6f7f4] p-3 sm:p-4">{children}</main>;');
  });

  it("mantém Programador na estação de controle de máquinas, sem sidebar", () => {
    expect(dashboard).toContain('const programmerStation = user?.operationalProfile === "programmer"');
    expect(dashboard).toContain("const machineControlStation = operatorStation || programmerStation");
    expect(dashboard).toContain('if (machineControlStation) return <main className="min-h-dvh flex-1 bg-[#f6f7f4] p-3 sm:p-4">{children}</main>;');
  });

  it("mantém a produção aberta ao tentar voltar pelo navegador e compacta o apontamento", () => {
    expect(pointing).toContain('window.addEventListener("popstate", keepProductionOpen)');
    expect(pointing).toContain('window.addEventListener("beforeunload", warnBeforeExit)');
    expect(pointing).toContain("min-[900px]:h-dvh min-[900px]:overflow-hidden");
    expect(pointing).toContain("min-h-24");
  });

  it("expõe atalhos de função contextuais para os comandos e todas as chamadas operacionais", () => {
    expect(pointing).toContain('event.key === "F1"');
    expect(pointing).toContain('event.key === "F2"');
    expect(pointing).toContain('event.key === "F3"');
    expect(pointing).toContain('event.key === "F4"');
    expect(pointing).toContain('event.key === "F5"');
    expect(pointing).toContain('event.key === "F6"');
    expect(pointing).toContain('event.key === "F7"');
    expect(pointing).toContain('event.key === "F8"');
    expect(pointing).toContain('event.key === "F9"');
    expect(pointing).toContain('event.key === "F10"');
    expect(pointing).toContain('<ShortcutKey label="F1" />');
    expect(pointing).toContain('<ShortcutKey label="F2" />');
    expect(pointing).toContain('<ShortcutKey label="F3" />');
    expect(pointing).toContain('<ShortcutKey label="F4" />');
    expect(pointing).toContain('<ShortcutKey label="F5" />');
    expect(pointing).toContain('<ShortcutKey label="F6" />');
    expect(pointing).toContain('<ShortcutKey label="F7" />');
    expect(pointing).toContain('<ShortcutKey label="F8" />');
    expect(pointing).toContain('<ShortcutKey label="F9" />');
    expect(pointing).toContain('<ShortcutKey label="F10" />');
  });

  it("preserva a identificação por hostname local em Windows e Linux", () => {
    const proxy = readFileSync(resolve(process.cwd(), "local-firebird-proxy/server.mjs"), "utf8");
    expect(proxy).toContain("FIREBIRD_MACHINE_LOGON");
    expect(proxy).toContain('process.platform === "win32"');
    expect(proxy).toContain("process.env.COMPUTERNAME?.trim() || os.hostname()");
    expect(proxy).toContain("process.env.HOSTNAME?.trim() || os.hostname()");
  });
});
